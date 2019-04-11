# produces the final node.js immage.
FROM node:8-alpine AS mdconn

# again a working dir...
WORKDIR /app

# fetch the backend source files...
COPY ./mdconn/ /app/

# and install all the dependencies.
RUN mkdir /run/sockets && npm install

# CMD chmod 777 /run/sockets/fifo && ls -l /run/sockets && node server.js
# CMD ls -l /run/sockets && cat /etc/passwd && cat /etc/group && node server.js
CMD ls -l /run/sockets && node server.js
