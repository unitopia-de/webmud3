import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import * as io from 'socket.io-client';
import { ChatMessage } from './chat-message';
import { LoggerService } from './logger.service';
import { DebugData } from './debug-data';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private url = 'http://localhost:5000';
  private socket = undefined;
  private consumers = {};
  private currentName : string = '';

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
        other.socket = io(other.url); 
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

  public mudConnect(mudOb : Object) : Observable<string> {
    let other = this;
    let observable = new Observable<string>(observer => {
      if (other.socket === undefined) {
        other.socket = io(this.url); 
        other.logger.add('socket connected',false);
      }
      other.register2cons('mud-client');
      other.logger.add('socket connecting-1',false);
      other.socket.emit('mud-connect', mudOb);
      other.socket.on('mud-connected', function(id) {
        observer.next(id);
      }); // mud-connected
      other.socket.on('mud-disconnected', function(id) {
        if (other.unregister2cons("mud-client")) {
          other.socket.disconnect(); 
          other.socket = undefined;
          other.logger.add('mud-client and socket disconnected-server',false);
        } else {
          other.logger.add('mud-client disconnected-server',false);
        }
      });
      other.logger.add('socket connecting-2',false);
      return () => {
        if (other.unregister2cons("mud-client")) {
          other.socket.disconnect(); 
          other.socket = undefined;
          other.logger.add('socket disconnected',false);
        } // if
      }; // disconnect
    }); // observable
    return observable;
  } // mudConnect

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
        if (other.unregister2cons("mud-client")) {
          other.socket.disconnect(); 
          other.socket = undefined;
          other.logger.add('mud-client and socket disconnected-client',false);
        } else {
          other.logger.add('mud-client disconnected-client',false);
        }
        return () => {
          other.logger.add('mudDisconnect ending!',false);
        }; // disconnect
      });
    });
    return observable;
  }

  public mudReceiveData(_id: string) : Observable<string> {
    let other = this;
    let observable = new Observable<string>(observer => {
      if (other.socket === undefined) {
        other.logger.add('mudReceiveData without socket!',true);
        return;
      }
      other.logger.add('mudReceiveData starting!',false);
      other.socket.on('mud-output', function(id,buffer) {
        if (_id !== id) {
          return;
        }
        observer.next(buffer);
      }); // mud-output
      return () => {
        other.logger.add('mudReceiveData ending!',false);
      }; // disconnect
    }); // observable
    return observable;
  } // mudReceiveData

  public mudReceiveDebug(_id: string) : Observable<DebugData> {
    let other = this;
    let observable = new Observable<DebugData>(observer => {
      if (other.socket === undefined) {
        other.logger.add('mudReceiveDebug without socket!',true);
        return;
      }
      other.logger.add('mudReceiveDebug starting!',false);
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
      }; // disconnect
    }); // observable
    return observable;
  } // mudReceiveDebug

  public mudSendData(_id:string,data:string) {
    if (this.socket === undefined) {
      this.logger.add('mudSendData without socket!',true);
      return;
    }
    console.log(_id+' '+data);
    this.socket.emit('mud-input',_id,data);
  }

  // TODO GCMP send/receive
  // TODO ANSI-Handling als pipe?
  constructor(private logger : LoggerService) { }
}
