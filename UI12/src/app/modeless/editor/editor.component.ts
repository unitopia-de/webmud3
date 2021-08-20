import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { Logger, LoggerLevel } from 'src/app/logger';
import { LoggerService } from 'src/app/logger.service';
import { WindowConfig } from 'src/app/shared/window-config';
import {ConfirmationService} from 'primeng/api';
import * as ace from "ace-builds";

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css']
})
export class EditorComponent implements OnInit,AfterViewInit  {

  @Input() set config(cfg:WindowConfig) {
    this._config = cfg;
    this.text = cfg.data['content'];
    this.fileinfo = cfg.data;
    if (typeof this.aceSession !== 'undefined') {
      this.aceSession.setValue(this.text);
      this.aceSession.setMode('ace/mode/'+cfg.data['edditortype']);
    }
    this.logger.log("config:",cfg);
  } get config():WindowConfig {return this._config};
  private _config:WindowConfig;
  @Output('menuAction') menuAction= new EventEmitter<string>();
  
  @ViewChild("editor") private editor: ElementRef<HTMLElement>;
  private aceEditor:ace.Ace.Editor;
  private aceSession:ace.Ace.EditSession;

  public text:string = "";
  private fileinfo:any;
  public disabled : boolean = false;
  private logger : Logger;
  private cwidth : number = 0;
  private cheight : number = 0;
  constructor(
    private loggerSrv : LoggerService,
    private confirmationService: ConfirmationService
    ) { 
      this.logger = loggerSrv.addLogger("EditorComponent",LoggerLevel.ALL);
    }

  onChange(code) {
    this.logger.log("new code", code);
  }
  onSave(event) {
    const itext = this.aceEditor.getValue();
    this.logger.log("save-text", itext);
    this.fileinfo.content = itext;
    this.fileinfo.save01_start(this.fileinfo.file);
    this.config.outGoingEvents.next("Save:");
  }
  onCancel(event) {
    var other = this;
    if (this.text == this.aceEditor.getValue()) {
      other.config.outGoingEvents.next("Cancel:");
      return;
    } 
    this.confirmationService.confirm({
      target: event.target,
      message: 'Willst Du ohne Speichern schliessen?',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        other.config.outGoingEvents.next("Cancel:");//confirm action
      },
      reject: () => {
          //reject action
      }    
    })
}

  myStyle(): object {
    if (this.cwidth > 0 && this.cheight > 0)
    {
      return {
        "min-width":"100px",
        "min-height":"100px",
        "width": this.cwidth+'px',
        "height":this.cheight+'px',
        "overflow":"auto"
      };
    }
    else
    {
      return {
        "min-width":"100px",
        "min-height":"100px",
        "width": '100%',
        "height":'85%',
        "overflow":"auto"
      };
  
    }
  }  
  private updateMyStyle(twidth,theight) {
    //this.cwidth = twidth;
    //this.cheight = theight;
    this.aceEditor.resize(true);
    this.aceEditor.renderer.updateFull();
  }

  ngOnInit(): void {
    var logger = this.logger.addLogger('Incoming',LoggerLevel.ALL);
    this._config.inComingEvents.subscribe((event)=>{
      var msgSplit = event.split(":");
      logger.log("event:",event);
      switch (msgSplit[0]) {
        case "resize":
        case "resize_init":
        case 'resize_end':
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
  ngAfterViewInit(): void {
    ace.config.set('basePath', 'https://unpkg.com/ace-builds@1.4.12/src-noconflict');
    ace.config.set("fontSize", "14px");
    if (typeof this.aceEditor === 'undefined' ) {
      this.aceEditor = ace.edit(this.editor.nativeElement);
    }
    this.aceEditor.setAutoScrollEditorIntoView(true);
    this.aceEditor.setTheme('ace/theme/twilight');
    this.aceSession = new ace.EditSession(this.text);
    this.aceSession.setMode('ace/mode/'+this._config.data['edditortype']);
    this.aceEditor.setSession(this.aceSession);

  }
}
