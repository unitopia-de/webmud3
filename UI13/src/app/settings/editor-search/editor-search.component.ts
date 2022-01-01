import { Component, Input, OnInit } from '@angular/core';

import * as ace from "ace-builds";
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { Logger, LoggerLevel } from 'src/app/logger';
import { LoggerService } from 'src/app/logger.service';
import { WindowConfig } from 'src/app/shared/window-config';

@Component({
  selector: 'app-editor-search',
  templateUrl: './editor-search.component.html',
  styleUrls: ['./editor-search.component.css']
})
export class EditorSearchComponent implements OnInit {

  @Input() set config(cfg:WindowConfig) {
    this._config = cfg;
    this.aceEditor = this.config.data['aceEditor'];
    this.logger.log("config:",cfg);
  } get config():WindowConfig {return this._config};
  private _config:WindowConfig;

  private aceEditor:ace.Ace.Editor;
  seachText:string="";
  type="text";
  private logger : Logger;

  constructor(
    private loggerSrv : LoggerService) {
      this.logger = loggerSrv.addLogger("EditorSearchComponent",LoggerLevel.ALL);
     }

  ngOnInit(): void {
    // this.aceEditor = this.config.data['aceEDitor'];
  }
  onSearch() {
  //   var range = this.aceEditor.find(this.seachText,{
  //     wrap: true,
  //     caseSensitive: true,
  // })
  }
  onReplace() {

  }
  doSearch() {
    
  }

}
