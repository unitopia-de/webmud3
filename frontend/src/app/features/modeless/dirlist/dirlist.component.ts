import { Component, Input, OnInit } from '@angular/core';
import {
  FileEntries,
  MudSignals,
  WindowConfig,
} from '@mudlet3/frontend/shared';

@Component({
  selector: 'app-dirlist',
  templateUrl: './dirlist.component.html',
  styleUrls: ['./dirlist.component.scss'],
})
export class DirlistComponent implements OnInit {
  private musi?: MudSignals;
  private _config?: WindowConfig;

  @Input()
  set config(cfg: WindowConfig) {
    this._config = cfg;
    // console.log("config:",cfg);
    this.updateDirList();
  }

  get config(): WindowConfig | undefined {
    return this._config;
  }

  public path? = '';

  public entries?: FileEntries[] = [];

  updateDirList() {
    if (this._config === undefined) {
      throw new Error('config is undefined and should not be!');
    }

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
    this.config?.outGoingEvents.next('FileOpen:' + this.path + ':' + file);
  }

  changeDir(dir: string, event = undefined) {
    this.config?.outGoingEvents.next('ChangeDir:' + this.path + ':' + dir);
  }

  ngOnInit(): void {
    console.debug('inComingEvents-DirList');
    this.config?.inComingEvents.subscribe(
      (event: string) => {
        this.updateDirList();
        console.log('inComingEvents-DirList', event);
      },
      (error) => {
        console.error('incomingEvents-DirList', error);
      },
      () => {
        if (this.config !== undefined) {
          this.config.visible = false;
        }
      },
    );
  }
}
