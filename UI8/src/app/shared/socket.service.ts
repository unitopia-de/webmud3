import { Injectable, Inject, EventEmitter } from '@angular/core';
import { Observable } from 'rxjs';
import * as io from 'socket.io-client';
import { ChatMessage } from './chat-message';
import { MudListItem } from '../mud/mud-list-item';
import { MudSignals } from '../mud/mud-signals';
import { ServerConfigService } from './server-config.service';
import { GmcpService } from '../gmcp/gmcp.service';
import {NGXLoggerMonitor, NGXLogInterface,NGXLogger} from 'ngx-logger';
import { FileInfo } from '../mud/file-info';

@Injectable({
  providedIn: 'root'
})
export class SocketService implements NGXLoggerMonitor{
  onLog(logObject: NGXLogInterface): void {
    if (typeof this.socket !== 'undefined' ) {
      this.socket.emit("ngx-log-producer",logObject);
    } else {
      this.logBuffer.push(logObject);
    }
  }
  private socket = undefined;
  private consumers = {};
  private currentName : string = '';
  private mudConnections = {};
  public mudnames : MudListItem[] = [];
  public logBuffer : NGXLogInterface[] = [];
  private socketEvents : EventEmitter<string[]> = new EventEmitter<string[]>();

  private getSocketID() : string {
    return this.socket.id;
  }

  
  constructor(
    private logger : NGXLogger,
    private srvcfg:ServerConfigService,
    private gmcpsrv: GmcpService) { 
      this.logger.registerMonitor(this);// TRACE|DEBUG|INFO|LOG|WARN|ERROR|FATAL|OFF
      if (this.socket === undefined) {
        this.socketConnect();
        this.logger.info('S00: socket connected/keep alive');
      }
      this.register2cons('keep_alive');
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

  // Internal Socket-Connect:
   private socketConnect() {
     var other = this;
     var url = this.srvcfg.getBackend();
     var nsp = this.srvcfg.getSocketNamespace();
     other.logger.trace('S01 socket-url/nsp: ',url,nsp);
     other.socket = io(url, {'path':nsp,'transports': ['websocket']});

    other.socket.on('error', function(error) {
      other.logger.error('S01 socket:'+other.getSocketID()+' error:'+error);
    });
    other.socket.on('disconnecting', function(reason) {
      other.logger.info('S01 socket:'+other.getSocketID()+' disconnecting:'+reason);
    });
    other.socket.on('reconnect_attempt', (attemptNumber) => {
        if (typeof other.socket === 'undefined') {
          other.logger.fatal('S01 undefined socket reconnect');
          return;
        }
        other.logger.log('S01 socket:reconnect_attempt:'+attemptNumber+' '+other.getSocketID());
        if (attemptNumber == 1) {
          other.send2AllMuds('Verbindungsunterbrechung','disconnect');
          other.logger.warn("S01 socket:reconnect: ",other.getSocketID());
        }
        return;
    });
    const sizeLog = other.logBuffer.length;
    while (other.logBuffer.length > 0) {
      const logObject = other.logBuffer.shift()
      this.socket.emit("ngx-log-producer",logObject);
    }
    other.logger.trace("S01 socket:flush logbuffer: ",sizeLog);
  }

  // Internal registeration of all socket-consumers.
   private register2cons(cons : string) {
    if (typeof this.consumers[cons] != "undefined" 
        && this.consumers[cons]>0 ) {
      this.consumers[cons] += 1;
      this.logger.trace("+["+cons+"]="+this.consumers[cons]);
    } else {
      this.consumers[cons] = 1;
      this.logger.trace("+["+cons+"]=1");
    }
  }

  // unregister socket consumer, returns true if none left.
   private unregister2cons(cons : string) : boolean {
    if (typeof this.consumers[cons] != "undefined") {
      if (this.consumers[cons] > 1) {
        this.consumers[cons] -= 1;
        this.logger.trace("-["+cons+"]="+this.consumers[cons]);
        return false; // there are open connections
      } else {
        delete this.consumers[cons];
        let xlen = Object.keys(this.consumers).length;
        if (xlen > 0) {
          this.logger.trace("-["+cons+"]=0/"+xlen);
          return false; // still connections open.
        } else {
          this.logger.trace("-["+cons+"]=0/0");
          return true; // no more connections open.
        }
      }
    } else { // error condition: unregister without registering?
      let xlen = Object.keys(this.consumers).length;
      if (xlen > 0) {
        this.logger.trace("*["+cons+"]=0/"+xlen);
        return false; // still connections open.
      } else {
        this.logger.trace("*["+cons+"]=0/0");
        return true; // no more connections open.
      }
    }
  }
  
  /**
   * sending some chatmessage. (untested)
   *
   * @param {string} message  the message itself
   * @param {string} [name='']   the alternate name, current_name otherwise
   * @returns nothing.
   * @memberof SocketService
   */
    public sendChatMessage(message:string,name : string = '') {
    let cname : string = name;
    if (typeof message ==='undefined' || message.trim()=='') {
      return;
    }
    if (cname === '') {
      cname = this.currentName;
    }
    let msgob = { text:message,from:cname };
    this.socket.emit('add-chat-message',msgob);
    this.logger.trace('sendChatMessage:'+message+"/"+cname);
  }

  
  /**
   * get an observable for one new message
   *
   * @returns {Observable<ChatMessage>}
   * @memberof SocketService
   */
  public getChatMessages() : Observable<ChatMessage> {
    let other = this;
    let observable = new Observable<ChatMessage>(observer => {
      if (other.socket === undefined) {
        other.socketConnect();
        other.logger.info('socket connected');
      }
      other.register2cons('chat');
      other.socket.on('chat-message', (message: ChatMessage) => {
        other.logger.trace('chatt-message: ',message);
        observer.next(message);
      });
      return () => {
        if (other.unregister2cons("chat")) {
          other.socket.disconnect(); 
          other.socket = undefined;
          other.logger.info('socket disconnected');
        }
      }; // disconnect
    }); // observable
    return observable;
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
      if (other.socket === undefined) {
        other.socketConnect(); 
        other.logger.info('socket connected');
      }
      other.register2cons("mud-list");
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
        other.logger.trace('chattmudList: ',other.mudnames);
      });
      return () => {
        other.logger.trace('mud-list observer-complete');
        if (other.unregister2cons("mud-list")) {
          if (typeof other.socket !== 'undefined') other.socket.disconnect(); 
          other.socket = undefined;
          other.logger.trace('mud-list and socket disconnected-server');
        }
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
        other.logger.info('S02: socket connected: '+other.getSocketID());
      } else {
        other.logger.info('S02: socket reconnected: '+other.getSocketID());
      }
      mudOb['browser'] = other.srvcfg.getBrowserInfo();
      mudOb['client'] =  other.srvcfg.getWebmudName();
      mudOb['version']=  other.srvcfg.getWebmudVersion();
      other.register2cons('mud-client');// TODO ???
      
