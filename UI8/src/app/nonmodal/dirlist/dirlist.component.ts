import { Component, OnInit } from '@angular/core';
import { MyDynamicComponent } from '../window/my-dynamic.component';
import { FileEntries } from '../file-entries';
import { MudSignals } from 'src/app/mud/mud-signals';

@Component({
  selector: 'app-dirlist',
  templateUrl: './dirlist.component.html',
  styleUrls: ['./dirlist.component.css']
})
export class DirlistComponent extends MyDynamicComponent implements OnInit {

  public path : string = '';
  public entries : FileEntries[] = [];
  private musi : MudSignals;

  constructor() {
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
    console.log('updateDirList:',this.entries);
   }

   protected incommingMsg(msg : string) {
    var msgSplit = msg.split(":");
    switch(msgSplit[0]) {
      case "updateDir":
        this.updateDirList();
        break;
      default:
        break;
    }
  }

  fileOpen(file:string) {
    this.outgoingMsg("FileOpen:"+this.path+":"+file);
  }
  changeDir(dir:string) {
    this.outgoingMsg("ChangeDir:"+this.path+":"+dir);
  }

  ngOnInit() {
    this.updateDirList();
  }

}
