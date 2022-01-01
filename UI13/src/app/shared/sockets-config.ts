import { io,Manager,Socket } from "socket.io-client";

export interface HashTable<T> {
   [key: string]: T;
}

export class IoMud {
    MudId: string='';
    uplink?:IoSocket;
    constructor(private id:string,private up:IoSocket) {
        this.MudId = id;
        this.uplink = up;
        if (typeof up !== 'undefined') {
            up.reportId(id,this);
        }
    }
}

export class IoSocket {
    SocketId: string='';
    socket: Socket|undefined = undefined;
    MudIndex: HashTable<IoMud> = {};
    uplink?:IoManager;
    public addMud(id:string) {
        const myMud : IoMud = new IoMud(id,this);
        this.MudIndex[id] = myMud;
    }
    public reportId(id:string,ob:any){
        
    }
}

export class IoManager {
    ManagerId:string = '';
    manager: Manager|undefined = undefined;
    
}

export class IoPlatform {
    
}