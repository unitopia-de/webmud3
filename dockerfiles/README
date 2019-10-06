# README for docker commands

### To adjust versions:  webmud3\UI8\src\app\shared\server-config.service.ts


### To build the docker images 

docker build -f Dockerfile -t myonara/webmud3:latest .

docker build -f dockerfiles/ng_unitopia.dockerfile -t myonara/webmud3:unitopia .

docker build -f dockerfiles/ng_unitopia_test.dockerfile -t myonara/webmud3:unitopiatest .


### To run the docker containers in a swarm:

docker stack deploy -c dockerfiles/w3_docker_compose_local.yml webmud3alocal

docker stack deploy -c dockerfiles/w3_docker_compose.yml webmud3a

docker stack deploy -c dockerfiles/w3_docker_compose_test.yml webmud3atest


### Test docker containers as standalone

docker run -d -p 2018:5000 --name webmud3local myonara/webmud3:latest

docker run -d --name mudconnOrbit myonara/mdconn:v0.0.6

docker run -d -p 50000:80 --name helloplain -P nginxdemos/hello:plain-text


### docker commands for diagnosis:


#### List services (stack deploys) and details:

docker service ls

docker service ps --no-trunc webmud3a_web

docker service ps --no-trunc webmud3atest_web

docker service ps --no-trunc webmud3alocal_web

#### get container id and logs

docker container ls 

docker logs --follow <contaienrid>



### Obsolete docker commands

docker build -f dockerfiles/mdconn.dockerfile -t myonara/mdconn:v0.0.17 .

docker stack deploy -c dockerfiles/w3_docker_compose_secret.yml webmud3a

docker stack deploy -c dockerfiles/w3_docker_compose_with_apache.yml webmud3a

docker stack deploy -c dockerfiles/w3mdc_docker_compose.yml mdconn

docker attach <containerid>

docker exec -ti <name> /bin/sh
