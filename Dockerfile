# based on node 10, alpine for least resource requirements.
FROM node:16-alpine3.16 AS ng-build-stage

# working dir in build stage
WORKDIR /app

# fetching packages and...
COPY UI16/package*.json /app/

RUN echo https://alpine.mirror.wearetriple.com/v3.16/main > /etc/apk/repositories; \
    echo https://alpine.mirror.wearetriple.com/v3.16/community >> /etc/apk/repositories

# ... install them together with angular-cli, prequisite git included.
RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh \
    && npm install --location=global @angular/cli \
    && npm install

# fetch the angular sources and stuff
COPY ./UI16/ /app/

# exchange webmud3 in baseref webmud3\UI8\src\index.html
# RUN sed -i 's-%%BASEREF%%-/-' /app/src/index.html 

# ok may be we have to do more with the environment...
ARG configuration=production

# create the output of the angular app
RUN ng build --configuration production --output-path=dist/out

# produces the final node.js immage.
FROM node:16-alpine3.16 AS webmud3

# again a working dir...
WORKDIR /app

# fetch the backend source files...
COPY ./backend/ /app/

#fetch the angular distribution for serving from node.js
COPY --from=ng-build-stage /app/dist/out/ /app/dist/

# mkdir runs OLD
# RUN mkdir /run/secrets \
#     && mkdir /run/db \
#     && npm install --only=prod \
#     && chown -R node:node /app

# USER node:node

# mkdir runs
RUN mkdir /run/secrets \
    && mkdir /run/db \
    && npm install --only=prod 

CMD node server.js