      other.socket.emit('mud-connect', mudOb, function(data){
        if (typeof data.id !== 'undefined') {
          if (typeof mudOb.user !== 'undefined') {
            other.mudConnections[data.id] = {
              id: data.id,
              socketID: data.socketID,
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
              connected: true,
              width: mudOb.width,
              height: mudOb.height
            }  
          }
          other.logger.info('S02: mud-connect: '+data.id+' socket: '+data.socketID);
          other.logger.trace('S02: mud-connect: ',data,'mudconn',other.mudConnections[data.id]);
          observer.next(data.id);
        } else {
          other.logger.fatal('S02: mud-connect-error: ',data);
          observer.next(null);
        }
      });
      other.socket.on('connected',function(id,real_ip,cb) {
        if (other.getSocketID() != id) {
          other.logger.error('S02: connected-unknown-id:',id);
          cb('unknown-id',mudOb);
          return;
        }
        other.logger.trace('S02: connected: ',id,mudOb);
        cb('ok',mudOb);
        // observer.next(id);
      });
      other.socket.on('mud-disconnected', function(id) {
        if (typeof other.mudConnections[id] === 'undefined') {
          other.logger.error('S02: mud-disconnected:',id);
          observer.next(null);
          return;
        }
        other.mudConnections[id].connected = false;
        if (other.unregister2cons("mud-client")) {
          if (typeof other.socket !== 'undefined') other.socket.disconnect(); 
          other.socket = undefined;
          other.logger.info('S02: mud-client and socket disconnected-server');
          observer.next(null);
        } else {
          other.logger.info('S02: mud-client disconnected-server');
          observer.next(null);
        }
      });

