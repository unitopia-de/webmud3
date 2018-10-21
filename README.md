# webmud3 V0.0.24 !!!
Webmud3: third generation of the UNItopia Webmud as open source project.

In this early stages (Versions < 0.1.0) it's not for production.
1. Version 0.0.2 delivers a configurable list of muds in frontend/config/config.development, so that the development mode can be used as local browser-mudclient to multiple muds.
2. Version 0.0.3 added ANSI colour support
3. Version 0.0.4 fixed an ANSI colour issue and renamed frontend dir to backend.
4. Version 0.0.5 implmented telnet_neg: echo,terminaltype and naws. started with GMCP support.
5. Version 0.0.6 implemented sound on top of GMCP, working with UNItopia so far.
6. Version 0.0.7 Rewrite for portal and created dockerfile.
7. Version 0.0.8-0.0.10: Getting docker configuration to run on UNItopia.de
8. Version 0.0.11: Enabling CORS. 
9. Version 0.0.12: bugfix CORS.
10. Version 0.0.13: polyfill for IE11,10,9.
11. Version 0.0.14: Bugfixes favicon,title,config
12. Version 0.0.15: invert foreground, if forground is identical to background color. shorten input-line. on enter return on output (input_to-issue)
13. Version 0.0.16: dynamic height of mud window, fixed monotype size fixing ie+edge, fewer logs
14. Version 0.0.17: Redesign and Test of new mudwindow width and heigths calculation
15. Version 0.0.18: Menu: Connect,Disconnect,Invert,BlackOnWhite. Windows-Sizing revisited, Serverloggin enhanced. more robust disconnects(on-going).
16. Version 0.0.19: Experiments and Tests with gracefully exits.
17. Version 0.0.20/21: Experiments with scrollbars/tooltips, update angular to 6.1.10
18. Version 0.0.22/23: Finally get some scrollbars activated for Safari.
19. Version 0.0.24: GMCP-Ping,GMVP-GoodBye and request more GMCP Modules from MUD (Ongoing)

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