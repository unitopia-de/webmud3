# webmud3 V0.0.36 !!!
Webmud3: third generation of the UNItopia Webmud as open source project.

Is up and running o the UNItopia server for testers only.
Special settings for UNItopia and docker creation in dockerfiles/README.

In this early stages (Versions < 0.1.0) it's not for production.
See [VERSION_HISTORY.md](VERSIONS_HISTORY.md)

## Installation in the Development environment
### One time prerequisites:
1. Install node.js together with npm: https://nodejs.org/en/download/
2. Install angular-cli:> `npm install angular-cli -g`
3. Install nodemon:> `npm install nodemon -g`
4. download webmud3 and extract to a working directory.

### Preparing backend
1. change directory to backend directory
2. execute:> `npm install`
3. open a shell and execute `nodemon server.js`

The server is now running in the background and is listening on 5000.

### Preparing UI
1. change directory to UI directory
2. `npm install`
3. `ng serve --open`
4. the default browser will open on localhost:4200/webmud3... Have fun.

### Retrieving docker image:
1. The docker images are available at https://hub.docker.com/r/myonara/webmud3/

Then the docker container is running on port 5000 (localhost:5000/webmud3)
