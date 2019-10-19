'use strict';

console.log("START tetclient:"+process.env.SOCKETFILE);

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

var client = net.createConnection(SOCKETFILE);

var mudConn = new mudRpc(client);

mudConn.on('connected', () => {
    console.log("connected");
    mudConn.emit('request','mud',['tell','test','myonara','Testnachricht-001'],function(err,resp){
        if (err) {
            console.error(err);
        } else {
            console.log(resp);
        }
    })
});

mudConn.on('message', (data) => {
    console.log ('message',data);
})

mudConn.on('error',(error)=>{
    console.error('error',error);
})

function cleanup(){
    if(!SHUTDOWN){ SHUTDOWN = true;
        console.log('\n',"Terminating.",'\n');
        client.end();
        process.exit(0);
    }
}
process.on('SIGINT', cleanup);
