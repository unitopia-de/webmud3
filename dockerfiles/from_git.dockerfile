# ==============================================================================
# Stage 0: Pre-Build - Git Repository klonen
# ==============================================================================
FROM alpine/git AS cloner

WORKDIR /src

# Falls du SSH-Keys benötigst, kannst du sie hier via Build-Kit Mount einbinden.
# Wenn das Repo öffentlich ist oder du ein Token nutzt, reicht ein normales RUN git clone.
RUN git clone --branch renew/komfort --single-branch --depth 1 https://github.com/unitopia/webmud3.git .

# ==============================================================================
# Stage 1: Build the application in a monorepo structure
# ==============================================================================
FROM node:22.22.2-alpine AS builder

# Set the working directory
WORKDIR /app

# NEU: Statt lokale Dateien zu kopieren, kopieren wir jetzt die package.json-Dateien
# direkt aus der 'cloner'-Stage, um das Docker-Caching für 'npm ci' zu behalten!
COPY --from=cloner /src/package.json /src/package-lock.json ./
COPY --from=cloner /src/shared/package.json shared/
COPY --from=cloner /src/backend/package.json backend/
COPY --from=cloner /src/frontend/package.json frontend/

# Install all dependencies for the entire monorepo
RUN npm ci

# NEU: Den restlichen Quellcode ebenfalls aus der 'cloner'-Stage kopieren
COPY --from=cloner /src/ .

# Run the production build.
RUN npm run build:prod --if-present

# Workaround für das Shared-Package (unverändert)
RUN mkdir -p backend/dist/node_modules/@webmud3 && \
    cp -r shared/dist backend/dist/node_modules/@webmud3/shared && \
    cp shared/package.json backend/dist/node_modules/@webmud3/shared/

RUN cd backend/dist && npm install --omit=dev

# ==============================================================================
# Stage 2: Create the final production image
# ==============================================================================
FROM node:22.22.2-alpine

WORKDIR /app

ENV NODE_ENV=production HOST=0.0.0.0 PORT=5000 TELNET_HOST=127.0.0.1 TELNET_PORT=23 TELNET_TLS=false SOCKET_ROOT=/socket.io SOCKET_TIMEOUT=900000

COPY --from=builder /app/backend/dist .

EXPOSE 5000

CMD [ "node", "main.js" ]