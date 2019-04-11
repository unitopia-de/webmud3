'use strict';

const net = require('net');

// loads module and registers app specific cleanup callback...
var cleanup = require('./cleanup').Cleanup(myCleanup);
process.stdin.resume(); // Prevents the program from closing instantly

var env = process.env.NODE_ENV || 'development'
  , cfg = require('./config/config.'+env);

console.log("START");

var mudRpc = require('./mudRpc');
var socket = net.createConnection("/run/sockets/fifo");
// var socket = new net.Socket({fd:'/run/sockets',readable:true,writeable:true});

var mudConn = new mudRpc(socket);

mudConn.on('connected', () => {
    console.log("connected");
    mudConn.emit('request','mud',['tell','test@myonara','myonara','Testnachricht-001'],function(err,resp){
        if (err) {
            console.error(err);
        } else {
            console.log(resp);
        }
    })
});

function myCleanup() {
    console.log("Cleanup starts.");
    if (typeof mudConn !== "undefined") {
        mudConn.emit('end');
        mudConn = undefined;
    }
    console.log("Cleanup ends.");
}
function myFunc(arg) {
    console.log(`arg was => ${arg}`);
}
  
setTimeout(myFunc, 5000, 'funky');

console.log("END");