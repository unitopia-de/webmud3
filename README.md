# webmud3
Webmud3: third generation of the UNItopia Webmud as open source project.

In this early stages (Versions < 0.1.0) it's not for production.

## Installation in the Development environment
### One time prerequisites:
1. Install node.js together with npm: https://nodejs.org/en/download/
2. Install angular-cli:> `npm install angular-cli -g`
3. Install nodemon:> `npm install nodemon -g`
4. download webmud3 and extract to a working directory.

### Preparing frontend
1. change directory to frontend directory
2. execute:> `npm install`
3. open a shell and execute `nodemon server.js`
The server is now running in the background and is listening on 5000.

### Preparing UI
1. change directory to UI directory
2. `npm install`
3. `ng serve --open`
4. the default browser will open on localhost:4200... Have fun.
