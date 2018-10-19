'use strict';

var env = process.env.NODE_ENV || 'development'
  , cfg = require('./config/config.'+env);

const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const cors = require('cors');
var corsOptions = {
    origin: function (origin, callback) {
        console.log("origin: ",origin);
        callback(null, true);
        return;
      if (cfg.whitelist.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    }
  }
app.use(cors(corsOptions));
var http;
var options;
if (cfg.tls) {
    options = {
        key: fs.readFileSync(cfg.tls_key),
        cert: fs.readFileSync(cfg.tls_cert)
      };
    http = require('https').Server(options,app);
} else {
    http = require('http').Server(app);
}
const io = require('socket.io')(http);  
io.set('origins', cfg.whitelist);
const net = require('net');
const tls = require("tls");
const uuidv4 = require('uuid/v4');

const MudSocket = require("./mudSocket");

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
  });

var MudConnections = {};
var Socket2Mud = {};

io.on('connection', (socket) => {

    console.log('socket:'+socket.id+' user connected');

    socket.on('disconnect', function () {
        // TODO disconnect all mudclients...
        console.log('socket:'+socket.id+' user disconnected');
        if (typeof Socket2Mud === 'undefined') {
            return
        }
        Socket2Mud[socket.id].forEach(function(id) {
            var mudSocket,mudOb;
            var mudConn = MudConnections[id];
            if (typeof mudConn !== 'undefined') {
                mudSocket = mudConn.socket;
                if (typeof mudSocket !=='undefined') {
                    mudSocket.end();
                }
                mudOb = mudConn.mudOb;
                if (typeof mudOb !== 'undefined') {
                    console.log('socket:'+socket.id+' socket-disconnet-mudOb ',mudOb);
                }
            }
            delete MudConnections[id];
        });
        delete Socket2Mud[socket.id];
    });
    socket.on('error', function(error) {
        console.log('socket:'+socket.id+' error:'+error);
    });
    socket.on('disconnecting', function(reason) {
        console.log('socket:'+socket.id+' disconnecting:'+reason);
    });
    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('socket:'+socket.id+' reconnect_attempt:'+attemptNumber);
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
            console.log('socket:'+socket.id+' Mud: '+mudOb.mudname);
        } else {
            callback({error:'Unknown mudname: '+mudOb.mudname});
            return;
        }
        try {
            if (mudcfg.ssl === true) {
                console.log('socket:'+socket.id+' TRY SSL with reject='
                       +mudcfg.rejectUnauthorized);
                tsocket = tls.connect({
                    host:mudcfg.host,
                    port:mudcfg.port,
                    rejectUnauthorized :mudcfg.rejectUnauthorized});
            } else {
                console.log('socket:'+socket.id+' TRY w/o SSL:');
                tsocket = net.createConnection({
                    host:mudcfg.host,
                    port:mudcfg.port});
            }
            const mudSocket = new MudSocket(tsocket,undefined,{debugflag:true,id:id},socket);
            mudSocket.on("close",function(){
            io.emit("mud-disconnected",id);
            });
            mudSocket.on("data", function(buffer){
            io.emit("mud-output",id,buffer.toString("utf8"));
            });
            mudSocket.on("debug", function(dbgOb){
            io.emit("mud-debug",id,dbgOb);
            });
            MudConnections[id] = { socket: mudSocket, mudOb: mudOb,socketID:socket.id};
            if (typeof Socket2Mud[socket.id] === 'undefined') {
                Socket2Mud[socket.id] = [id];
            } else {
                Socket2Mud[socket.id].push[id];
            }
            console.log('socket:'+socket.id+' connect-mudOb: ',mudOb);
            callback({id:id,socketID:socket.id});
        } catch (error) {
            console.log('socket:'+socket.id+' error: '+error.message);
            callback({error:error.toString('utf8')});
        }
    });

    socket.on('mud-window-size', (id,height,width) => {
        if (typeof id !== 'string' || typeof MudConnections[id] === 'undefined') {
            io.emit("mud-error","Connection-id unknown");
            return;
        }
        const mudConn = MudConnections[id];
        const mudSocket = mudConn.socket;
        var mudOb = mudConn.mudOb;
        if (mudOb.height == height && mudOb.width == width) {
            return;
        } else {
            mudOb.height = height;
            mudOb.width = width;
            MudConnections[id].mudOb = mudOb;
        }
        var buf = mudSocket.sizeToBuffer(width,height);
        console.log('NAWS-buf:',buf,width,height);
        mudSocket.writeSub(31 /*TELOPT_NAWS*/, buf);
    });

    socket.on('mud-disconnect', id => {
        if (typeof id !== 'string' || typeof MudConnections[id] === 'undefined') {
            io.emit("mud-error","Connection-id unknown");
            return;
        }
        const mudConn = MudConnections[id];
        const mudSocket = mudConn.socket;
        const mudOb = mudConn.mudOb;
        mudSocket.end();
        Socket2Mud[socket.id] = Socket2Mud[socket.id].filter(mid => mid != id);
        if (Socket2Mud[socket.id].length == 0) {
            delete Socket2Mud[socket.id];
        }
        console.log('socket:'+socket.id+' mud-disconnect-mudOb: ',mudOb);
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
    socket.on('mud-gmcp-outgoing', (id,mod,msg,data) => {
        if (typeof id !== 'string' || typeof MudConnections[id] === 'undefined') {
            io.emit("mud-error","Connection-id unknown");
            return;
        }
        const mudConn = MudConnections[id];
        const mudSocket = mudConn.socket;
        const jsdata = JSON.stringify(data);
        let b1 = new Buffer(mod+'.'+msg+' ');
        let b2 = new Buffer(jsdata);
        let buf = Buffer.concat([b1,b2],b1.length+b2.length);
        console.log('socket:'+socket.id+' ',mod,msg,data);
        mudSocket.writeSub(201 /*TELOPT_GMCP*/, buf);
    });

    io.emit('connected');
});


http.listen(5000, () => {
    console.log('Server\'backend\' started on port 5000');
});