import { Component, OnInit, Input, AfterContentInit } from '@angular/core';
import { WindowConfig } from 'src/app/shared/window-config';
import { KeypadData } from 'src/app/shared/keypad-data';

@Component({
  selector: 'app-keypad-config',
  templateUrl: './keypad-config.component.html',
  styleUrls: ['./keypad-config.component.css']
})
export class KeypadConfigComponent implements OnInit,AfterContentInit {

  @Input() set config(cfg:WindowConfig) {
    this._config = cfg;
    console.log("KeypadConfigComponent-config:",cfg);
    if (typeof cfg.data !== undefined) {
      this.levels = <KeypadData> cfg.data;
    }
  } get config():WindowConfig {return this._config};
  private _config:WindowConfig;
  
  public levels : KeypadData = new KeypadData();
  
  public keyAction(event:string) {
    this.config.outGoingEvents.next(event);
  }

  constructor() { }

  ngOnInit(): void {
    console.log('KeypadConfigComponent-1',this._config,this.levels)
  }

  ngAfterContentInit(): void {
    console.log('KeypadConfigComponent-2',this._config,this.levels)
  }


}
