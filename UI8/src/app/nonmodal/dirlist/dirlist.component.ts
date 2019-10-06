import { Component, OnInit } from '@angular/core';
import { MyDynamicComponent } from '../window/my-dynamic.component';
import { FileEntries } from '../file-entries';
import { MudSignals } from 'src/app/mud/mud-signals';
import { WindowsService } from '../windows.service';

@Component({
  selector: 'app-dirlist',
  templateUrl: './dirlist.component.html',
  styleUrls: ['./dirlist.component.css']
})
export class DirlistComponent extends MyDynamicComponent implements OnInit {

  public path : string = '';
  public entries : FileEntries[] = [];
  private musi : MudSignals;
  private cwidth : number = 200;
  private cheight : number = 200;
  private cposx : number = 100;
  private cposy : number = 100;
  private moving : boolean = false;
  private maxheight : number = 200;

  myStyle(): object {
    var ret :object;
    if (this.moving) {
      ret = {
        "width": this.cwidth+'px',
        "height":this.cheight+'px',
        "max-height":this.maxheight+'px',
        "overflow":'scroll',
      };
    } else {
      ret = {
        "width": this.cwidth+'px',
        "height":this.cheight+'px',
        "max-height":this.maxheight+'px',
        "overflow":'scroll',
        "top":  this.cposx+'px',
        "left": this.cposy+'px',
      };
    }
    // console.log('myStyle',ret);
    return ret;
  } 
  
  private updateMySize(twidth,theight) {
    this.cwidth = twidth;
    this.cheight = theight;
  }

  private updateMyPosition(posx:number,posy:number,move:boolean) {
    this.moving = move;
    this.cposx = posx;
    this.cposy = posy;
  }

  constructor(private winsrv:WindowsService) {
    super();
   }

   updateDirList() {
    this.musi = <MudSignals>this.config.data;
     if (typeof this.musi === 'undefined') {
       this.path = '';
       this.entries = [];
       return;
     }
    this.path = this.musi.filepath;
    this.entries = this.musi.entries;

    console.log('updateDirList:',this.path);
   }

   protected incommingMsg(msg : string) {
    var msgSplit = msg.split(":");
    switch(msgSplit[0]) {
      case "resize":         
        if (msgSplit.length == 3) {
          this.updateMySize(parseInt(msgSplit[1]),parseInt(msgSplit[2]));
          return;
        }
        break;
      case "moving":         
        if (msgSplit.length == 3) {
          this.updateMyPosition(parseInt(msgSplit[1]),parseInt(msgSplit[2]),true);
          return;
        }
        break;
      case "endMove":         
        if (msgSplit.length == 3) {
          this.updateMyPosition(parseInt(msgSplit[1]),parseInt(msgSplit[2]),false);
          return;
        }
        break;
      case "updateDir":
        this.updateDirList();
        return;
      default:
        break;
    }
    console.log('dirlist-msg: ',msg);
  }

  fileOpen(file:string) {
    this.outgoingMsg("FileOpen:"+this.path+":"+file);
  }
  changeDir(dir:string) {
    this.outgoingMsg("ChangeDir:"+this.path+":"+dir);
  }

  ngOnInit() {
    this.maxheight = this.winsrv.getViewPortHeight()-100;
    this.updateDirList();
  }

}
