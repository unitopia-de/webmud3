import { Component, Input, OnInit } from '@angular/core';
import { WindowConfig } from '@mudlet3/frontend/shared';

import * as ace from 'ace-builds';

@Component({
  selector: 'app-editor-search',
  templateUrl: './editor-search.component.html',
  styleUrls: ['./editor-search.component.scss'],
})
export class EditorSearchComponent implements OnInit {
  @Input() set config(cfg: WindowConfig) {
    this._config = cfg;
    this.aceEditor = this.config.data['aceEditor'];
    console.log('config:', cfg);
  }
  get config(): WindowConfig {
    return this._config;
  }
  private _config: WindowConfig;

  private aceEditor: ace.Ace.Editor;
  seachText = '';
  type = 'text';

  ngOnInit(): void {
    // this.aceEditor = this.config.data['aceEDitor'];
    return;
  }
  onSearch() {
    return;
    //   var range = this.aceEditor.find(this.seachText,{
    //     wrap: true,
    //     caseSensitive: true,
    // })
  }
  onReplace() {
    return;
  }
  doSearch() {
    return;
  }
}
