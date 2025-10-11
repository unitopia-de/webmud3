FROM node:20.19-alpine3.20 AS ng-build-stage

# Setze das Arbeitsverzeichnis im Container
WORKDIR /usr/src/app

# sourcen kopieren ausser .dockerignore
COPY . /usr/src/app/

# use local sources
RUN npm install && \
    npm run build:prod
    
# fresh small image
FROM node:20.19-alpine3.20 AS webmud3

# Setze das Arbeitsverzeichnis im Container
WORKDIR /usr/src/app

# kopiere NUR das kompilat
COPY --from=ng-build-stage /usr/src/app/backend/dist /usr/src/app 

# nondev dependencies mitnehmen
RUN npm install --no-package-lock --omit dev

# Setze die Umgebungsvariable PORT
ENV PORT=5000

# Exponiere den Port, auf dem die Anwendung läuft
EXPOSE 5000

# Starte die Anwendung
CMD ["node", "main.js"]
# testing CMD ["/bin/sh"]
