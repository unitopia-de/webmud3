import { Injectable } from '@angular/core';
import { ServerConfigService } from './server-config.service';
import { GmcpService } from '../gmcp/gmcp.service';
import { IoPlatform, IoSocket,IoResult } from './sockets-config';
import { MudListItem } from '../mud/mud-list-item';
import { MudConfig } from '../mudconfig/mud-config';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketsService {
  
  public platform : IoPlatform;
  public ioSocket : IoSocket;
  public mudlist : MudListItem[];
  private socketUrl : string;
  private socketNsp : string;

  constructor(
    private srvcfg:ServerConfigService,
    private gmcpsrv: GmcpService) { 
      this.platform = new IoPlatform(srvcfg,gmcpsrv);
    }
    private socketConnect() {
      this.socketUrl = this.srvcfg.getBackend();
      this.socketNsp = this.srvcfg.getSocketNamespace();
      this.ioSocket = this.platform.connectSocket(this.socketUrl,this.socketNsp);
      const other = this;
      this.ioSocket.mudList().toPromise()
      .then(data => {
        other.mudlist = data.mudlist;
      })
    }
    public mudConnect(mudOb:MudConfig):Observable<IoResult> {
      return this.ioSocket.addMud(mudOb,this.socketNsp);
    }
    public setMudOutputSize(_id : string,height:number,width : number) {
      const mud = this.ioSocket.MudIndex[_id];
      if (typeof mud !== 'undefined') {
        mud.setMudOutputSize(height,width);
      }
    }
}
