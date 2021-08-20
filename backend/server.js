'use strict';

// loads module and registers app specific cleanup callback...
var cleanup = require('./cleanup').Cleanup(myCleanup);
process.stdin.resume(); // Prevents the program from closing instantly

var env = process.env.NODE_ENV || 'development'
  , cfg = require('./config/config.'+env);

const fs = require('fs');
var scfgfile = process.env.SECRET_CONFIG || '/run/secret_sauce.json',scfg;
try {
    scfg = JSON.parse(fs.readFileSync(scfgfile, 'utf8'));
} catch (error) {
    console.warn('secret config error',error);
    scfg = {
        env : 'local',
        mySocketPath : '/socket.io',
        mySocket : '/',
        mySessionKey : "FyD32AnErszbmmU3sjTz",
        myLogDB : undefined,
    }
}

if (typeof scfg.myLogDB !== 'undefined') {
    process.env.MY_LOG_DB = scfg.myLogDB;
}


const logger = require('./ngxlogger/ngxlogger');
const express = require('express');
const session = require('express-session');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');

/* const cors = require('cors');
var corsOptions = {
    origin: function (origin, callback) {
        console.log("origin: ["+new Date().toUTCString()+"]: ",origin);
        callback(null, true);
        return;
      if (cfg.whitelist.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    }
  } */
// app.use(cors(corsOptions));
var http;
var options;
if (cfg.tls) {
    options = {
        key: fs.readFileSync(cfg.tls_key),
        cert: fs.readFileSync(cfg.tls_cert)
      };
    http = require('https').Server(options,app);
    console.log("INIT: https active");
    logger.addAndShowLog('SRV://5000',"DEBUG",'INIT: https active',[]);
} else {
    http = require('http').Server(app);
}
//const io = require('socket.io')(http,{'path':'/socket.io','transports': ['websocket']});
const io = require('socket.io')(http,{'path':scfg.mySocketPath,'transports': ['websocket']});
// io.set('origins', cfg.whitelist);
const net = require('net');
const tls = require("tls");
const { v4: uuidv4 } = require('uuid');
const UNIQUE_SERVER_ID = uuidv4(); // changes per install!

const MudSocket = require("./mudSocket");

// For being able to read request bodies
app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: scfg.mySessionKey,
    resave: false,
    saveUninitialized: true
  }));

