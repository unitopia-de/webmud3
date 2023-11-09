# README for docker commands

### To adjust versions:  webmud3\UI8\src\app\shared\server-config.service.ts


### To build the docker images 

docker build -f Dockerfile -t myonara/webmud3:latest .

docker build -f dockerfiles/ng_unitopia_test.dockerfile -t myonara/webmud3:unitopiatest .

### To run the docker containers in a swarm:

docker stack deploy -c dockerfiles/w3_docker_compose_local.yml webmud3alocal

docker stack deploy -c dockerfiles/w3_docker_compose.yml webmud3a

docker stack deploy -c dockerfiles/w3_docker_compose_test.yml webmud3atest

docker stack deploy -c dockerfiles/w3_docker_compose_sb.yml webmud3sb

docker stack rm webmud3atest

### Test docker containers as standalone

docker run -d -p 2018:5000 --name webmud3local myonara/webmud3:latest

docker run -d --name mudconnOrbit myonara/mdconn:v0.0.6

docker run -d -p 50000:80 --name helloplain -P nginxdemos/hello:plain-text

### Alternative podman compose
#### to start

podman-compose -f dockerfiles/w3_docker_compose.yml -p webmud_unitopia up -d

podman-compose -f dockerfiles/w3_docker_compose_sb.yml -p webmud_seifenblase up -d

podman-compose -f dockerfiles/w3_docker_compose_test.yml -p webmud_test up -d
    
podman-compose -f dockerfiles/w3_docker_compose_test_neu.yml -p webmud_test up -d
    
####  to stop

podman-compose -f dockerfiles/w3_docker_compose.yml -p webmud_unitopia down
    
podman-compose -f dockerfiles/w3_docker_compose_sb.yml -p webmud_seifenblase down

podman-compose -f dockerfiles/w3_docker_compose_test.yml -p webmud_test down
    
podman-compose -f dockerfiles/w3_docker_compose_test_neu.yml -p webmud_test down
    
####  to get new imges:

podman pull myonara/webmud3:latest

podman pull myonara/webmud3:unitopiatest


### docker commands for diagnosis:
grep dockerd /var/log/daemon.log

#### List services (stack deploys) and details:

docker service ls

docker service ps --no-trunc webmud3a_web

docker service ps --no-trunc webmud3atest_web

docker service ps --no-trunc webmud3alocal_web

#### get container id and logs

docker container ls 

docker logs --follow <contaienrid>

#### testing images:

cd mdconn/test_ipc/

docker build -f Dockerfile -t test/test-ipc .

docker stack deploy -c docker-compose.yml testipc

docker stack rm testipc

cd mdconn/mudrpc

docker build -t myonara/test-rpc .

docker run -it myonara/test-rpc /bin/sh

docker run --volume /UNItopia/ftpwww/webmud3/run/sockets/:/run/sockets -it myonara/test-rpc /bin/sh

docker run --volume /UNItopia/ftpwww/webmud3/run/sockets/:/run/sockets -e SOCKETFILE=/run/sockets/mudfifo myonara/test-rpc node testclient.js

ls -al /UNItopia/ftpwww/webmud3/run/sockets/

docker stack deploy -c docker-test-rpc.yml testmudrpc

docker stack rm testmudrpc

### Obsolete docker commands

docker build -f dockerfiles/mdconn.dockerfile -t myonara/mdconn:v0.0.17 .

docker stack deploy -c dockerfiles/w3_docker_compose_secret.yml webmud3a

docker stack deploy -c dockerfiles/w3_docker_compose_with_apache.yml webmud3a

docker stack deploy -c dockerfiles/w3mdc_docker_compose.yml mdconn

docker attach <containerid>

docker exec -ti node:alpine /bin/sh
