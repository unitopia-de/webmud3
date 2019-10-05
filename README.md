# webmud3 V0.0.40 !!!
Webmud3: third generation of the UNItopia Webmud as open source project.

Is up and running o the UNItopia server for testers only.

With version 0.0.40 there are three dockerfiles for creating docker images,
two of them are reserved for unitopia purposes (see dockerfiles/README).

For own testing please use the following docker command to create the docker image:
docker build -f dockerfiles/ng-local.dockerfile -t myonara/webmud3:local .

For standalone execution:
docker run -d -p 5000:5000 --name webmud3test myonara/webmud3:local

Prior to Version V0.0.40 there was a possiblity yto manually edit the files and 
load it outside docker. 

Hint: Currently is the local docker image not working, will be fixed soon.

### Retrieving docker image:
1. The docker images are available at https://hub.docker.com/r/myonara/webmud3/

Then the docker container is running on port 5000 (localhost:5000/webmud3)
