# webmud3 V0.0.42 !!!
Webmud3: third generation of the UNItopia Webmud as open source project.

Is up and running o the UNItopia server for testers only.

With version 0.0.40 there are three dockerfiles for creating docker images,
two of them are reserved for unitopia purposes (see dockerfiles/README).


For own testing please use the following docker command to create the docker image:
###### docker pull myonara/webmud3:latest
To build an own image from the webmud3 directory:
###### docker build -f dockerfiles/ng-local.dockerfile -t myonara/webmud3:latest .

For standalone execution:
###### docker run -d -p 5000:5000 --name webmud3test myonara/webmud3:latest

For swarm init:
###### docker stack deploy -c dockerfiles/w3_docker_compose_local.yml webmud3alocal

Prior to Version V0.0.40 there was a possiblity to manually edit the files and 
load and test it outside docker. Take a look into ./Dockerfile
and perform the replace-steps to index.html and server.js manually,
if you really insist on executing without docker. 

Then the docker container is running on port 5000 (localhost:5000/webmud3)
