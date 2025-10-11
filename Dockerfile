FROM node:20.12.2

# Setze das Arbeitsverzeichnis im Container
WORKDIR /usr/src/app

# Clone specific branch from GitHub
RUN git clone -b develop https://github.com/unitopia-de/webmud3.git . && \
    npm install && \
    npm run build:prod && \
    mv backend/dist/* . && \
    rm -rf frontend \
    rm -rf backend

# Installiere die Abhängigkeiten
RUN npm install --no-package-lock --include=prod

# Setze die Umgebungsvariable PORT
ENV PORT=5000

# Exponiere den Port, auf dem die Anwendung läuft
EXPOSE 5000

# Starte die Anwendung
CMD ["node", "main.js"]