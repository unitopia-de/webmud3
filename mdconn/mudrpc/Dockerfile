FROM node:alpine

ENV SOCKETFILE=/run/sockets/testintern

RUN deluser --remove-home node \
  && addgroup -S node -g 3002 \
  && adduser -S -G node -u 31116 node

WORKDIR /app
COPY *.js /app/

RUN chown -R node:node /app

USER node:node

# ls /run/sockets/* && 
CMD node testclient.js