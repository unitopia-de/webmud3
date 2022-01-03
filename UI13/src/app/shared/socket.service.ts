import { EventEmitter, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { io } from "socket.io-client";
import { GmcpService } from '../gmcp/gmcp.service';
import { MudListItem } from '../mud/mud-list-item';
import { FileInfo, MudSignals } from '../mud/mud-signals';
import { ServerConfigService } from './server-config.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService {

  private socket = undefined;
  private mudConnections = {};
  public mudnames : MudListItem[] = [];
  private socketEvents : EventEmitter<string[]> = new EventEmitter<string[]>();
  
  private getSocketID() : string {
    return this.socket.id;
  }
  
  constructor(
    private router: Router,
    private srvcfg:ServerConfigService,
    private gmcpsrv: GmcpService) { 
      if (this.socket === undefined) {
        console.info('S00: socket init');
        this.socketConnect();
      }
    }
  // Internal Socket-Connect:
  private socketConnect() {
    var other = this;
    var url = this.srvcfg.getBackend();
    var nsp = this.srvcfg.getSocketNamespace();
    console.log('S01 socket-url/nsp: ',url,nsp);
    other.socket = io(url, {'path':nsp,'transports': ['websocket']});
    other.socket.emit('keep-alive','1',function(level){
      console.log("S02 keep alive 1",other.getSocketID());
    });

    other.socket.on('error', function(error) {
      console.error('S01 socket:'+other.getSocketID()+' error:'+error);
    });
  other.socket.on('disconnecting', function(id,real_ip,server_id,cb) {
      console.info('S01 socket:'+other.getSocketID()+' disconnecting');
      other.send2AllMuds('Verbindungsabbruch durch Serverneustart (Fenster aktualisieren!)','disconnect');
      cb('disconnected');
  });
  other.socket.on('reconnect_attempt', (attemptNumber) => {
      if (typeof other.socket === 'undefined') {
        console.error('S01 undefined socket reconnect');
        return;
      }
      console.log('S01 socket:reconnect_attempt:'+attemptNumber+' '+other.getSocketID());
      if (attemptNumber == 1) {
        other.send2AllMuds('Verbindungsunterbrechung','disconnect');
        console.warn("S01 socket:reconnect: ",other.getSocketID());
      }
      return;
    });
    other.socket.on('connecting',function(id,real_ip,server_id,cb) {
      if (other.getSocketID() != id) {
        console.error('S02: connecting-unknown-id:',id);
        cb('unknown-id',undefined);
        return;
      }
      console.log("S02.connecting.serverID: ",id,other.mudConnections);
      if (!other.mudConnections.hasOwnProperty(id) ||
          other.mudConnections[id].serverID != server_id) {
        other.socket.emit("mud-disconnect",id,function(err,__id){
          if (err) {
            // other.mudConnections[id].connected = false;
            console.debug('S02-connecting: ServerID change-1: ',id,__id);
          } else{
            other.mudConnections[id].connected = false;
            console.debug('S02-connecting: ServerID change-2: ',id,__id);
          }
        });
        // // other.router.navigate([other.router.url]); // reload screen
      }
      console.debug('S02: connecting: ',id,undefined);
      cb('ok',undefined);
      // observer.next(id);
    });
    other.socket.on('connected',function(id,real_ip,server_id,cb) {
      if (other.getSocketID() != id) {
        console.error('S02: connected-unknown-id:',id);
        cb('unknown-id',undefined);
        return;
      }
      console.log("S02.connected.serverID: ",[id,other.mudConnections]);
      if (!other.mudConnections.hasOwnProperty(id) ||
          other.mudConnections[id].serverID != server_id) {
        other.socket.emit("mud-disconnect",id,function(err,__id){
          if (err) {
            // other.mudConnections[id].connected = false;
            console.debug('S02-connected: ServerID change-1: ',id,__id);
          } else{
            other.mudConnections[id].connected = false;
            console.debug('S02-connected: ServerID change-2: ',id,__id);
          }
        });
      }
      console.debug('S02: connected: ',id);
      cb('ok',undefined);
      // observer.next(id);
    });
  other.socket.emit('keep-alive','2',function(level){
    console.log("S02 keep alive 2",other.getSocketID());
  });
  // console.log("S01 socket:",other.getSocketID());
  }

  private send2AllMuds(msg : string,action:string) {
    for (var prop in this.mudConnections) {
      if( this.mudConnections.hasOwnProperty( prop ) ) {
        switch (action) {
          case 'disconnect':
              this.mudConnections[prop].connected = false;
              break;
          default:
              break;
        }
        this.socketEvents.emit([prop,msg]);
      } 
    }
  }

    /**
   * return an observable list of available muds.
   *
   * @returns {Observable<MudListItem[]>}
   * @memberof SocketService
   */
  public mudList() : Observable<MudListItem[]> {
    let other = this;
    
    let observable = new Observable<MudListItem[]>(observer => {
      if (typeof other.socket === 'undefined') {
        other.socketConnect(); 
        console.info('socket connected');
      }
      other.socket.emit('mud-list', true, function(data){
        other.mudnames = [];
        Object.keys(data).forEach(function(key) {
          var item : MudListItem = {
            key : key,
            name: data[key].name,
            host: data[key].host,
            port: data[key].port,
            ssl: data[key].ssl,
            rejectUnauthorized: data[key].rejectUnauthorized,
            description: data[key].description,
            playerlevel: data[key].playerlevel,
            mudfamily: data[key].mudfamily,
          };
          other.mudnames.push(item);
      });
        observer.next(other.mudnames);
        console.log('chattmudList: ',other.mudnames);
      });
      return () => {
        console.log('mud-list observer-complete');
      }
    });
    return observable;
  }

  /**
 * Initialization/connecting the mud according to the mudob, called by the mudclient component.
 *
 * @param {*} mudOb the mud configuration object
 * @returns {Observable<string>}
 * @memberof SocketService
 */
public mudConnect(mudOb : any) : Observable<string> {
  let other = this;
  let observable = new Observable<string>(observer => {
    if (other.socket === undefined) {
      other.socketConnect();
      console.info('S02: socket connected: '+other.getSocketID());
    } else {
      console.info('S02: socket reconnected: '+other.getSocketID());
    }
    mudOb['browser'] = other.srvcfg.getBrowserInfo();
    mudOb['client'] =  other.srvcfg.getWebmudName();
    mudOb['version']=  other.srvcfg.getWebmudVersion();
    
    other.socket.emit('mud-connect', mudOb, function(data){
      if (typeof data.id !== 'undefined') {
        if (typeof mudOb.user !== 'undefined') {
          other.mudConnections[data.id] = {
            id: data.id,
            socketID: data.socketID,
            serverID: data.serverID,
            connected: true,
            width: mudOb.width,
            height: mudOb.height,
            user: mudOb.user,
            token: mudOb.token,
            password: mudOb.password,
          }  
        } else {
          other.mudConnections[data.id] = {
            id: data.id,
            socketID: data.socketID,
            serverID: data.serverID,
            connected: true,
            width: mudOb.width,
            height: mudOb.height
          }  
        }
        console.info('S02: mud-connect: '+data.id+' socket: '+data.socketID);
        // console.debug('S02: mud-connect: ',data,'mudconn',other.mudConnections[data.id]);
        observer.next(data.id);
      } else {
        console.error('S02: mud-connect-error: ',data);
        observer.next(null);
      }
    });
    other.socket.on('mud-disconnected', function(id) {
      if (typeof other.mudConnections[id] === 'undefined') {
        console.error('S02: mud-disconnected:',id);
        observer.next(null);
        return;
      }
      other.mudConnections[id].connected = false;
      console.info('S02: mud-client disconnected-server');
      observer.next(null);
    });

    console.info('S02: socket connecting-2');
    return () => {
        observer.next(null);
    }; // disconnect
  }); // observable
  return observable;
} // mudConnect
 /**
   * Communicate the window size to mud.
   *
   * @param {string} _id  mud connection id.
   * @param {number} height height of window in character
   * @param {number} width  width of window in character
   * @returns
   * @memberof SocketService
   */
  public setMudOutputSize(_id : string,height:number,width : number) {
    if (this.socket === undefined) {
      return;
    }
    console.log('S05: resize', _id,height,width);
    this.socket.emit('mud-window-size',_id,height,width);
  }
  /**
   * disconnect on command. (not called yet)
   *
   * @param {string} _id  mudconnection id.
   * @returns {Observable<string>}
   * @memberof SocketService
   */
  public mudDisconnect(_id : string) : Observable<string> {
    let other = this;
    let observable = new Observable<string>(observer => {
      if (other.socket === undefined) {
        console.error('mudDisconnect without socket!');
        return;
      }
      console.info('mudDisconnect starting!');
      other.socket.emit('mud.disconnect', _id);
      other.socket.on('mud-disconnected', function(id) {
        if (id !== _id) {
          console.log('mud-disconnected unknown id.');
          return;
        }
        other.mudConnections[id].connected = false;
        console.info('mud-client disconnected-client');
        observer.next(_id);
        return () => {
          console.info('mudDisconnect ending!');
        }; // disconnect
      });
    });
    return observable;
  }

/**
 * returns the current status(observer of it)
 *
 * @param {string} _id  mud connection id
 * @returns {Observable<boolean>}
 * @memberof SocketService
 */
public mudConnectStatus(_id:string) : Observable<boolean> {
  let other = this;
  let observable = new Observable<boolean>(observer => {
    if (typeof other.mudConnections[_id] !== 'undefined') {
      observer.next(other.mudConnections[_id].connected);
      // console.debug('mudConnectStatus',_id, other.mudConnections[_id].connected);
    } else {
      console.warn('mudConnectStatus-w/o mudConnection',_id);
    }
  });
  return observable;
}

/**
 * sending a gmcp packet
 *
 * @param {string} id  mud connection id,
 * @param {string} mod module descriptor
 * @param {string} msg the message itself
 * @param {*} data additional data structure.
 * @returns nothing.
 * @memberof SocketService
 */
public sendGMCP(id:string,mod:string,msg:string,data:any) {
  if (typeof this.mudConnections[id] === 'undefined') {
    console.warn('G01: failed[GMCP_Send_packet].mudconn='+id);
    return;
  }
  console.debug('G01: GMCP-send:',id,mod,msg,data);
  this.socket.emit('mud-gmcp-outgoing',id,mod,msg,data);
}

public sendPing(_id : string) {
  if (this.socket === undefined) {
    console.warn('G01: Ping without socket='+_id);
    return;
  }
  this.sendGMCP(_id,'Core','Ping','');
}
/**
 * receiving data from mud via observer.
 *
 * @param {string} _id  mud connection id.
 * @returns {Observable<string>}  output strings...
 * @memberof SocketService
 */
public mudReceiveData(_id: string) : Observable<string[]> {
  let other = this;
  let observable = new Observable<string[]>(observer => {
    if (other.socket === undefined) {
      console.error('S05: mudReceiveData without socket!');
      return;
    }
    // console.debug('S05: mudReceiveData starting!');
    other.socket.on('mud-get-naws', function(id,cb) {
      if (typeof other.mudConnections[id] === 'undefined') {
        console.error('failed[mud-get-naws].mudconn='+id);
        cb(false);
        return;
      }
      if (_id !== id) {
        cb(false);
        console.info('mud-get-naws: unknown id',_id,id);
        return;
      }
      let mySize = {
        height : other.mudConnections[id].height,
        width : other.mudConnections[id].width,
      }
      console.debug('mud-get-naws: ',_id,mySize);
      cb(mySize);
    })
    other.socketEvents.subscribe(soeve => {
      console.debug('socketEvents',_id,soeve);
      if (_id == soeve[0]) {
        observer.next(['\r\n('+soeve[1]+')\r\n',undefined]);
      }
    })
    other.socket.on('mud-disconnected', function(id) {
      if (_id !== id) {
        console.info('mud-disconnected: unknown id',_id,id);
        return;
      }
      console.info('mud-disconnected: (Verbindung getrennt)',id);
      observer.next(['\r\n(Verbindung getrennt)\r\n',undefined]);
    });
    other.socket.on('mud-output', function(id,buffer) {
      if (_id !== id) {
        console.info('mud-output: unknown id',_id,id);
        return;
      }
      // console.debug('mud-output:',id,buffer);
      observer.next([buffer,undefined]);
    }); // mud-output
    return () => {
      console.info('S05: mudReceiveData ending!');
    }; // mudReceiveData ending
  }); // observable
  return observable;
} // mudReceiveData
/**
* receive signals (oberver)
*
* @param {string} _id  mud connection id
* @returns {Observable<MudSignals>} observer on signals...
* @memberof SocketService
*/
public mudReceiveSignals(_id: string) : Observable<MudSignals> {
  let other = this;
  let observable = new Observable<MudSignals>(observer => {
    if (other.socket === undefined) {
      console.error('mudReceiveSignals without socket!');
      return;
    }
    // console.info('mudReceiveSignals starting!');
    other.socket.on('mud-signal',function(sdata){
      if (sdata.id !== _id) {
        return;
      }
      let musi : MudSignals = {
        signal : sdata.signal,
        id : sdata.id,
      }
      console.log('mudReceiveSignals',musi);
      observer.next(musi);
    })
    other.socket.on('mud-gmcp-start', function(id,gmcp_support){
      if (typeof other.mudConnections[id] === 'undefined') {
        console.error('failed[mud-gmcp-incoming].mudconn='+id);
        return;
      }
      if (_id !== id) {
        console.log('mud-gmcp-start Different Ids',_id,id);
        return;
      }
      other.sendGMCP(_id,'Core','Hello',{
        'client':other.srvcfg.getWebmudName(),
        'version':other.srvcfg.getWebmudVersion()});
        other.sendGMCP(_id,'Core','BrowserInfo', {}); // Will be filled from backend, as we don't trust here...
      other.gmcpsrv.set_gmcp_support(id,gmcp_support,function (_id:string,mod:string,onoff:boolean) {
        // console.debug('other.gmcpsrv.set_gmcp_support',_id,mod,onoff);
        other.mudSwitchGmcpModule(_id,mod,onoff);
      });
      // other.sendGMCP(_id,'Core','Supports.Set',['Char 1','Char.Items 1','Comm 1','Playermap 1','Sound 1']);
      if (typeof other.mudConnections[id].user !== 'undefined') {
        other.sendGMCP(_id,'Char','Login',{
          name:other.mudConnections[id].user,
          password:other.mudConnections[id].password,
          // token:other.mudConnections[id].token,
        });
      }
    })
    other.socket.on('mud-gmcp-incoming',function(id,mod,msg,data){
      console.info("GMCP-incoming trace: ",id,mod,msg,data);
      if (typeof other.mudConnections[id] === 'undefined') {
        console.error('failed[mud-gmcp-incoming].mudconn='+id);
        return;
      }
      if (_id !== id) {
        console.log('mud-gmcp-incoming Different Ids',_id,id);
        return;
      }
      switch (mod.toLowerCase().trim()) {
        case 'core':
          switch (msg.toLowerCase().trim()) {
            case 'hello':
              other.mudConnections[_id]['gmcp-mudname'] = data.name;
              return;
            case 'goodbye':
              let goodbyeMsg : MudSignals = {
                signal: 'Core.GoodBye',
                id: data,
              }
              observer.next(goodbyeMsg);
              return;
            case 'ping':
              let pingMsg : MudSignals = {
                signal: 'Core.Ping',
                id: '',
              }
              observer.next(pingMsg);
              return;
            default:break;
          }
          break;
        case 'char':
        switch (msg.toLowerCase().trim()) {
          case 'name':
            other.mudConnections[_id]['gmcp-charname'] = data.name;
            other.mudConnections[_id]['gmcp-fullname'] = data.fullname;
            other.mudConnections[_id]['gmcp-gender'] = data.gender;
            let titleSignal : MudSignals;
            if (typeof data.wizard !== 'undefined' && data.wizard > 0) {
              other.mudConnections[_id]['gmcp-wizard'] = data.wizard;
              titleSignal = {
                signal: 'name@mud',
                id: data.name + '@' + other.mudConnections[_id]['gmcp-mudname'],
                wizard: data.wizard,
              }
              other.mudSwitchGmcpModule(_id,"Files 1",true);
            } else {
              titleSignal = {
                signal: 'name@mud',
                id: data.name + '@' + other.mudConnections[_id]['gmcp-mudname'],
              }
            }
            // console.debug('GMCP-char-name-signal: ',titleSignal);
            observer.next(titleSignal);
            return;
          case 'statusvars':
            other.mudConnections[_id]['guild-varname'] = data.guild;
            other.mudConnections[_id]['race-varname'] = data.race;
            other.mudConnections[_id]['rank-varname'] = data.rank;
            return;
          case 'status':
            other.mudConnections[_id]['guild'] = data.guild;
            other.mudConnections[_id]['race'] = data.race;
            other.mudConnections[_id]['rank'] = data.rank;
            let statusSignal : MudSignals = {
              signal:'status',
              id: other.mudConnections[_id]['guild-varname']+"="+data.guild+"|"
              + other.mudConnections[_id]['race-varname']+"="+data.race+"|"
              + other.mudConnections[_id]['rank-varname']+"="+data.rank+"|"
            };
            console.debug('GMCP-char-status-signal: ',statusSignal);
            observer.next(statusSignal);
            return;
          case 'vitals':
            let vitalSignal : MudSignals= {
              signal:'vitals',
              id:data.string+'|'+data.hp+'|'+data.maxhp+'|'+data.sp+'|'+data.maxsp
            };
            console.debug('GMCP-char-vitals-signal: ',vitalSignal);
            observer.next(vitalSignal);
            return;
          case 'stats':
            let statsSignal : MudSignals= {
              signal:'stats',
              id:'con='+data.con+'|dex='+data.dex+'|int='+data.int+'|str='+data.str
            };
            console.debug('GMCP-char-stats-signal: ',statsSignal);
            observer.next(statsSignal);
            return;
            default:break;
        }
        break;
        case 'sound':
          switch (msg.toLowerCase().trim()) {
            case 'url':
              other.mudConnections[_id]['sound-url'] = data.url;
              return;
            case 'event':
              let soundSignal : MudSignals = {
                signal: 'Sound.Play.Once',
                id: data.file,
                playSoundFile: other.mudConnections[_id]['sound-url']+'/'+data.file,
              }
              // console.debug('soundSignal',soundSignal);
              observer.next(soundSignal);
              return;
            default:
              break;
          }
          break;
        case 'files':
          switch(msg.toLowerCase().trim()) {
            case 'url': 
              let fileinfo : FileInfo = {
                lasturl : data.url,
                newfile : data.newfile,
                writeacl : data.writeacl,
                temporary : data.temporary,
                saveActive : data.saveactive,
                filesize : data.filesize,
                closable: data.closable,
                title: data.title,
                file:data.file,
                path:data.path,
                filename:data.filename,
                filetype:data.filetype,
              }
              switch (data.filetype) {
                case '.c':
                case '.h':
                case '.inc':
                  fileinfo.edditortype = 'c_cpp';
                  break;
                default:
                  fileinfo.edditortype = 'text';
                  break;
              }
              fileinfo.save01_start = function(filepath) {
                console.debug('save01_start',filepath,fileinfo);
                other.sendGMCP(_id,"Files","OpenFile",{
                  "file":filepath,
                  "title":fileinfo.title,
                  "flag":1,// save flag!!!
                });
              }
              fileinfo.save03_saved = function(filepath) {
                console.debug('save03_saved',filepath,fileinfo);
                other.sendGMCP(_id,"Files","fileSaved",{
                  "file":filepath,
                  "title":fileinfo.title,
                  "flag":1,// save flag!!!
                });
                if (fileinfo.temporary) {
                  fileinfo.save04_closing(fileinfo.windowsId);
                } else {
                  fileinfo.save06_success(fileinfo.windowsId);
                }
              }
              let fileSignal : MudSignals = {
                signal: 'Files.URL',
                id: _id,
                fileinfo: fileinfo,
              }
              // console.debug('fileSignal-1',fileSignal);
              observer.next(fileSignal);
              return;
            case 'directorylist':
              other.mudConnections[_id]['dir-current'] = data.path;
              other.mudConnections[_id]['dir-entries'] = data.entries;
              let dirSignal : MudSignals = {
                signal: 'Files.Dir',
                id: _id,
                filepath: data.path,
                entries: data.entries,
              }
              // console.debug('dirSignal-1',dirSignal);
              observer.next(dirSignal);
              return;
            default: break;
          }
        default: break;
      }
      console.warn('GMCP-unknown:',mod,msg,data);return;
    });
    // console.info('mudReceiveSignals finsihed!');
  });
  return observable;
}

public mudSendData(_id:string,data:string) {
  if (this.socket === undefined) {
    console.error('mudSendData without socket!');
    return;
  }
  // console.debug('mudSendData-id ',_id);
  // console.debug('mudSendData-data',_id,data);
  this.socket.emit('mud-input',_id,data);
}
/**
* switchgmcp module on or off.
*
* @param {string} _id  mud connection id.
* @param {string} mod  module
* @param {boolean} onoff  true on false off.
* @memberof SocketService
*/
public mudSwitchGmcpModule(_id:string,mod:string,onoff:boolean) {
  if (onoff) {
    this.sendGMCP(_id,'Core','Supports.Add',[mod]);
  } else {
    this.sendGMCP(_id,'Core','Supports.Remove',[mod]);
  }
}

}
