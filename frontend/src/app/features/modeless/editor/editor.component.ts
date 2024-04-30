import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  AfterViewInit,
  ChangeDetectorRef,
} from '@angular/core';
import { ConfirmationService, MenuItem } from 'primeng/api';

import * as ace from 'ace-builds';
import { CookieService } from 'ngx-cookie-service';
import { FileInfo, WindowConfig, WindowService } from '@mudlet3/frontend/shared';

const ithemes: string[] = [
  'ambiance',
  'chaos',
  'chrome',
  'clouds',
  'clouds_midnight',
  'cobalt',
  'crimson_editor',
  'dawn',
  'dracula',
  'dreamweaver',
  'eclipse',
  'github',
  'gob',
  'gruvbox',
  'idle_fingers',
  'iplastic',
  'katzenmilch',
  'kr_theme',
  'kuroir',
  'merbivore',
  'merbivore_soft',
  'mono_industrial',
  'mokokai',
  'nord_dark',
  'one_dark',
  'pastel_on_dark',
  'solarized_dark',
  'solarized_light',
  'sqlserver',
  'terminal',
  'textmate',
  'tomorrow',
  'tomorrow_night_blue',
  'tomorrow_night_bright',
  'tomorrow_night',
  'tomorrow_night_eighties',
  'twilight',
  'vibrant_ink',
  'xcode',
];

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
})
export class EditorComponent implements OnInit, AfterViewInit {
  @Input() set config(cfg: WindowConfig) {
    this._config = cfg;
    this.zinSearch = cfg.zIndex + 100;
    this.text = cfg.data['content'];
    this.fileinfo = cfg.data as FileInfo;
    if (typeof this.aceSession !== 'undefined') {
      this.aceSession.setValue(this.text);
      this.aceSession.setMode('ace/mode/' + cfg.data['edditortype']);
    }
    console.log('config:', cfg);
  }
  get config(): WindowConfig {
    return this._config;
  }
  private _config: WindowConfig;
  @Output() menuAction = new EventEmitter<string>();

  @ViewChild('editor') private editor: ElementRef<HTMLElement>;
  private aceEditor: ace.Ace.Editor;
  private aceSession: ace.Ace.EditSession;
  public themes: any[] = [];
  public currentTheme: any = {};
  zinSearch = 100;
  items: MenuItem[];
  searchOptions: any = {
    regex: false,
  };

  public text = '';
  private fileinfo: FileInfo;
  public disabled = false;
  public readonly = false;
  private cwidth = 0;
  private cheight = 0;

  onChange(code) {
    console.log('new code', code);
  }
  onSave(event: any, closeable: boolean) {
    if (this.readonly) return;
    if (typeof this.aceEditor === 'undefined') return;
    const itext = this.aceEditor.getValue();
    // console.log("save-text", itext);
    this.fileinfo.content = itext;
    this.fileinfo.closable = closeable;
    this.fileinfo.save01_start(this.fileinfo.file);
    this.config.outGoingEvents.next('Save:' + closeable);
  }

