# based on node 8, alpine for least resource requirements.
FROM node:10-alpine AS ng-build-stage

# working dir in build stage
WORKDIR /app

# fetching packages and...
COPY UI8/package*.json /app/

RUN echo https://alpine.mirror.wearetriple.com/v3.5/main > /etc/apk/repositories; \
    echo https://alpine.mirror.wearetriple.com/v3.5/community >> /etc/apk/repositories

# ... install them together with angular-cli, prequisite git included.
RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh \
    && npm install -g @angular/cli \
    &&  npm install

# fetch the angular sources and stuff
COPY ./UI8/ /app/

# exchange webmud3 in baseref webmud3\UI8\src\index.html
RUN sed -i 's-%%BASEREF%%-/-' /app/src/index.html && sed -i 's-%%ACEREF%%-http://localhost:2018/ace/-' /app/src/index.html 
# && cat /app/src/index.html

# ok may be we have to do more with the environment...
ARG configuration=production

# create the output of the angular app
RUN ng build --output-path=dist/out

# produces the final node.js immage.
FROM node:10-alpine AS webmud3

# again a working dir...
WORKDIR /app

# fetch the backend source files...
COPY ./backend/ /app/

# exchange mysocket.io
RUN sed -i 's=%%MYSOCKETPATH%%=/socket.io=' /app/server.js && sed -i 's=%%MYSOCKET%%=/=' /app/server.js 
# && cat /app/server.js

#fetch the angular distribution for serving from node.js
COPY --from=ng-build-stage /app/dist/out/ /app/dist/

# and install all the dependencies.
RUN mkdir /run/secrets && npm install

CMD node server.js
