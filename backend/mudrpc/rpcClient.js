'use strict';

var net = require('net'),
    fs = require('fs')
    ;
var SOCKETFILE;
if (typeof process.env.SOCKETFILE ==='undefined') {
    SOCKETFILE = '/run/sockets/testintern2'
} else {
    SOCKETFILE = process.env.SOCKETFILE
}

var mudRpc = require('./mudRpc');

var client; //  = net.createConnection(SOCKETFILE);

var mudConn; // = new mudRpc(client);

var connected = false;

function rpcClient() {
    this.logon = function(name,pw,cb) {
        if (!connected) {
            console.log('reconnect mudRpc');
            client = net.createConnection(SOCKETFILE);
            mudConn = new mudRpc(client);
            mudConn.on('disconnected',function () {
                connected = false;
            })
            connected = true;
        }
        mudConn.emit('request','webmud3',['password',name,pw],cb);
    }
}

module.exports = new rpcClient();