import { Injectable } from '@angular/core';
import { Logger, LoggerLevel } from './logger';

@Injectable({
  providedIn: 'root'
})
export class LoggerService extends Logger {

  public ServerLogger : Logger;

  constructor() { 
    super("Client",LoggerLevel.OFF,null);
    Logger.root = this;
    Logger.force = LoggerLevel.FATAL | LoggerLevel.ERROR | LoggerLevel.WARN;
    Logger.filter = LoggerLevel.ALL;
    this.ServerLogger = new Logger("Server",LoggerLevel.OFF,null);
  }
}