app.get('/socket.io-client/dist/*', (req,res) => {
    var mypath = req.path.substr(0);
    var ip = req.headers['x-forwarded-for'] || 
     req.connection.remoteAddress || 
     req.socket.remoteAddress ||
     (req.connection.socket ? req.connection.socket.remoteAddress : null);
    logger.addAndShowLog('SRV:'+ip,"DEBUG",'socket-Path:',[mypath]);
    res.sendFile(path.join(__dirname, 'node_modules'+mypath));
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get("/ace/*", (req,res) => {
    var ip = req.headers['x-forwarded-for'] || 
     req.connection.remoteAddress || 
     req.socket.remoteAddress ||
     (req.connection.socket ? req.connection.socket.remoteAddress : null);
    var mypath = req.path.substr(5);
    logger.addAndShowLog('SRV:'+ip,"DEBUG",'ace-Path:',[mypath]);
    res.sendFile(path.join(__dirname, 'node_modules/ace-builds/src-min-noconflict/'+mypath));
});

const authRoutes = require("./mudrpc/authRoutes");
app.use("/api/auth",authRoutes);

app.get('*', (req, res) => {
    var ip = req.headers['x-forwarded-for'] || 
     req.connection.remoteAddress || 
     req.socket.remoteAddress ||
     (req.connection.socket ? req.connection.socket.remoteAddress : null);
    logger.addAndShowLog('SRV:'+ip,"DEBUG",'dist/index.html-Path:',[req.path]);
    res.sendFile(path.join(__dirname, 'dist/index.html'));
  });

var MudConnections = {};
var Socket2Mud = {};

// io.of('/').on('connection', (socket) => { // nsp /mysocket.io/ instead of /
io.of(scfg.mySocket).on('connection', (socket) => { // nsp /mysocket.io/ instead of /
    const address = socket.handshake.address;
    const real_ip = socket.handshake.headers['x-forwarded-for'] || address;
    //console.log('S01-socket:'+socket.id+' user connected: ',real_ip);
    logger.addAndShowLog('SRV:'+real_ip,"LOG",'S01-socket user connected',[socket.id]);

    socket.on('disconnect', function () {
        // TODO disconnect all mudclients...
        logger.addAndShowLog('SRV:'+real_ip,"INFO",'S01-socket user disconnected',[socket.id]);
        if (typeof Socket2Mud === 'undefined' || 
            typeof Socket2Mud[socket.id] === 'undefined') {
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
                    logger.addAndShowLog('SRV:'+real_ip,"ERROR",'S01-socket socket-disconnect-mudOb',[socket.id,mudOb]);
                }
            }
            delete MudConnections[id];
        });
        delete Socket2Mud[socket.id];
    });
    socket.on('error', function(error) {
        logger.addAndShowLog('SRV:'+real_ip,"ERROR",'S01-socket error',[socket.id,error]);
    });
    socket.on('disconnecting', function(reason) {
        logger.addAndShowLog('SRV:'+real_ip,"INFO",'S01-socket disconnecting',[socket.id,reason]);
    });
    socket.on('reconnect_attempt', (attemptNumber) => {
        logger.addAndShowLog('SRV:'+real_ip,"INFO",'S01-socket reconnect_attempt',[socket.id,attemptNumber]);
    });
    socket.on("keep-alive",function(level,callback){
        logger.addAndShowLog('SRV:'+real_ip,"INFO",'S01-socket keep alive ',[socket.id,level]);
        callback(level);
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
            logger.addAndShowLog('SRV:'+real_ip,"FATAL",'Undefined mudname',[socket.id,mudOb]);
            callback({error:'Missing mudname'});
            return;
        }
        if (cfg.muds.hasOwnProperty(mudOb.mudname)) {
            mudcfg = cfg.muds[mudOb.mudname];
        } else {
            logger.addAndShowLog('SRV:'+real_ip,"FATAL",'Unknown mudnameUnknown mudname',[socket.id,mudOb]);
            return;
        }
        mudOb.real_ip = real_ip;
        var gmcp_support = undefined;
        var charset = 'ascii';
        if (mudcfg.hasOwnProperty('mudfamily')) {
            if (cfg.hasOwnProperty('mudfamilies') && typeof cfg.mudfamilies[mudcfg.mudfamily] !== 'undefined') {
                var fam = cfg.mudfamilies[mudcfg.mudfamily];
                if (typeof fam.GMCP !== 'undefined' && fam.GMCP === true && typeof fam.GMCP_Support !== 'undefined') {
                    gmcp_support = fam.GMCP_Support;
                    gmcp_support['mudfamily'] = mudcfg.mudfamily;
                }
                charset = fam.charset;
            }
        }
        try {
            logger.addAndShowLog('SRV:'+real_ip,"INFO",'S02-socket-open',[socket.id,mudcfg]);
            if (mudcfg.ssl === true) {
                tsocket = tls.connect({
                    host:mudcfg.host,
                    port:mudcfg.port,
                    rejectUnauthorized :mudcfg.rejectUnauthorized});
            } else {
                tsocket = net.createConnection({
                    host:mudcfg.host,
                    port:mudcfg.port});
            }
            const mudSocket = new MudSocket(tsocket,{bufferSize:65536},{debugflag:true,id:id,gmcp_support:gmcp_support,charset:charset},socket);
            mudSocket.on("close",function(){
                logger.addAndShowLog('SRV:'+real_ip,"DEBUG",'mud-disconnect=>close',[socket.id]);
                socket.emit("mud-disconnected",id);
            });
            mudSocket.on("data", function(buffer){
                socket.emit("mud-output",id,buffer.toString("utf8"));
            });
            mudSocket.on("debug", function(dbgOb){
                logger.addAndShowLog('SRV:'+real_ip,"DEBUG",'mud-debug',[socket.id,dbgOb]);
            });
            MudConnections[id] = { socket: mudSocket, mudOb: mudOb,socketID:socket.id};
            if (typeof Socket2Mud[socket.id] === 'undefined') {
                Socket2Mud[socket.id] = [id];
            } else {
                Socket2Mud[socket.id].push[id];
            }
            logger.addAndShowLog('SRV:'+real_ip,"INFO",'S02-socket mud-connect:',[socket.id,mudOb]);
            callback({id:id,socketID:socket.id,serverID:UNIQUE_SERVER_ID});
        } catch (error) {
            logger.addAndShowLog('SRV:'+real_ip,"ERROR",'mud-connect catch',[socket.id,error]);
            callback({error:error.toString('utf8')});
        }
    });

    socket.on('mud-window-size', (id,height,width) => {
        if (typeof id !== 'string' || typeof MudConnections[id] === 'undefined') {
            logger.addAndShowLog('SRV:'+real_ip,"ERROR",'mud-window-size MudConn undefined',[id]);
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
        logger.addAndShowLog('SRV:'+real_ip,"TRACE",'NAWS-buf',[buf,width,height]);
        mudSocket.writeSub(31 /*TELOPT_NAWS*/, buf);
    });

    socket.on('mud-disconnect', id => {
        if (typeof id !== 'string' || typeof MudConnections[id] === 'undefined') {
            logger.addAndShowLog('SRV:'+real_ip,"ERROR",'mud-disconnect MudConn undefined',[id]);
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
        logger.addAndShowLog('SRV:'+real_ip,"INFO",'mud-disconnected',[socket.id,mudOb]);
        socket.emit("mud-disconnected",id);
        delete MudConnections[id];
    });
    socket.on('mud-input', (id,inpline) => {
        if (typeof id !== 'string' || typeof MudConnections[id] === 'undefined') {
            logger.addAndShowLog('SRV:'+real_ip,"ERROR",'mud-input MudConn undefined',[id]);
            return;
        }
        const mudConn = MudConnections[id];
        const mudSocket = mudConn.socket;
        const mudOptions = mudSocket._moptions;
        // console.log('mudConn: ',mudConn);
        // console.log('mudSocket: ',mudSocket);
        // console.log('mudOptions: ',mudOptions);
        if (typeof inpline !== 'undefined' && inpline !== null) {
            mudSocket.write(inpline.toString(mudOptions.charset)+"\r\n");
            logger.addAndShowLog('SRV:'+real_ip,"TRACE",'mud-input',[inpline]);
        }
    });
    socket.on('mud-gmcp-outgoing', (id,mod,msg,data) => {
        if (typeof id !== 'string' || typeof MudConnections[id] === 'undefined') {
            logger.addAndShowLog('SRV:'+real_ip,"ERROR",'mud-gmcp-outgoing MudConn undefined',[id]);
            return;
        }
        const mudConn = MudConnections[id];
        const mudSocket = mudConn.socket;
        const gheader = ''+mod+'.'+msg+' ';
        var mudOb = mudConn.mudOb;
        if (gheader.toLowerCase()=='core.browserinfo ') {
            data = mudOb.browser;
            data['client'] =mudOb['client'];
            data['version']=mudOb['version'];
            data['real_ip'] = real_ip;
        }
        const jsdata = JSON.stringify(data);
        let b1 = Buffer.from(gheader);
        let b2 = Buffer.from(jsdata);
        let buf = Buffer.concat([b1,b2],b1.length+b2.length);
        logger.addAndShowLog('SRV:'+real_ip,"DEBUG",'mud-gmcp-outgoing',[socket.id,mod,msg,data]);
        mudSocket.writeSub(201 /*TELOPT_GMCP*/, buf);
    });

    /*
{ message: 'mud-output:',
  additional:
   [ '79c63aaf-8535-4c22-ae4d-b3ccd0593d47',
     'Tip: Bei Einstellungen Untermenue Zauberstab kann man sich den zuletzt\r\n        gelesenen Fehler merken lassen. Hat man den Fehler untersucht oder\r\n        bearbeitet, kann man dort wieder einsteigen und Kommentare\r\n        absetzen, oder als erledigt loeschen bzw. ins zugehoerige Done\r\n        verschieben.\r\n' ],
  level: 0,
  timestamp: '2019-10-13T07:12:34.943Z',
  fileName: './src/app/shared/socket.service.ts',
  lineNumber: '480',
  real_ip: '2003:c6:b707:9b00:a924:3e18:56b4:867' }
2019-10-13T07:12:34.943Z TRACE [./src/app/shared/socket.service.ts:480] mud-output: 79c63aaf-8535-4c22-ae4d-b3ccd0593d47 Tip: Bei Einstellungen Untermenue Zauberstab kann man sich den zuletzt
        gelesenen Fehler merken lassen. Hat man den Fehler untersucht oder
        bearbeitet, kann man dort wieder einsteigen und Kommentare
        absetzen, oder als erledigt loeschen bzw. ins zugehoerige Done
        verschieben.
 */
    socket.on("ngx-log-producer", (log)=> {
        log['real_ip'] = real_ip;
        logger.addLogEntry(log);
        logger.log2console(log);
    });
    socket.emit('connected',socket.id,real_ip,UNIQUE_SERVER_ID,function(action,oMudOb) {
        logger.addAndShowLog('SRV:'+real_ip,"INFO",'S02-connected:',[action,oMudOb]);
    });
});

function myCleanup() {
    console.log("Cleanup starts.");
    if (typeof MudConnections !== "undefined") {
        for (var key in MudConnections) {
            // skip loop if the property is from prototype
            if (!MudConnections.hasOwnProperty(key)) continue;
            // get object.
            var obj = MudConnections[key];
            // disconnect gracefully.
            obj.socket.end();
            // message to all frontends...
            io.emit("mud-disconnected",key);
        }
    }
    console.log("Cleanup ends.");
}

http.listen(5000, () => {
    // logger.addAndShowLog
    console.log('SRV//:5000',"INFO",'INIT: Server\'backend\' started on port 5000:',UNIQUE_SERVER_ID);
});

