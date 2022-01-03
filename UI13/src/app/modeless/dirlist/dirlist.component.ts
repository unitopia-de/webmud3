import { Component, Input, OnInit } from '@angular/core';
import { FileEntries, MudSignals } from 'src/app/mud/mud-signals';
import { WindowConfig } from 'src/app/shared/window-config';
import { WindowService } from 'src/app/shared/window.service';

@Component({
  selector: 'app-dirlist',
  templateUrl: './dirlist.component.html',
  styleUrls: ['./dirlist.component.css']
})
export class DirlistComponent implements OnInit {

  @Input() set config(cfg:WindowConfig) {
    this._config = cfg;
    // console.log("config:",cfg);
    this.updateDirList();
  } get config():WindowConfig {return this._config};
  private _config:WindowConfig;

  public path : string = '';
  public entries : FileEntries[] = [];
  private musi : MudSignals;

  constructor(
    private winsrv:WindowService
  ) { 
  }

  updateDirList() {
    this.musi = <MudSignals>this._config.data;
     if (typeof this.musi === 'undefined') {
       this.path = '';
       this.entries = [];
       return;
     }
    this.path = this.musi.filepath;
    this.entries = this.musi.entries;
    console.debug('DirlistComponent-updateDirList',this.path);
   }
   fileOpen(file:string) {
    this.config.outGoingEvents.next("FileOpen:"+this.path+":"+file);
  }
  changeDir(dir:string) {
    this.config.outGoingEvents.next("ChangeDir:"+this.path+":"+dir);
  }
  ngOnInit(): void {
    console.debug("inComingEvents-DirList");
    this.config.inComingEvents.subscribe((event:string)=>{
      this.updateDirList();
      console.log("inComingEvents-DirList",event);
    },(error)=>{
      console.error('incomingEvents-DirList',error);
    },() => {
      this.config.visible = false;
    })
  }

}
