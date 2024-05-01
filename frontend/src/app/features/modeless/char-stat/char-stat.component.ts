import { Component, Input, OnInit } from '@angular/core';
import { CharacterData, WindowConfig } from '@mudlet3/frontend/shared';

@Component({
  selector: 'app-char-stat',
  templateUrl: './char-stat.component.html',
  styleUrls: ['./char-stat.component.scss'],
})
export class CharStatComponent implements OnInit {
  private _config?: WindowConfig;

  @Input() set config(cfg: WindowConfig) {
    this._config = cfg;
    console.log('CharStat-config:', cfg);
    this.charData = <CharacterData>cfg.data;
  }
  get config(): WindowConfig | undefined {
    return this._config;
  }

  public charData?: CharacterData;

  ngOnInit(): void {
    console.debug('inComingEvents-CharStat-1');
    this.config?.inComingEvents.subscribe(
      (event: string) => {
        console.log('inComingEvents-CharStat-2', event, this.charData);
      },
      (error) => {
        console.error('incomingEvents-CharStat-3', error);
      },
      () => {
        if (this.config !== undefined) {
          this.config.visible = false;
        }
      },
    );
  }
}
