import { Component, OnInit } from '@angular/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { KeypadData } from 'src/app/shared/keypad-data';

@Component({
  selector: 'app-keypad-config',
  templateUrl: './keypad-config.component.html',
  styleUrls: ['./keypad-config.component.scss'],
})
export class KeypadConfigComponent implements OnInit {
  public keypad: KeypadData = new KeypadData();
  /* eslint @typescript-eslint/ban-types: "warn" */
  cb: Function;
  cbThis: any; // paththrough

  public keyAction(event: string) {
    const newev = {
      item: {
        id: 'MUD:NUMPAD:RETURN',
        cbThis: this.cbThis,
        keypad: this.keypad,
        event: event,
      },
    };
    this.cb(newev);
  }

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig,
  ) {}

  ngOnInit(): void {
    this.keypad = <KeypadData>this.config.data.keypad;
    this.cb = this.config.data['cb'];
    this.cbThis = this.config.data['cbThis'];
    console.log('KeypadConfigComponent-1', this.keypad);
  }
}
