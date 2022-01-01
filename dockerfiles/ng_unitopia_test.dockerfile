# based on node 10, alpine for least resource requirements.
FROM node:14-alpine3.14 AS ng-build-stage

# working dir in build stage
WORKDIR /app

# fetching packages and...
COPY UI13/package*.json /app/

RUN echo https://alpine.mirror.wearetriple.com/v3.14/main > /etc/apk/repositories; \
    echo https://alpine.mirror.wearetriple.com/v3.14/community >> /etc/apk/repositories

# ... install them together with angular-cli, prequisite git included.
RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh \
    && npm install -g @angular/cli \
    &&  npm install

# fetch the angular sources and stuff
COPY ./UI13/ /app/

# exchange webmud3 in baseref webmud3\UI8\src\index.html
RUN sed -i 's-%%BASEREF%%-/webmud3test/-' /app/src/index.html 
#    && sed -i 's-%%ACEREF%%-https://www.unitopia.de/webmud3test/ace/-' /app/src/index.html

# ok may be we have to do more with the environment...
ARG configuration=production

# create the output of the angular app
RUN ng build -c development --output-path=dist/out

# produces the final node.js immage.
FROM node:14-alpine3.14 AS webmud3

# again a working dir...
WORKDIR /app

# fetch the backend source files...
COPY ./backend/ /app/

#fetch the angular distribution for serving from node.js
COPY --from=ng-build-stage /app/dist/out/ /app/dist/

# change user, mkdir runs, install temporarily .gyp for sqlite 
RUN deluser --remove-home node \
    && addgroup -S node -g 3002 \
    && adduser -S -G node -u 31116 node \
    && mkdir /run/secrets \
    && mkdir /run/db \
    && npm install --only=prod \
    && chown -R node:node /app

USER node:node
CMD node server.js
