import { Component, OnInit, Input, AfterContentInit } from '@angular/core';
import { WindowConfig } from 'src/app/shared/window-config';
import {DynamicDialogRef} from 'primeng/dynamicdialog';
import {DynamicDialogConfig} from 'primeng/dynamicdialog';
import { ReadLanguageService } from 'src/app/read-language.service';
import { KeypadData } from 'src/app/shared/keypad-data';

@Component({
  selector: 'app-keypad-config',
  templateUrl: './keypad-config.component.html',
  styleUrls: ['./keypad-config.component.scss']
})
export class KeypadConfigComponent implements OnInit {

  public keypad : KeypadData = new KeypadData();
  cb: Function;
  cbThis:any;// paththrough
  
  public keyAction(event:string) {
    const newev = {
      item: {
        id: 'MUD:NUMPAD:RETURN',
        cbThis:this.cbThis,
        keypad:this.keypad,
        event:event,
      }
    }
    this.cb(newev);
  }

  constructor(
    public i18n: ReadLanguageService,
    public ref: DynamicDialogRef, 
    public config: DynamicDialogConfig
  ) { }

  ngOnInit(): void {
    this.keypad = <KeypadData> this.config.data.keypad;
    this.cb = this.config.data['cb'];
    this.cbThis = this.config.data['cbThis'];
    console.log('KeypadConfigComponent-1',this.keypad)
  }

}
