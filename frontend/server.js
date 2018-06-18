'use strict';

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const http = require('http').Server(app);
const io = require('socket.io')(http);
const net = require('net');
const tls = require("tls");
const uuidv4 = require('uuid/v4');

const MudSocket = require("./mudSocket");

app.use(bodyParser.urlencoded({
    extended: true
}));

app.get('/', (req, res) => {
    // res.sendFile(__dirname + '/index.html')
    res.send('Chat Server');
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
        socket.emit('chat-message', {
            type: 'new-message',
            from: msgOb.from,
            text: msgOb.text,
            date: timeStamp
        });
    });

    socket.on('mud-connect', mudOb => {
        const id = uuidv4(); // random, unique id!
        // const tsocket = tls.connect({host:'unitopia.de',port:9988,rejectUnauthorized :false});
        const tsocket = tls.connect({host:'unitopia.de',port:992,rejectUnauthorized :false});
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
       io.emit("mud-connected",id);
       MudConnections[id] = { socket: mudSocket, mudOb: mudOb};
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
            console.log(id+' '+inpline);
            mudSocket.write(inpline.toString('utf8')+"\r");
        }
    });
    io.emit('connected');
});


http.listen(5000, () => {
    console.log('Server started on port 5000');
});
