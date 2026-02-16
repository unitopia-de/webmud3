# Docker Deployment Guide

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOST` | No | `0.0.0.0` | IP the backend listens on |
| `PORT` | No | `5000` | Port the backend listens on |
| `TELNET_HOST` | Yes* | `localhost` | MUD server hostname |
| `TELNET_PORT` | Yes* | `23` | MUD server port |
| `TELNET_TLS` | No | `false` | Use TLS for telnet |
| `SOCKET_ROOT` | Yes | `/socket.io` | Socket.IO path |
| `SOCKET_TIMEOUT` | No | `900000` | Session timeout (ms) |
| `MUD_CONFIG_PATH` | No | - | Path to `mud_config.json` for multi-MUD mode |
| `CORS_ALLOWED_ORIGINS` | No | - | Comma-separated origins for CORS |
| `LOG_LEVEL` | No | `debug` | Winston log level |
| `ENVIRONMENT` | No | `production` | `production` or `development` |
| `NAME` | No | `webmud3b` | Client name sent to MUD |

*Required unless `MUD_CONFIG_PATH` is set (then per-MUD host/port from config).

## Build Docker Images

```bash
# Default (latest)
docker build -f Dockerfile -t myonara/webmud3:latest .

# Development
docker build -f Dockerfile -t myonara/webmud3:develop .

# UNItopia Test
docker build -f dockerfiles/ng_unitopia_test.dockerfile -t myonara/webmud3:unitopiatest .
```

## Deployment Variants

### Docker Compose (recommended)

```bash
# Local development
docker compose -f dockerfiles/wm3_local_dev.yml -p webmud3dev up -d

# UNItopia Production
docker compose -f dockerfiles/w3_docker_compose.yml -p webmud3 up -d

# UNItopia Test
docker compose -f dockerfiles/w3_docker_compose_test.yml -p webmud3test up -d

# Seifenblase Production
docker compose -f dockerfiles/w3_docker_compose_sb.yml -p webmud3sb up -d

# With Apache Reverse Proxy
docker compose -f dockerfiles/w3_docker_compose_with_apache.yml -p webmud3apache up -d

# With TLS Secrets
docker compose -f dockerfiles/w3_docker_compose_secret.yml -p webmud3tls up -d
```

### Docker Swarm (legacy)

```bash
docker stack deploy -c dockerfiles/w3_docker_compose.yml webmud3a
docker stack deploy -c dockerfiles/w3_docker_compose_test.yml webmud3atest
docker stack deploy -c dockerfiles/w3_docker_compose_sb.yml webmud3sb
docker stack deploy -c dockerfiles/w3_docker_compose_local.yml webmud3alocal

# Remove a stack
docker stack rm webmud3atest
```

### Podman Compose (alternative)

```bash
podman-compose -f dockerfiles/w3_docker_compose.yml -p webmud_unitopia up -d
podman-compose -f dockerfiles/w3_docker_compose_sb.yml -p webmud_seifenblase up -d
podman-compose -f dockerfiles/w3_docker_compose_test.yml -p webmud_test up -d

# Pull new images
podman pull myonara/webmud3:latest
podman pull myonara/webmud3:unitopiatest
```

### Standalone (testing)

```bash
docker run -d -p 2018:5000 --name webmud3local myonara/webmud3:latest
```

## Compose Files Overview

| File | Deployment | Socket Path | Port |
|------|-----------|-------------|------|
| `wm3_local_dev.yml` | Local dev | `/mysocket.io` | 2018 |
| `w3_docker_compose.yml` | UNItopia prod | `/mysocket.io` | 2018 |
| `w3_docker_compose_test.yml` | UNItopia test | `/mysocket-test.io` | 2019 |
| `w3_docker_compose_sb.yml` | Seifenblase prod | `/sbsocket.io` | 2020 |
| `w3_docker_compose_local.yml` | Local standalone | `/socket.io` | 2018 |
| `w3_docker_compose_with_apache.yml` | Apache reverse proxy | `/mysocket.io` | 2018 |
| `w3_docker_compose_secret.yml` | TLS with secrets | `/mysocket.io` | 2018 |

## Angular Build Configurations

```bash
# Default (development)
ng build

# Generic production
ng build --configuration=production

# UNItopia production
ng build --configuration=production-unitopia

# Seifenblase production
ng build --configuration=production-seifenblase
```

## Diagnostic Commands

```bash
# List services
docker service ls
docker service ps --no-trunc webmud3_web

# Container logs
docker container ls
docker logs --follow <container-id>

# System logs
grep dockerd /var/log/daemon.log
```
