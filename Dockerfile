FROM node:20.12.2 AS ng-build-stage

# docker build --progress=plain -f Dockerfile -t myonara/webmud3:latest .
# docker build --no-cache --progress=plain -f Dockerfile -t myonara/webmud3:latest .

# Setze das Arbeitsverzeichnis im Container
WORKDIR /webmud3

# Kompilat kopieren
COPY ./ ./

# Installiere die Abhängigkeiten
RUN apt-get update -y \
  && apt upgrade -y \
  && npm install -g npm@10.8.2
RUN npm install
RUN npm run build

# get fresh deployment
FROM node:20.12.2 AS webmud3

# Setze das Arbeitsverzeichnis im Container
WORKDIR /webmud3

# copy from build stage
COPY --from=ng-build-stage /webmud3/backend/dist/ /webmud3/

RUN npm install -g npm@10.8.2 && npm install

# Setze die Umgebungsvariable PORT
ENV PORT=5000

# Exponiere den Port, auf dem die Anwendung läuft
EXPOSE 5000

# Starte die Anwendung
# CMD ["node", "/webmud3/main.js"]

# for debugging:
ADD dockerfiles/.bashrc /root/

CMD ["/bin/bash"]

# docker run -it -p 5000:5000 --env-file dockerfiles/env-wm3local.list --name wm3test --hostname wm3test myonara/webmud3:latest
# docker run -it -p 2019:5000 --env-file dockerfiles/env-wm3testuni.list --name wm3test --hostname wm3test myonara/webmud3:latest