'use strict';

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const http = require('http').Server(app);
const io = require('socket.io')(http);  
const net = require('net');
const tls = require("tls");
const uuidv4 = require('uuid/v4');
const dbio = require('socket.io-client');
var env = process.env.NODE_ENV || 'development'
  , cfg = require('./config/config.'+env);
  var dbsocket;

  if (cfg.other.storage.active) {
      dbsocket = dbio.connect(cfg.other.storage.url, {reconnect: true});
  }
  dbsocket = dbio.connect(cfg.other.storage.url, {reconnect: true});
  

const MudSocket = require("./mudSocket");

app.use(bodyParser.urlencoded({
    extended: true
}));

app.get('/', (req, res) => {
    // res.sendFile(__dirname + '/index.html')
    res.send('Chat Server');
    // TODO provide UI.dist
})


io.on('connection', (socket) => {

    console.log('user connected');
    var MudConnections = {};

    socket.on('disconnect', function () {
        // TODO disconnect all mudclients...
        console.log('user disconnected');
    });

    socket.on('add-message', (message) => {
        const timeStamp = new Date().getTime();
        io.emit('message', {
            type: 'new-message',
            text: message,
            date: timeStamp
        });
    });

    socket.on('add-chat-message', (msgOb) => {
        const timeStamp = new Date().getTime();
        const chatOB = {
            type: 'new-message',
            from: msgOb.from,
            text: msgOb.text,
            date: timeStamp
        };
        if (cfg.other.storage.active) {
            dbsocket.emit('chat-message', chatOB);
        }
        socket.emit('chat-message', chatOB);
    });

    socket.on("mud-list", function(data,callback) {
        callback(cfg.muds);
    });

    socket.on('mud-connect', function(mudOb,callback)  {
        const id = uuidv4(); // random, unique id!
        var tsocket,mudcfg;
        if (typeof mudOb.mudname === 'undefined') {
            callback({error:'Missing mudname'});
            return;
        }
        if (cfg.muds.hasOwnProperty(mudOb.mudname)) {
            mudcfg = cfg.muds[mudOb.mudname];
            console.log(mudOb.mudname);
        } else {
            callback({error:'Unknown mudname'+mudOb.mudname});
            return;
        }
        try {
            if (mudcfg.ssl === true) {
                console.log("TRY SSL with reject="+mudcfg.rejectUnauthorized);
                tsocket = tls.connect({
                    host:mudcfg.host,
                    port:mudcfg.port,
                    rejectUnauthorized :mudcfg.rejectUnauthorized});
            } else {
                console.log("TRY w/o SSL:");
                tsocket = net.createConnection({
                    host:mudcfg.host,
                    port:mudcfg.port});
            }
            const mudSocket = new MudSocket(tsocket,undefined,{debugflag:true,io:io});
            mudSocket.on("close",function(){
            io.emit("mud-disconnected",id);
            });
            mudSocket.on("data", function(buffer){
            io.emit("mud-output",id,buffer.toString("utf8"));
            });
            mudSocket.on("debug", function(dbgOb){
            io.emit("mud-debug",id,dbgOb);
            });
            MudConnections[id] = { socket: mudSocket, mudOb: mudOb};
            callback({id:id});
        } catch (error) {
            console.log(error.message);
            callback({error:error.toString('utf8')});
        }
    });

    socket.on('mud-disconnect', id => {
        if (typeof id !== 'string' || typeof MudConnections[id] === 'undefined') {
            io.emit("mud-error","Connection-id unknown");
            return;
        }
        const mudConn = MudConnections[id];
        const mudSocket = mudConn.socket;
        // const mudOb = mudConn.mudOb;
        mudSocket.end();
        io.emit("mud-disconnected",id);
        delete MudConnections[id];
    });
    socket.on('mud-input', (id,inpline) => {
        if (typeof id !== 'string' || typeof MudConnections[id] === 'undefined') {
            io.emit("mud-error","Connection-id unknown");
            return;
        }
        const mudConn = MudConnections[id];
        const mudSocket = mudConn.socket;
        // const mudOb = mudConn.mudOb;
        if (typeof inpline !== 'undefined' && inpline !== null) {
            mudSocket.write(inpline.toString('utf8')+"\r");
        }
    });
    io.emit('connected');
});


http.listen(5000, () => {
    console.log('Server\'frontend\' started on port 5000');
});