import { Injectable } from '@angular/core';
 
@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  messages: string[] = [];
  debugflag : boolean = true;
 
  add(message: string,errflag : boolean = false) {
    if (!this.debugflag && !errflag) {
      return; // no output of debugmessages!
    }
    this.messages.push(message);
  }
 
  clear() {
    this.messages = [];
  }

  toggleDebug() {
    this.debugflag = !this.debugflag;
  }
}