      other.logger.info('S02: socket connecting-2');
      return () => {
        if (other.unregister2cons("mud-client")) {
          if (typeof other.socket !== 'undefined') other.socket.disconnect(); 
          other.logger.info('S03: socket disconnected: '+other.getSocketID());
          other.socket = undefined;
          observer.next(null);
        } // if
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
    this.logger.trace('S05: resize', _id,height,width);
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
        other.logger.fatal('mudDisconnect without socket!');
        return;
      }
      other.logger.info('mudDisconnect starting!');
      other.socket.emit('mud.disconnect', _id);
      other.socket.on('mud-disconnected', function(id) {
        if (id !== _id) {
          other.logger.trace('mud-disconnected unknown id.');
          return;
        }
        other.mudConnections[id].connected = false;
        if (other.unregister2cons("mud-client")) {
          if (typeof other.socket !== 'undefined') other.socket.disconnect(); 
          other.socket = undefined;
          other.logger.info('mud-client and socket disconnected-client');
        } else {
          other.logger.info('mud-client disconnected-client');
        }
        observer.next(_id);
        return () => {
          other.logger.info('mudDisconnect ending!');
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
        other.logger.trace('mudConnectStatus',_id, other.mudConnections[_id].connected);
      } else {
        other.logger.warn('mudConnectStatus-w/o mudConnection',_id);
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
      this.logger.warn('G01: failed[GMCP_Send_packet].mudconn='+id);
      return;
    }
    this.logger.debug('G01: GMCP-send:',id,mod,msg,data);
    this.socket.emit('mud-gmcp-outgoing',id,mod,msg,data);
  }

  public sendPing(_id : string) {
    if (this.socket === undefined) {
      this.logger.warn('G01: Ping without socket='+_id);
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
        other.logger.fatal('S05: mudReceiveData without socket!');
        return;
      }
      // other.logger.trace('S05: mudReceiveData starting!');
      other.socket.on('mud-get-naws', function(id,cb) {
        if (typeof other.mudConnections[id] === 'undefined') {
          other.logger.fatal('failed[mud-get-naws].mudconn='+id);
          cb(false);
          return;
        }
        if (_id !== id) {
          cb(false);
          other.logger.info('mud-get-naws: unknown id',_id,id);
          return;
        }
        let mySize = {
          height : other.mudConnections[id].height,
          width : other.mudConnections[id].width,
        }
        other.logger.debug('mud-get-naws: ',_id,mySize);
        cb(mySize);
      })
      other.socketEvents.subscribe(soeve => {
        other.logger.debug('socketEvents',_id,soeve);
        if (_id == soeve[0]) {
          observer.next(['\r\n('+soeve[1]+')\r\n',undefined]);
        }
      })
      other.socket.on('mud-disconnected', function(id) {
        if (_id !== id) {
          other.logger.info('mud-disconnected: unknown id',_id,id);
          return;
        }
        other.logger.info('mud-disconnected: (Verbindung getrennt)',id);
        observer.next(['\r\n(Verbindung getrennt)\r\n',undefined]);
      });
      other.socket.on('mud-output', function(id,buffer) {
        if (_id !== id) {
          other.logger.info('mud-output: unknown id',_id,id);
          return;
        }
        other.logger.trace('mud-output:',id,buffer);
        observer.next([buffer,undefined]);
      }); // mud-output
      return () => {
        other.logger.info('S05: mudReceiveData ending!');
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
        other.logger.fatal('mudReceiveSignals without socket!');
        return;
      }
      other.logger.info('mudReceiveSignals starting!');
      other.socket.on('mud-signal',function(sdata){
        if (sdata.id !== _id) {
          return;
        }
        let musi : MudSignals = {
          signal : sdata.signal,
          id : sdata.id,
        }
        other.logger.trace('mudReceiveSignals',musi);
        observer.next(musi);
      })
      other.socket.on('mud-gmcp-start', function(id,gmcp_support){
        if (typeof other.mudConnections[id] === 'undefined') {
          other.logger.fatal('failed[mud-gmcp-incoming].mudconn='+id);
          return;
        }
        if (_id !== id) {
          other.logger.log('mud-gmcp-start Different Ids',_id,id);
          return;
        }
        other.sendGMCP(_id,'Core','Hello',{
          'client':other.srvcfg.getWebmudName(),
          'version':other.srvcfg.getWebmudVersion()});
          other.sendGMCP(_id,'Core','BrowserInfo', {}); // Will be filled from backend, as we don't trust here...
        other.gmcpsrv.set_gmcp_support(id,gmcp_support,function (_id:string,mod:string,onoff:boolean) {
          other.logger.trace('other.gmcpsrv.set_gmcp_support',_id,mod,onoff);
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
        if (typeof other.mudConnections[id] === 'undefined') {
          other.logger.fatal('failed[mud-gmcp-incoming].mudconn='+id);
          return;
        }
        if (_id !== id) {
          other.logger.log('mud-gmcp-incoming Different Ids',_id,id);
          return;
        }
        other.logger.debug("GMCP-incoming debug: ",mod,msg);
        other.logger.trace("GMCP-incoming trace: ",data);
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
              other.logger.debug('GMCP-char-name-signal: ',titleSignal);
              observer.next(titleSignal);
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
                other.logger.debug('soundSignal',soundSignal);
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
                  other.logger.debug('save01_start',filepath,fileinfo);
                  other.sendGMCP(_id,"Files","OpenFile",{
                    "file":filepath,
                    "title":fileinfo.title,
                    "flag":1,// save flag!!!
                  });
                }
                fileinfo.save03_saved = function(filepath) {
                  other.logger.debug('save03_saved',filepath,fileinfo);
                  other.sendGMCP(_id,"Files","fileSaved",{
                    "file":filepath,
                    "title":fileinfo.title,
                    "flag":1,// save flag!!!
                  });
                  if (fileinfo.temporary) {
                    fileinfo.save04_closing(fileinfo.windowsId);
                  } else {
                    fileinfo.save06_success(fileinfo.save06_success);
                  }
                }
                let fileSignal : MudSignals = {
                  signal: 'Files.URL',
                  id: _id,
                  fileinfo: fileinfo,
                }
                other.logger.trace('fileSignal-1',fileSignal);
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
                other.logger.trace('dirSignal-1',dirSignal);
                observer.next(dirSignal);
                return;
                default: break;
            }
          default: break;
        }
        other.logger.warn('GMCP-unknown:',mod,msg,data);return;
      });
    });
    return observable;
  }

  public mudSendData(_id:string,data:string) {
    if (this.socket === undefined) {
      this.logger.fatal('mudSendData without socket!');
      return;
    }
    // this.logger.debug('mudSendData-id ',_id);
    // this.logger.trace('mudSendData-data',_id,data);
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