  /* eslint @typescript-eslint/no-this-alias: "warn" */
  onCancel(event) {
    if (typeof this.aceEditor === 'undefined') return;
    const other = this;
    if (this.text == this.aceEditor.getValue()) {
      other.config.outGoingEvents.next('Cancel:');
      return;
    }
    this.confirmationService.confirm({
      target: event.target,
      message: 'Willst Du ohne Speichern schliessen?',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        other.config.outGoingEvents.next('Cancel:'); //confirm action
      },
      reject: () => {
        //reject action
      },
    });
  }

  myStyle(): object {
    if (this.cwidth > 0 && this.cheight > 0) {
      return {
        'min-width': '100px',
        'min-height': '100px',
        width: this.cwidth + 'px',
        height: this.cheight + 'px',
        overflow: 'auto',
      };
    } else {
      return {
        'min-width': '100px',
        'min-height': '100px',
        width: '100%',
        height: '85%',
        overflow: 'auto',
      };
    }
  }
  private updateMyStyle(twidth, theight) {
    if (typeof this.aceEditor === 'undefined') return;
    //this.cwidth = twidth;
    //this.cheight = theight;
    this.aceEditor.resize(true);
    this.aceEditor.renderer.updateFull();
  }

  public changeTheme() {
    if (
      typeof this.aceEditor === 'undefined' ||
      typeof this.currentTheme === 'undefined'
    )
      return;
    this.aceEditor.setTheme('ace/theme/' + this.currentTheme.code);
    this.cookieService.set('editortheme', this.currentTheme.code);
  }

  searchWindow(event: any, replaceFlag = false) {
    const cfg = new WindowConfig();
    cfg.component = 'EditorSearchComponent';
    cfg.save = false;
    cfg.parentWindow = this.config.windowid;
    cfg.wtitle =
      (replaceFlag ? 'Ersetzen: ' : 'Suchen: ') + this.fileinfo.filename;
    cfg.data = {
      aceEditor: this.aceEditor,
      replaceFlag: replaceFlag,
    };
    cfg.windowid = this.windowService.newWindow(cfg);
  }
  replaceWindow(event: any) {
    this.searchWindow(Event, true);
  }
  toggleReadonly(event) {
    this.readonly = !this.readonly;
    this.updateMenu();
  }

  private updateMenu() {
    this.items = [
      {
        label: 'Editor',
        icon: 'pi pi-fw pi-bars',
        items: [
          {
            label: 'LeseModus',
            icon: this.readonly
              ? 'pi pi-fw pi-plus-circle'
              : 'pi pi-fw pi-minus-circle',
            command: (event) => {
              this.toggleReadonly(event);
            },
          },
          {
            label: 'Speichern&Schliessen',
            icon: 'pi pi-fw pi-upload',
            disabled: this.readonly,
            command: (event) => {
              this.onSave(event, true);
            },
          },
          {
            label: 'Zwischenpeichern',
            icon: 'pi pi-fw pi-upload',
            disabled: this.readonly,
            command: (event) => {
              this.onSave(event, false);
            },
          },
          {
            label: 'Schliessen',
            icon: 'pi pi-fw pi-power-off',
            command: (event) => {
              this.onCancel(event);
            },
          },
        ],
      },
    ];
  }

  ngOnInit(): void {
    const other = this;
    this.updateMenu();
    this._config.inComingEvents.subscribe(
      (event) => {
        const msgSplit = event.split(':');
        console.log('editor.inComingEvents.event:', event);
        switch (msgSplit[0]) {
          case 'resize':
          case 'resize_init':
          case 'resize_end':
            if (msgSplit.length == 3) {
              other.updateMyStyle(parseInt(msgSplit[1]), parseInt(msgSplit[2]));
            }
            break;
          case 'saved:false':
          case 'saved:true':
            other.text = other.aceEditor.getValue();
            other._config.data['content'] = other.text;
            break;
        }
      },
      (error) => {
        console.error('error:', error);
      },
      () => {
        console.debug('Complete');
      },
    );
  }
  ngAfterViewInit(): void {
    ace.config.set(
      'basePath',
      'https://unpkg.com/ace-builds@1.4.12/src-noconflict',
    );
    ace.config.set('fontSize', '14px');
    if (typeof this.aceEditor === 'undefined') {
      this.aceEditor = ace.edit(this.editor.nativeElement);
    }
    this.aceEditor.setAutoScrollEditorIntoView(true);
    let themeNow = this.cookieService.get('editortheme');
    if (themeNow === '') {
      themeNow = 'twilight';
    }
    this.aceEditor.setTheme('ace/theme/' + themeNow);
    this.aceSession = new ace.EditSession(this.text);
    this.aceSession.setMode('ace/mode/' + this._config.data['edditortype']);
    this.aceEditor.setSession(this.aceSession);
    const themelist = ace.require('ace/ext/themelist'); // delivers undefined!!!
    console.log('themelist', themelist);
    this.themes = [];
    // var themeOb :any = themelist.themesByName // error reference undefined
    // themeOb.keys().forEach(themeName => {
    //   this.themes.push({name:themeName,code:themeName});
    // })
    ithemes.forEach((themeName) => {
      this.themes.push({ name: themeName, code: themeName });
    });
    this.cd.detectChanges();
  }

  constructor(
    private windowService: WindowService,
    private confirmationService: ConfirmationService,
    private cookieService: CookieService,
    private cd: ChangeDetectorRef,
  ) {}
}
