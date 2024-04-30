import { Component, Input, OnInit } from '@angular/core';
import { FileEntries, MudSignals, WindowConfig } from '@mudlet3/frontend/shared';

@Component({
  selector: 'app-dirlist',
  templateUrl: './dirlist.component.html',
  styleUrls: ['./dirlist.component.scss'],
})
export class DirlistComponent implements OnInit {
  @Input() set config(cfg: WindowConfig) {
    this._config = cfg;
    // console.log("config:",cfg);
    this.updateDirList();
  }
  get config(): WindowConfig {
    return this._config;
  }
  private _config: WindowConfig;

  public path = '';
  public entries: FileEntries[] = [];
  private musi: MudSignals;

  updateDirList() {
    this.musi = <MudSignals>this._config.data;
    if (typeof this.musi === 'undefined') {
      this.path = '';
      this.entries = [];
      return;
    }
    this.path = this.musi.filepath;
    this.entries = this.musi.entries;
    console.debug('DirlistComponent-updateDirList', this.path);
  }
  fileOpen(file: string, event = undefined) {
    this.config.outGoingEvents.next('FileOpen:' + this.path + ':' + file);
  }
  changeDir(dir: string, event = undefined) {
    this.config.outGoingEvents.next('ChangeDir:' + this.path + ':' + dir);
  }
  ngOnInit(): void {
    console.debug('inComingEvents-DirList');
    this.config.inComingEvents.subscribe(
      (event: string) => {
        this.updateDirList();
        console.log('inComingEvents-DirList', event);
      },
      (error) => {
        console.error('incomingEvents-DirList', error);
      },
      () => {
        this.config.visible = false;
      },
    );
  }
}
