export class Logger {
    public static root:Logger;
    public static force:LoggerLevel;
    public static filter:LoggerLevel;
    public static modules:Map<string,Logger> = new Map<string,Logger>();
    
    public prefix:string;
    public onOff:LoggerLevel=LoggerLevel.OFF;

    constructor(addPrefix:string,on:LoggerLevel,parentLogger:Logger) {
        this.onOff = on;
        if (parentLogger!=null) {
            this.prefix = parentLogger.prefix+'.'+addPrefix;
        }
        else 
        {
            this.prefix = addPrefix;
        }
        Logger.modules.set(this.prefix,this);
    }
    addLogger(addPrefix:string,on:LoggerLevel) : Logger
    {
        return new Logger(addPrefix,on,this);
    }

    private checkLevel(l:LoggerLevel) : boolean{
        return (l&(Logger.force | (Logger.filter & this.onOff)))>0;
    }

    trace(message: any, ...additional: any[]): void{
        if (this.checkLevel(LoggerLevel.TRACE))
        {
            console.info(this.prefix,message,...additional);
        }
      }
      debug(message: any, ...additional: any[]): void{
        if (this.checkLevel(LoggerLevel.DEBUG))
        {
            console.info(this.prefix,message,...additional);
        }
      }
      info(message: any, ...additional: any[]): void{
        if (this.checkLevel(LoggerLevel.INFO))
        {
            console.info(this.prefix,message,...additional);
        }
      }
      log(message: any, ...additional: any[]): void{
        if (this.checkLevel(LoggerLevel.LOG))
        {
            console.log(this.prefix,message,...additional);
        }
      }
      warn(message: any, ...additional: any[]): void{
        if (this.checkLevel(LoggerLevel.WARN))
        {
            console.warn(this.prefix,message,...additional);
        }
      }
      error(message: any, ...additional: any[]): void{
        if (this.checkLevel(LoggerLevel.ERROR))
        {
            console.error(this.prefix,message,...additional);
        }
      }
      fatal(message: any, ...additional: any[]): void{
        if (this.checkLevel(LoggerLevel.FATAL))
        {
            console.error(this.prefix,message,...additional);
        }
      } 
}

export enum LoggerLevel {
    OFF= 0x01,
    FATAL= 0x02,
    ERROR= 0x04,
    WARN = 0x08,
    LOG = 0x10,
    INFO = 0x20,
    DEBUG= 0x40,
    TRACE= 0x80,
    ALL = 0xFE
}