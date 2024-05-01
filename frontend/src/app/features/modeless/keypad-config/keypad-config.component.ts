import { Component, OnInit } from '@angular/core';
import { KeypadData } from '@mudlet3/frontend/shared';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-keypad-config',
  templateUrl: './keypad-config.component.html',
  styleUrls: ['./keypad-config.component.scss'],
})
export class KeypadConfigComponent implements OnInit {
  public keypad: KeypadData = new KeypadData();

  cb?: Function;

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

    this.cb?.(newev);
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
