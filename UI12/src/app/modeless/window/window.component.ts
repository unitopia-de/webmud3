import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { Logger, LoggerLevel } from 'src/app/logger';
import { LoggerService } from 'src/app/logger.service';
import { WindowConfig } from 'src/app/shared/window-config';

@Component({
  selector: 'app-window',
  templateUrl: './window.component.html',
  styleUrls: ['./window.component.css']
})
export class WindowComponent implements OnInit {

  @Input('config') config : WindowConfig;
  @Output('menuAction') menuAction= new EventEmitter<string>();
  @ViewChild('dialog') dialog

  private logger : Logger;

  constructor(
    private loggerSrv : LoggerService) { 
      this.logger = loggerSrv.addLogger("WindowComponent",LoggerLevel.ALL);
    }

  doWindowAction(event:any,actionType:string){
    this.logger.log(actionType,event);
    switch(actionType){
      case 'resize_end':
        this.config.inComingEvents.next("resize:"+event.pageX+":"+event.pageY);
        return;
      case 'drag_end':
        this.config.outGoingEvents.next("do_focus:"+this.config.windowid);
        return;
      case 'hide':
        this.config.outGoingEvents.next("do_hide:"+this.config.windowid);
        return;
      case 'show':
      case 'resize_init':
      case 'maximize':
        break;
      default:
        return;
    }
  }


  ngOnInit(): void {
    this.logger.log("config",this.config);
  }

}
