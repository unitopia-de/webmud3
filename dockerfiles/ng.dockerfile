# based on node 8, alpine for least resource requirements.
FROM node:8-alpine AS ng-build-stage

# working dir in build stage
WORKDIR /app

# fetching packages and...
COPY UI/package*.json /app/

# ... install them together with angular-cli, prequisite git included.
RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh \
    && npm install -g @angular/cli \
    &&  npm install

# fetch the angular sources and stuff
COPY ./UI/ /app/

# ok may be we have to do more with the environment...
ARG configuration=production

# create the output of the angular app
RUN ng build --output-path=dist/out

# produces the final node.js immage.
FROM node:8-alpine AS webmud3

# again a working dir...
WORKDIR /app

# fetch the backend source files...
COPY ./backend/ /app/

#fetch the angular distribution for serving from node.js
COPY --from=ng-build-stage /app/dist/out/ /app/dist/

# and install all the dependencies.
RUN npm install

CMD node server.js
