import { Injectable, Inject } from '@angular/core';
import { WINDOW } from './WINDOW_PROVIDERS';
import { Observable } from 'rxjs';
import * as io from 'socket.io-client';
import { ChatMessage } from './chat-message';
import { LoggerService } from './logger.service';
import { DebugData } from '../mud/debug-data';
import { MudListItem } from '../mud/mud-list-item';
// import { MudConnection } from './mud-connection';
import { MudSignals } from '../mud/mud-signals';
import { ServerConfigService } from './server-config.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket = undefined;
  private consumers = {};
  private currentName : string = '';
  private mudConnections = {};
  public mudnames : MudListItem[] = [];

  // Internal Socket-Connect:
   private socketConnect() {
     var other = this;
     var url = this.srvcfg.getBackend();
     other.socket = io(url); 
    
    other.socket.on('error', function(error) {
      console.log('socket:'+other.socket.id+' error:'+error);
    });
    other.socket.on('disconnecting', function(reason) {
        console.log('socket:'+other.socket.id+' disconnecting:'+reason);
    });
    other.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('socket:'+other.socket.id+' reconnect_attempt:'+attemptNumber);
        other.socket.disconnect();
        other.socket = undefined;
        other.logger.add('socket disconnected by reconnect.',false);
    });
   }

  // Internal registeration of all socket-consumers.
   private register2cons(cons : string) {
    if (typeof this.consumers[cons] != "undefined" 
        && this.consumers[cons]>0 ) {
      this.consumers[cons] += 1;
      this.logger.add("+["+cons+"]="+this.consumers[cons],false);
    } else {
      this.consumers[cons] = 1;
      this.logger.add("+["+cons+"]=1",false);
    }
  }

  // unregister socket consumer, returns true if none left.
   private unregister2cons(cons : string) : boolean {
    if (typeof this.consumers[cons] != "undefined") {
      if (this.consumers[cons] > 1) {
        this.consumers[cons] -= 1;
        this.logger.add("-["+cons+"]="+this.consumers[cons],false);
        return false; // there are open connections
      } else {
        delete this.consumers[cons];
        let xlen = Object.keys(this.consumers).length;
        if (xlen > 0) {
          this.logger.add("-["+cons+"]=0/"+xlen,false);
          return false; // still connections open.
        } else {
          this.logger.add("-["+cons+"]=0/0",false);
          return true; // no more connections open.
        }
      }
    } else { // error condition: unregister without registering?
      let xlen = Object.keys(this.consumers).length;
      if (xlen > 0) {
        this.logger.add("*["+cons+"]=0/"+xlen,true);
        return false; // still connections open.
      } else {
        this.logger.add("*["+cons+"]=0/0",true);
        return true; // no more connections open.
      }
    }
  }
  
  // send a chat message to the server, connected with a name.
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
    this.logger.add('sendChatMessage:'+message,false);
  }

  // get an observable for one new message.
  public getChatMessages() : Observable<ChatMessage> {
    let other = this;
    let observable = new Observable<ChatMessage>(observer => {
      if (other.socket === undefined) {
        other.socketConnect();
        other.logger.add('socket connected',false);
      }
      other.register2cons('chat');
      other.socket.on('chat-message', (message: ChatMessage) => {
        observer.next(message);
      });
      return () => {
        if (other.unregister2cons("chat")) {
          other.socket.disconnect(); 
          other.socket = undefined;
          other.logger.add('socket disconnected',false);
        }
      }; // disconnect
    }); // observable
    return observable;
  }

  public mudList() : Observable<MudListItem[]> {
    let other = this;
    let observable = new Observable<MudListItem[]>(observer => {
      if (other.socket === undefined) {
        other.socketConnect(); 
        other.logger.add('socket connected',false);
      }
      other.register2cons("mud-list");
      other.socket.emit('mud-list', true, function(data){
        other.mudnames = [];
        Object.keys(data).forEach(function(key) {
          const item : MudListItem = {
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
      });
      return () => {
        if (other.unregister2cons("mud-list")) {
          if (typeof other.socket !== 'undefined') other.socket.disconnect(); 
          other.socket = undefined;
          other.logger.add('mud-list and socket disconnected-server',false);
        } else {
          other.logger.add('mud-list disconnected-server',false);
        }
      }
    });
    return observable;
  }

  public mudConnect(mudOb : any) : Observable<string> {
    let other = this;
    let observable = new Observable<string>(observer => {
      if (other.socket === undefined) {
        other.socketConnect();
        other.logger.add('socket connected',false);
      }
      mudOb['browser'] = other.srvcfg.getBrowserInfo();
      other.register2cons('mud-client');
      other.logger.add('socket connecting-1',false);
      other.socket.emit('mud-connect', mudOb, function(data){
        if (typeof data.id !== 'undefined') {
          if (typeof mudOb.user !== 'undefined') {
            other.mudConnections[data.id] = {
              id: data.id,
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
              connected: true,
              width: mudOb.width,
              height: mudOb.height
            }  
          }
          observer.next(data.id);
        } else {
          console.error('mud-connect-error: '+data.error);
          other.logger.add('mud-connect-error: '+data.error);
          observer.next(null);
        }
      });
      other.socket.on('mud-disconnected', function(id) {
        if (typeof other.mudConnections[id] === 'undefined') {
          console.log(id);
          observer.next(null);
          return;
        }
        other.mudConnections[id].connected = false;
        if (other.unregister2cons("mud-client")) {
          if (typeof other.socket !== 'undefined') other.socket.disconnect(); 
          other.socket = undefined;
          other.logger.add('mud-client and socket disconnected-server',false);
          observer.next(null);
        } else {
          other.logger.add('mud-client disconnected-server',false);
          observer.next(null);
        }
      });

      other.logger.add('socket connecting-2',false);
      return () => {
        if (other.unregister2cons("mud-client")) {
          if (typeof other.socket !== 'undefined') other.socket.disconnect(); 
          other.socket = undefined;
          other.logger.add('socket disconnected',false);
          observer.next(null);
        } // if
      }; // disconnect
    }); // observable
    return observable;
  } // mudConnect

  
  public setMudOutputSize(_id : string,height:number,width : number) {
    if (this.socket === undefined) {
      return;
    }
    this.socket.emit('mud-window-size',_id,height,width);
  }
  
  public mudDisconnect(_id : string) : Observable<string> {
    let other = this;
    let observable = new Observable<string>(observer => {
      if (other.socket === undefined) {
        other.logger.add('mudDisconnect without socket!',true);
        return;
      }
      other.logger.add('mudDisconnect starting!',false);
      other.socket.emit('mud.disconnect', _id);
      other.socket.on('mud-disconnected', function(id) {
        if (id !== _id) {
          return;
        }
        other.mudConnections[id].connected = false;
        if (other.unregister2cons("mud-client")) {
          if (typeof other.socket !== 'undefined') other.socket.disconnect(); 
          other.socket = undefined;
          other.logger.add('mud-client and socket disconnected-client',false);
        } else {
          other.logger.add('mud-client disconnected-client',false);
        }
        observer.next(_id);
        return () => {
          other.logger.add('mudDisconnect ending!',false);
        }; // disconnect
      });
    });
    return observable;
  }

  public mudConnectStatus(_id:string) : Observable<boolean> {
    let other = this;
    let observable = new Observable<boolean>(observer => {
      if (typeof other.mudConnections[_id] !== 'undefined') {
        observer.next(other.mudConnections[_id].connected);
      }
    });
    return observable;
  }

  public sendGMCP(id:string,mod:string,msg:string,data:any) {
    if (typeof this.mudConnections[id] === 'undefined') {
      console.log('failed[GMCP_Send_packet].mudconn='+id);
      return;
    }
    console.log('GMCP-send:',mod,msg,data);
    this.socket.emit('mud-gmcp-outgoing',id,mod,msg,data);
  }
  public sendPing(_id : string) {
    if (this.socket === undefined) {
      return;
    }
    this.sendGMCP(_id,'Core','Ping','');
  }


  public mudReceiveData(_id: string) : Observable<string> {
    let other = this;
    let observable = new Observable<string>(observer => {
      if (other.socket === undefined) {
        other.logger.add('mudReceiveData without socket!',true);
        return;
      }
      other.logger.add('mudReceiveData starting!',false);
      other.socket.on('mud-get-naws', function(id,cb) {
        if (typeof other.mudConnections[id] === 'undefined') {
          console.log('failed[mud-get-naws].mudconn='+id);
          cb(false);
          return;
        }
        if (_id !== id) {
          cb(false);
          return;
        }
        let mySize = {
          height : other.mudConnections[id].height,
          width : other.mudConnections[id].width,
        }
        cb(mySize);
      })
      other.socket.on('mud-disconnected', function(id) {
        if (_id !== id) {
          return;
        }
        observer.next('\r\n(Verbindung getrennt)\r\n');
      });
      other.socket.on('mud-output', function(id,buffer) {
        if (_id !== id) {
          return;
        }
        observer.next(buffer);
      }); // mud-output
      return () => {
        other.logger.add('mudReceiveData ending!',false);
      }; // mudReceiveData ending
    }); // observable
    return observable;
  } // mudReceiveData

  public mudReceiveSignals(_id: string) : Observable<MudSignals> {
    let other = this;
    let observable = new Observable<MudSignals>(observer => {
      if (other.socket === undefined) {
        other.logger.add('mudReceiveSignals without socket!',true);
        return;
      }
      other.logger.add('mudReceiveSignals starting!',false);
      other.socket.on('mud-signal',function(sdata){
        if (sdata.id !== _id) {
          return;
        }
        let musi : MudSignals = {
          signal : sdata.signal,
          id : sdata.id,
        }
        observer.next(musi);
      })
      other.socket.on('mud-gmcp-start', function(id){
        if (typeof other.mudConnections[id] === 'undefined') {
          console.log('failed[mud-gmcp-incoming].mudconn='+id);
          return;
        }
        if (_id !== id) {
          return;
        }
        other.sendGMCP(_id,'Core','Hello',{
          'client':other.srvcfg.getWebmudName(),
          'version':other.srvcfg.getWebmudVersion()});
        other.sendGMCP(_id,'Core','Supports.Set',['Char 1','Char.Items 1','Comm 1','Playermap 1','Sound 1']);
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
          console.log('failed[mud-gmcp-incoming].mudconn='+id);
          return;
        }
        if (_id !== id) {
          return;
        }
        switch (mod.toLowerCase().trim()) {
          case 'core':
            switch (msg.toLowerCase().trim()) {
              case 'hello':
                other.mudConnections[_id]['gmcp-mudname'] = data.name;
                break;
              case 'goodbye':
                let goodbyeMsg : MudSignals = {
                  signal: 'Core.GoodBye',
                  id: data,
                }
                observer.next(goodbyeMsg);
                break;
              case 'ping':
                let pingMsg : MudSignals = {
                  signal: 'Core.Ping',
                  id: '',
                }
                observer.next(pingMsg);
                return;
              default:
                console.log('GMCP:',mod,msg,data);
                return;
            }
            break;
          case 'char':
          switch (msg.toLowerCase().trim()) {
            case 'name':
              other.mudConnections[_id]['gmcp-charname'] = data.name;
              other.mudConnections[_id]['gmcp-fullname'] = data.fullname;
              other.mudConnections[_id]['gmcp-gender'] = data.gender;
              let titleSignal : MudSignals = {
                signal: 'name@mud',
                id: data.name + '@' + other.mudConnections[_id]['gmcp-mudname'],
              }
              observer.next(titleSignal);
              break;
            default:
              console.log('GMCP:',mod,msg,data);
              return;
          }
          break;
          case 'sound':
            switch (msg.toLowerCase().trim()) {
              case 'url':
                other.mudConnections[_id]['sound-url'] = data.url;
                break;
              case 'event':
                let soundSignal : MudSignals = {
                  signal: 'Sound.Play.Once',
                  id: data.file,
                  playSoundFile: other.mudConnections[_id]['sound-url']+'/'+data.file,
                }
                observer.next(soundSignal);
                break;
              default:
                console.log('GMCP:',mod,msg,data);
                return;
            }
            return;
          default: break;
        }
        console.log('GMCP:',mod,msg,data);
      });
    });
    return observable;
  }

  public mudReceiveDebug(_id: string) : Observable<DebugData> {
    let other = this;
    let observable = new Observable<DebugData>(observer => {
      if (other.socket === undefined) {
        other.logger.add('mudReceiveDebug without socket!',true);
        return;
      }
      other.logger.add('mudReceiveDebug starting!',false);
      other.socket.on('mud-error', function(id,errtext : string) {
        if (_id !== id) {
          return;
        }
        other.logger.add(errtext,true);
        console.log('mud-error:',errtext);
      });
      other.socket.on('mud-debug', function(id,dbgOb : DebugData) {
        var dbgoutput : string;
        if (typeof dbgOb.option === 'undefined') {
          dbgoutput = id+"["+dbgOb.type+"]: "+dbgOb.text;
        } else {
          dbgoutput = id+"["+dbgOb.type+"]: "+dbgOb.text+"| "+dbgOb.option;
        }
        if (typeof _id === 'undefined') { // debug all in one
          other.logger.add(dbgoutput,dbgOb.type==='error');
          observer.next(dbgOb);
          return;
        }
        if (_id !== id) {
          return;
        }
        other.logger.add(dbgoutput,dbgOb.type==='error');
        observer.next(dbgOb);
      }); // mud-output
      return () => {
        other.logger.add('mudReceiveDebug ending!',false);
      }; // mudReceiveDebug ending
    }); // observable
    return observable;
  } // mudReceiveDebug

  public mudSendData(_id:string,data:string) {
    if (this.socket === undefined) {
      this.logger.add('mudSendData without socket!',true);
      return;
    }
    this.socket.emit('mud-input',_id,data);
  }


  // TODO GCMP send/receive
  // TODO ANSI-Handling als pipe?
  constructor(private logger : LoggerService,private srvcfg:ServerConfigService) { }
}
