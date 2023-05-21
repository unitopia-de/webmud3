import { Component, OnInit, Input } from '@angular/core';
import { WindowConfig } from 'src/app/shared/window-config';
import { MudSignals } from 'src/app/mud/mud-signals';

@Component({
  selector: 'app-char-stat',
  templateUrl: './char-stat.component.html',
  styleUrls: ['./char-stat.component.scss']
})
export class CharStatComponent implements OnInit {

  @Input() set config(cfg:WindowConfig) {
    this._config = cfg;
    console.log("CharStat-config:",cfg);
    this.charData = <CharacterData> cfg.data;
  } get config():WindowConfig {return this._config};
  private _config:WindowConfig;

  public charData : CharacterData;

  constructor(
  ) { 
  }

  ngOnInit(): void {
    console.debug("inComingEvents-CharStat-1");
    this.config.inComingEvents.subscribe((event:string)=>{
      console.log("inComingEvents-CharStat-2",event,this.charData);
    },(error)=>{
      console.error('incomingEvents-CharStat-3',error);
    },() => {
      this.config.visible = false;
    })
  }

}
