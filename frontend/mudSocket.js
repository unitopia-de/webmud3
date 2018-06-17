// TODO Copyright,License...
// by myonara.

var MudSocket,TelnetSocket;

({TelnetSocket} = require('telnet-stream'));

MudSocket = class MudSocket extends TelnetSocket {
  // topt: bufferSize, errorPolicy(discardBoth,keepData,keep_both)
  //       other options from stream: https://nodejs.org/api/stream.html
  constructor(_socket, topt, mopt, io) {
      var options;
      console.log('mudSocket creating');
      super(_socket,topt);
      this._moptions = mopt || {};
      // on debugflag additionaly send all through debug event
      if (typeof this._moptions.debugflag != 'undefined' 
            && this._moptions.debugflag
            && typeof io !== 'undefined') {
        this.on('close', function() {
          io.emit('debug',{type:'close',data:''});
        });
        this.on('command',function(chunkData) {
          io.emit('debug',{type:'command',data:chunkData});
        });
        this.on('do',function(chunkData) {
          io.emit('debug',{type:'do',data:chunkData});
        });
        this.on('dont',function(chunkData) {
            io.emit('debug',{type:'dont',data:chunkData});
        });
        this.on('will',function(chunkData) {
            io.emit('debug',{type:'will',data:chunkData});
        });
        this.on('wont',function(chunkData) {
            io.emit('debug',{type:'wont',data:chunkData});
        });
        this.on('sub',function(opt,chunkData) {
            io.emit('debug',{type:'sub',option:opt,data:chunkData});
        });
        this.on('error',function(chunkData) {
            console.log('_tsocket-error:'+chunkData);
            io.emit('debug',{type:'error',data:chunkData});
        });
      }
      console.log('mudSocket created');
  }
};

module.exports = MudSocket;
