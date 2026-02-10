# Dockerfile for webmud3

# Stage 1: Build the application in a monorepo structure
FROM node:22.20.0-alpine AS builder

# Set the working directory
WORKDIR /app

# To leverage Docker layer caching, we first copy over all package.json files
# from the monorepo. This ensures that 'npm ci' has the full context of all
# workspaces and their dependencies.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# Install all dependencies for the entire monorepo
RUN npm ci

# Copy the rest of the source code
COPY . .

# Run the production build. This should build all workspaces (frontend, backend, shared).
# The --if-present flag prevents errors if the script doesn't exist.
RUN npm run build:prod --if-present

# This is the implementation of the step from your Azure workflow.
# It's a workaround to make the 'shared' package available to the backend at runtime
# without publishing it to a package registry.
RUN mkdir -p backend/dist/node_modules/@webmud3 && \
    cp -r shared/dist backend/dist/node_modules/@webmud3/shared && \
    cp shared/package.json backend/dist/node_modules/@webmud3/shared/
# This step creates a production-only node_modules folder directly within the
# backend's distribution folder, mirroring the Azure deployment process.
RUN cd backend/dist && npm install --omit=dev

# Stage 2: Create the final production image
FROM node:22.20.0-alpine

WORKDIR /app

# Set default environment variables based on the README
ENV NODE_ENV=production HOST=0.0.0.0 PORT=5000 TELNET_HOST=127.0.0.1 TELNET_PORT=23 TELNET_TLS=false SOCKET_ROOT=/socket.io SOCKET_TIMEOUT=900000

# Copy the built backend application, including its production node_modules,
# from the builder stage.
COPY --from=builder /app/backend/dist .

EXPOSE 5000

# The command to start the backend server.
# Note: "main.js" is a common convention, but you may need to adjust this based on your project's entrypoint.
CMD [ "node", "main.js" ]
