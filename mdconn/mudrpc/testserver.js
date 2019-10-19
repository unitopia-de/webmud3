// echo server. on socket..

'use strict';

console.log("START testserver: "+process.env.SOCKETFILE);
var SOCKETFILE;
if (typeof process.env.SOCKETFILE ==='undefined') {
    SOCKETFILE = '/run/sockets/testintern2'
} else {
    SOCKETFILE = process.env.SOCKETFILE
}

var net = require('net'),
    fs = require('fs'),
    connections = {},
    server
    ;


function createServer(socket){
    console.log('Creating server.');
    var server = net.createServer(function(stream) {
        console.log('Connection acknowledged.');

        // Store all connections so we can terminate them if the server closes.
        // An object is better than an array for these.
        var self = Date.now();
        let buffer = '';
        connections[self] = (stream);
        stream.on('end', function() {
            console.log('Client disconnected.');
            delete connections[self];
        });

        stream.on('data', function(msg) {
            buffer += msg;
            let boundary = buffer.indexOf('\n');
            while (boundary !== -1) {
                const input = buffer.substring(0, boundary);
                console.log(input);
                buffer = buffer.substring(boundary + 1);
                stream.write(buffer);
                // this.emit('message', JSON.parse(input));
                boundary = buffer.indexOf('\n');
            }
        });
    })
    .listen(socket)
    .on('connection', function(socket){
        console.log('Client connected.');
        //console.log(Object.keys(socket));
    })
    ;
    return server;
}

console.log('Checking for leftover socket.');
    fs.stat(SOCKETFILE, function (err, stats) {
        if (err) {
            // start server
            console.log('No leftover socket found.');
            server = createServer(SOCKETFILE); return;
        }
        // remove file then start server
        console.log('Removing leftover socket.')
        fs.unlink(SOCKETFILE, function(err){
            if(err){
                // This should never happen.
                console.error(err); process.exit(0);
            }
            server = createServer(SOCKETFILE); return;
        });  
    });

    // close all connections when the user does CTRL-C
    function cleanup(){
        if(!SHUTDOWN){ SHUTDOWN = true;
            console.log('\n',"Terminating.",'\n');
            if(Object.keys(connections).length){
                let clients = Object.keys(connections);
                while(clients.length){
                    let client = clients.pop();
                    connections[client].write('__disconnect');
                    connections[client].end(); 
                }
            }
            server.close();
            process.exit(0);
        }
    }
    process.on('SIGINT', cleanup);

