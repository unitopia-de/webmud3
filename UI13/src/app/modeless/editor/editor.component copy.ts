import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { Logger, LoggerLevel } from 'src/app/logger';
import { LoggerService } from 'src/app/logger.service';
import { WindowConfig } from 'src/app/shared/window-config';

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css']
})
export class EditorComponent implements OnInit {
  // https://ace.c9.io/#nav=about
  // https://www.npmjs.com/package/ngx-ace-editor-wrapper

  @Input() set config(cfg:WindowConfig) {
    this._config = cfg;
    this.text = cfg.data['content'];
    this.logger.log("config:",cfg);
  } get config():WindowConfig {return this._config};
  private _config:WindowConfig;
  @Output('menuAction') menuAction= new EventEmitter<string>();
  @ViewChild('editor') editor;

  
  text:string = "";
  private logger : Logger;
  private cwidth : number = 0;
  private cheight : number = 0;
  constructor(
    private loggerSrv : LoggerService) { 
      this.logger = loggerSrv.addLogger("EditorComponent",LoggerLevel.ALL);
    }

  onChange(code) {
    this.logger.log("new code", code);
  }
  myStyle(): object {
    if (this.cwidth > 0 && this.cheight > 0)
    {
      return {
        "min-width":"300px",
        "min-height":"300px",
        "width": this.cwidth+'px',
        "height":this.cheight+'px',
        "overflow":"auto"
      };
    }
    else
    {
      return {
        "min-width":"300px",
        "min-height":"300px",
        "width": '100%',
        "height":'100%',
        "overflow":"auto"
      };
  
    }
  }  
  private updateMyStyle(twidth,theight) {
    //this.cwidth = twidth;
    //this.cheight = theight;
    const ed2 = this.editor.nativeElement.getEditor();
    ed2.resize();
  }

  ngOnInit(): void {
    var logger = this.logger.addLogger('Incoming',LoggerLevel.ALL);
    this._config.inComingEvents.subscribe((event)=>{
      var msgSplit = event.split(":");
      logger.log("event:",event);
      switch (msgSplit[0]) {
        case 'resize':
          if (msgSplit.length == 3) {
            this.updateMyStyle(parseInt(msgSplit[1]),parseInt(msgSplit[2]));
          }
          break;
        }
    },(error)=>{
      logger.error('error:',error);
    },()=>{
      logger.debug('Complete');
    })
  }
  ngAfterViewInit() {
    this.logger.log("editor:",this.editor);
    const ed2 = this.editor.nativeElement.getEditor();
    ed2.setTheme("eclipse");

    ed2.resetOptions({
        enableBasicAutocompletion: true
    });

    ed2.rcommands.addCommand({
        name: "showOtherCompletions",
        bindKey: "Ctrl-.",
        exec: function (editor) {

        }
    })
}
}
