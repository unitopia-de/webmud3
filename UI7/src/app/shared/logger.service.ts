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
    if (errflag) {
      console.error(message);
    } else {
      console.log(message);
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