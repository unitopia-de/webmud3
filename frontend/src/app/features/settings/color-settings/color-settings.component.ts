import { Component, OnInit } from '@angular/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { ColorSettings } from 'src/app/mud/color-settings';

@Component({
  selector: 'app-color-settings',
  templateUrl: './color-settings.component.html',
  styleUrls: ['./color-settings.component.scss'],
})
export class ColorSettingsComponent implements OnInit {
  cs: ColorSettings = new ColorSettings();
  cb: any;
  v: any; // pass through to MenuAction cb!
  cbThis: any; // paththrough

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig,
  ) {}

  ngOnInit(): void {
    this.cs = this.config.data['cs'];
    this.cb = this.config.data['cb'];
    this.v = this.config.data['v'];
    this.cbThis = this.config.data['cbThis'];
  }
  onClick(event) {
    const newev = {
      item: {
        id: 'MUD_VIEW:COLOR:RETURN',
        cs: this.cs,
        v: this.v,
        cbThis: this.cbThis,
      },
    };
    this.cb(newev);
  }
}
