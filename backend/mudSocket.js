// TODO Copyright,License...
// by myonara.

var MudSocket,TelnetSocket;

({TelnetSocket} = require('telnet-stream'));

MudSocket = class MudSocket extends TelnetSocket {

    txtToBuffer(text) {
        
        var result = [], i = 0;
        text = encodeURI(text);
        while (i < text.length) {
            var c = text.charCodeAt(i++);

            // if it is a % sign, encode the following 2 bytes as a hex value
            if (c === 37) {
                result.push(parseInt(text.substr(i, 2), 16))
                i += 2;

            // otherwise, just the actual byte
            } else {
                result.push(c)
            }
        }
        return new Buffer(result);
    }
    val16ToBuffer(result,val) {
        result.push((val & 0xff00) >> 8);
        result.push(val&0xff);
        return result;
    }
    sizeToBuffer(w,h) {
        var result = [];
        result = this.val16ToBuffer(result,w);
        result = this.val16ToBuffer(result,h);
        return new Buffer(result);
    }

  // topt: bufferSize, errorPolicy(discardBoth,keepData,keep_both)
  //       other options from stream: https://nodejs.org/api/stream.html
  constructor(_socket, topt, mopt, socket_io) {
      super(_socket,topt);
      console.log('mudSocket creating');
      this.state = {};
      this.tel = { opt2num: 
        { IAC: "255",
          DONT: "254",
          DO: "253",
          WONT: "252",
          WILL: "251",
          SB: "250",
          GA: "249",
          EL: "248",
          EC: "247",
          AYT: "246",
          AO: "245",
          IP: "244",
          BREAK: "243",
          DM: "242",
          NOP: "241",
          SE: "240",
          EOR: "239",
          ABORT: "238",
          SUSP: "237",
          SYNCH: "242",
          TELOPT_BINARY: "0",
          TELOPT_ECHO: "1",
          TELOPT_RCP: "2",
          TELOPT_SGA: "3",
          TELOPT_NAMS: "4",
          TELOPT_STATUS: "5",
          TELOPT_TM: "6",
          TELOPT_RCTE: "7",
          TELOPT_NAOL: "8",
          TELOPT_NAOP: "9",
          TELOPT_NAOCRD: "10",
          TELOPT_NAOHTS: "11",
          TELOPT_NAOHTD: "12",
          TELOPT_NAOFFD: "13",
          TELOPT_NAOVTS: "14",
          TELOPT_NAOVTD: "15",
          TELOPT_NAOLFD: "16",
          TELOPT_XASCII: "17",
          TELOPT_LOGOUT: "18",
          TELOPT_BM: "19",
          TELOPT_DET: "20",
          TELOPT_SUPDUP: "21",
          TELOPT_SUPDUPOUTPUT: "22",
          TELOPT_SNDLOC: "23",
          TELOPT_TTYPE: "24",
          TELOPT_EOR: "25",
          TELOPT_TUID: "26",
          TELOPT_OUTMRK: "27",
          TELOPT_TTYLOC: "28",
          TELOPT_NAWS: "31",
          TELOPT_TSPEED: "32",
          TELOPT_LFLOW: "33",
          TELOPT_LINEMODE: "34",
          TELOPT_XDISPLOC: "35",
          TELOPT_ENVIRON: "36",
          TELOPT_AUTHENTICATION: "37",
          TELOPT_ENCRYPT: "38",
          TELOPT_NEWENV: "39",
          TELOPT_CHARSET: "42",
          TELOPT_STARTTLS: "46",
          TELOPT_MSSP: "70",
          TELOPT_COMPRESS: "85",
          TELOPT_MSP: "90",
          TELOPT_MXP: "91",
          TELOPT_ZMP: "93",
          TELOPT_MUSHCLIENT: "102",
          TELOPT_ATCP: "200",
          TELOPT_GMCP: "201",
          TELOPT_EXOPL: "255", },
       opt2com: 
        { IAC: "/* interpret as command: */",
          DONT: "/* you are not to use option */",
          DO: "/* please, you use option */",
          WONT: "/* I won\"t use option */",
          WILL: "/* I will use option */",
          SB: "/* interpret as subnegotiation */",
          GA: "/* you may reverse the line */",
          EL: "/* erase the current line */",
          EC: "/* erase the current character */",
          AYT: "/* are you there */",
          AO: "/* abort output--but let prog finish */",
          IP: "/* interrupt process--permanently */",
          BREAK: "/* break */",
          DM: "/* data mark--for connect. cleaning */",
          NOP: "/* nop */",
          SE: "/* end sub negotiation */",
          EOR: "/* end of record (transparent mode) */",
          ABORT: "/* Abort process */",
          SUSP: "/* Suspend process */",
          SYNCH: "/* for telfunc calls */",
          TELOPT_BINARY: "/* 8-bit data path */",
          TELOPT_ECHO: "/* echo */",
          TELOPT_RCP: "/* prepare to reconnect */",
          TELOPT_SGA: "/* suppress go ahead */",
          TELOPT_NAMS: "/* approximate message size */",
          TELOPT_STATUS: "/* give status */",
          TELOPT_TM: "/* timing mark */",
          TELOPT_RCTE: "/* remote controlled transmission and echo */",
          TELOPT_NAOL: "/* negotiate about output line width */",
          TELOPT_NAOP: "/* negotiate about output page size */",
          TELOPT_NAOCRD: "/* negotiate about CR disposition */",
          TELOPT_NAOHTS: "/* negotiate about horizontal tabstops */",
          TELOPT_NAOHTD: "/* negotiate about horizontal tab disposition */",
          TELOPT_NAOFFD: "/* negotiate about formfeed disposition */",
          TELOPT_NAOVTS: "/* negotiate about vertical tab stops */",
          TELOPT_NAOVTD: "/* negotiate about vertical tab disposition */",
          TELOPT_NAOLFD: "/* negotiate about output LF disposition */",
          TELOPT_XASCII: "/* extended ascic character set */",
          TELOPT_LOGOUT: "/* force logout */",
          TELOPT_BM: "/* byte macro */",
          TELOPT_DET: "/* data entry terminal */",
          TELOPT_SUPDUP: "/* supdup protocol */",
          TELOPT_SUPDUPOUTPUT: "/* supdup output */",
          TELOPT_SNDLOC: "/* send location */",
          TELOPT_TTYPE: "/* terminal type */",
          TELOPT_EOR: "/* end or record */",
          TELOPT_TUID: "/* TACACS user identification */",
          TELOPT_OUTMRK: "/* output marking */",
          TELOPT_TTYLOC: "/* terminal location number */",
          TELOPT_NAWS: "/* window size */",
          TELOPT_TSPEED: "/* terminal speed */",
          TELOPT_LFLOW: "/* remote flow control */",
          TELOPT_LINEMODE: "/* Linemode option */",
          TELOPT_XDISPLOC: "/* X Display Location */",
          TELOPT_ENVIRON: "/* Environment opt for Port ID */",
          TELOPT_AUTHENTICATION: "/* authentication */",
          TELOPT_ENCRYPT: "/* authentication */",
          TELOPT_NEWENV: "/* Environment opt for Port ID */",
          TELOPT_CHARSET: "/* charset */",
          TELOPT_STARTTLS: "/* Transport Layer Security */",
          TELOPT_MSSP: "/* Mud Server Status Protocol */",
          TELOPT_COMPRESS: "/* Mud Compression Protocol, v.1 */",
          TELOPT_MSP: "/* Mud Sound Protocol */",
          TELOPT_MXP: "/* Mud Extension Protocol */",
          TELOPT_ZMP: "/* Zenith Mud Protocol */",
          TELOPT_MUSHCLIENT: "/* Mushclient/Aardwolf Protocol */",
          TELOPT_ATCP: "/* Achaea Telnet Client Protocol */",
          TELOPT_GMCP: "/* Generic MUD Communication Protocol */",
          TELOPT_EXOPL: "/* extended-options-list */", } ,
        num2opt: {},
        };
      for (var key in this.tel.opt2num) {
        if (this.tel.opt2num.hasOwnProperty(key) && key != "TELOPT_EXOPL") {
            this.tel.num2opt[this.tel.opt2num[key]] = key;
        }
      }
      var buf;
      this._moptions = mopt || {};
      this.debugflag = (typeof this._moptions.debugflag != 'undefined' 
            && this._moptions.debugflag
            && typeof socket_io !== 'undefined');
      console.log('MudSocket.debugflag='+this.debugflag);
      var other = this;
        super.on('close', function() {
            if (other.debugflag) {
                socket_io.emit('mud.debug',
                    {id:other._moptions.id,type:'close',data:''});
            }
        });
        super.on('command',function(chunkData) {
            const cmd = other.tel.num2opt[chunkData.toString()];
            if (other.debugflag) {
                socket_io.emit('mud.debug',
                    {id:other._moptions.id,type:'command',data:cmd});
            }
        });
        super.on('do',function(chunkData) {
            const opt = other.tel.num2opt[chunkData.toString()];
            if (other.debugflag) {
                if (opt !='TELOPT_TM') { // supress log for timemsg...
                    console.log('do:'+opt);
                }
                socket_io.emit('mud.debug',
                    {id:other._moptions.id,type:'do',data:opt});
            }
            other.state[opt] = {server:'do',client:'wont'};
            switch (opt) {
                case 'TELOPT_NAWS': 
                    other.state[opt] = {server:'do',client:'will'};
                    other.writeWill(chunkData);
                    socket_io.emit('mud-get-naws',other._moptions.id,function(sizeOb){
                        if (sizeOb === false) {
                            return;
                        }
                        buf = other.sizeToBuffer(sizeOb.width,sizeOb.height);
                        console.log('NAWS-buf:',buf,sizeOb);
                        other.writeSub(chunkData,buf);
                    })
                    break; // TODO calc windows size and report...
                case 'TELOPT_TTYPE':
                    other.state[opt] = {server:'do',client:'will'};
                    other.writeWill(chunkData);
                break;
                default: other.writeWont(chunkData); break;
            }
        });
        super.on('dont',function(chunkData) {
            const opt = other.tel.num2opt[chunkData.toString()];
            if (other.debugflag) {
                console.log('dont:'+opt);
                socket_io.emit('mud.debug',
                    {id:other._moptions.id,type:'dont',data:opt});
            }
            other.state[opt] = {server:'dont',client:'wont'};
            switch (opt) {
                default: other.writeWont(chunkData); break;
            }
        });
        super.on('will',function(chunkData) {
            const opt = other.tel.num2opt[chunkData.toString()];
            if (other.debugflag) {
                console.log('will:'+opt);
                socket_io.emit('mud.debug',
                    {id:other._moptions.id,type:'will',data:opt});
            }
            other.state[opt] = {server:'will',client:'dont'};
            switch (opt) {
                case 'TELOPT_ECHO': 
                    other.writeDo(chunkData);
                    other.state[opt].client = 'do';
                    socket_io.emit('mud-signal',{signal:'NOECHO-START',id:other._moptions.id});
                    break;
                case 'TELOPT_EOR': other.writeDont(chunkData);break;
                case 'TELOPT_GMCP':
                other.writeDo(chunkData);
                other.state[opt].client = 'do';
                socket_io.emit('mud-gmcp-start',other._moptions.id);
                break;
            default: other.writeDont(chunkData); break;
            }
        });
        super.on('wont',function(chunkData) {
            const opt = other.tel.num2opt[chunkData.toString()];
            if (other.debugflag) {
                console.log('wont:'+opt);
                socket_io.emit('mud.debug',
                    {id:other._moptions.id,type:'wont',data:opt});
            }
            other.state[opt] = {server:'wont',client:'dont'};
            switch (opt) {
                case "TELOPT_ECHO": 
                    other.writeDont(chunkData); 
                    socket_io.emit('mud-signal',{signal:'NOECHO-END',id:other._moptions.id});
                    break;                
                default: other.writeDont(chunkData); break;
            }
        });
        super.on('sub',function(optin,chunkData) {
            const opt = other.tel.num2opt[optin.toString()];
            const subInput = new Uint8Array(chunkData)
            if (opt != 'TELOPT_GMCP') {
                console.log('sub:'+opt+"|"+subInput);
            }
            switch (opt) {
                case 'TELOPT_TTYPE':
                    if (subInput.length==1 && subInput[0] == 1) { // TELQUAL_SEND
                        var nullBuf = new Buffer.alloc(1);
                        var sendBuf;
                        nullBuf[0] = 0; // TELQUAL_IS
                        buf = new Buffer('WebMud3a');
                        sendBuf = Buffer.concat([nullBuf,buf],buf.length+1);
                        console.log('TTYPE: ',sendBuf);
                        other.writeSub(optin,sendBuf);
                    }
                    break;
                case 'TELOPT_GMCP':
                    let tmpstr = chunkData.toString();
                    let ix = tmpstr.indexOf(' ');
                    let jx = tmpstr.indexOf('.');
                    let jsdata = tmpstr.substr(ix+1);
                    console.log('GMCP-incoming: ',tmpstr);
                    socket_io.emit('mud-gmcp-incoming',other._moptions.id,tmpstr.substr(0,jx),tmpstr.substr(jx+1,ix-jx),JSON.parse(jsdata));
                    break;
            }
            socket_io.emit('mud.debug',
                {id:other._moptions.id,type:'sub',option:opt,data:chunkData});
        });
        super.on('error',function(chunkData) {
            console.log('mudSocket-error:'+chunkData);
            socket_io.emit('mud.debug',
                {id:other._moptions.id,type:'error',data:chunkData});
        });
      console.log('mudSocket created');
  } // constructor...
};

module.exports = MudSocket;
