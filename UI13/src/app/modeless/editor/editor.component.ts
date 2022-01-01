import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { Logger, LoggerLevel } from 'src/app/logger';
import { LoggerService } from 'src/app/logger.service';
import { WindowConfig } from 'src/app/shared/window-config';
import {ConfirmationService,MenuItem} from 'primeng/api';

import * as ace from "ace-builds";
import { DialogService } from 'primeng/dynamicdialog';
import { EditorSearchComponent } from 'src/app/settings/editor-search/editor-search.component';
import { FileInfo } from 'src/app/mud/mud-signals';
import { WindowService } from 'src/app/shared/window.service';

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css']
})
export class EditorComponent implements OnInit,AfterViewInit  {

  @Input() set config(cfg:WindowConfig) {
    this._config = cfg;
    this.zinSearch = cfg.zIndex+100;
    this.text = cfg.data['content'];
    this.fileinfo = cfg.data as FileInfo;
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
  public themes:any[]=[];
  public currentTheme:string="";
  zinSearch:number = 100;
  items: MenuItem[];
  searchOptions:any={
    regex : false,
  };

  public text:string = "";
  private fileinfo:FileInfo;
  public disabled : boolean = false;
  public readonly: boolean = false;
  private logger : Logger;
  private cwidth : number = 0;
  private cheight : number = 0;

  onChange(code) {
    this.logger.log("new code", code);
  }
  onSave(event:any,closeable:boolean) {
    if (this.readonly) return;
    const itext = this.aceEditor.getValue();
    this.logger.log("save-text", itext);
    this.fileinfo.content = itext;
    this.fileinfo.closable = closeable;
    this.fileinfo.save01_start(this.fileinfo.file);
    this.config.outGoingEvents.next("Save:"+closeable);
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

  public changeTheme() {
    this.aceEditor.setTheme('ace/theme/'+this.currentTheme);
  }

  searchWindow(event:any,replaceFlag:boolean=false) {
    var cfg = new WindowConfig();
        cfg.component = "EditorSearchComponent";
        cfg.save = false;
        cfg.parentWindow = this.config.windowid;
        cfg.wtitle = (replaceFlag?'Ersetzen: ':'Suchen: ')+this.fileinfo.filename;
        cfg.data = {
          aceEditor:this.aceEditor,
          replaceFlag:replaceFlag
        };
        cfg.windowid = this.windowService.newWindow(cfg);
  }
  replaceWindow(event:any) {
    this.searchWindow(Event,true);
  }
  toggleReadonly(event) {
    this.readonly=!this.readonly
    this.updateMenu();
  }

  private updateMenu() {
    this.items = [
      {
         label:'Suchen/Ersetzen',
         icon:'pi pi-fw pi-filter',
         items:[
            {
               label:'Suchen',
               icon:'pi pi-fw pi-filter',
               command: (event)=>{this.searchWindow(event)},
            },
            {
               label:'Ersetzen',
               icon:'pi pi-fw pi-filter',
               disabled:this.readonly,
               command: (event)=>{this.replaceWindow(event)}
            },
         ]
      },
      {
         separator:true
      },
      {
        label:'LeseModus',
        icon:this.readonly?'pi pi-fw pi-plus-circle':'pi pi-fw pi-minus-circle',
        command: (event)=>{this.toggleReadonly(event);}
      },
      {
        label:'Speichern&Schliessen',
        icon:'pi pi-fw pi-upload',
        disabled:this.readonly,
        command: (event)=>{this.onSave(event,true)}
      },
      {
        label:'Zwischenpeichern',
        icon:'pi pi-fw pi-upload',
        disabled:this.readonly,
        command: (event)=>{this.onSave(event,false)}
      },
      {
         label:'Schliessen',
         icon:'pi pi-fw pi-power-off',
         command: (event)=>{this.onCancel(event)}
        }
    ];
  }

  ngOnInit(): void {
    var logger = this.logger.addLogger('Incoming',LoggerLevel.ALL);
    this.updateMenu();
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
    var themelist = ace.require("ace/ext/themelist"); // delivers undefined!!!
    console.log("themelist",themelist);
    this.themes = [];
    var themeOb :any = themelist.themesByName // error reference undefined
    themeOb.keys().forEach(themeName => {
      this.themes.push({name:themeName,code:themeName});
    })

  }
  
  constructor(
    private loggerSrv : LoggerService,
    private windowService: WindowService,
    private confirmationService: ConfirmationService
    ) { 
      this.logger = loggerSrv.addLogger("EditorComponent",LoggerLevel.ALL);
    }
}
