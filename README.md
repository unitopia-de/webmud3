# webmud3 V0.0.7 !!!
Webmud3: third generation of the UNItopia Webmud as open source project.

In this early stages (Versions < 0.1.0) it's not for production.
1. Version 0.0.2 delivers a configurable list of muds in frontend/config/config.development, so that the development mode can be used as local browser-mudclient to multiple muds.
2. Version 0.0.3 added ANSI colour support
3. Version 0.0.4 fixed an ANSI colour issue and renamed frontend dir to backend.
4. Version 0.0.5 implmented telnet_neg: echo,terminaltype and naws. started with GMCP support.
5. Version 0.0.6 implemented sound on top of GMCP, working with UNItopia so far.
6. Version 0.0.7 Rewrite for portal and created dockerfile.

## Installation in the Development environment
### One time prerequisites:
1. Install node.js together with npm: https://nodejs.org/en/download/
2. Install angular-cli:> `npm install angular-cli -g`
3. Install nodemon:> `npm install nodemon -g`
4. download webmud3 and extract to a working directory.

### Preparing storage
currently not used, implemented for future use.

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

### Creating docker image:
1. change directory to webmud3. (where UI and backend are in)
2. docker build -t webmud3:v0.0.7 -f ./dockerfiles/ng.dockerfile .