import { Component, Input, ViewChild, Output, EventEmitter, ComponentFactoryResolver, AfterViewInit, ViewContainerRef, ChangeDetectorRef } from '@angular/core';
import { MyDynamicComponent } from './my-dynamic.component';
import { WindowConfig } from '../window-config';
import { SimpleEditComponent } from '../simpleedit/simpleedit.component';
import { EditorComponent } from '../editor/editor.component';
import { IResizeEvent } from 'angular2-draggable/lib/models/resize-event';
import { WindowsService } from '../windows.service';
import { DirlistComponent } from '../dirlist/dirlist.component';

@Component({
  selector: 'app-window',
  templateUrl: './window.component.html',
  styleUrls: ['./window.component.css',"../../../../node_modules/angular2-draggable/css/resizable.min.css"]
})
export class WindowComponent implements AfterViewInit {
  @Input('config') config : WindowConfig;
  @Output('menuAction') menuAction= new EventEmitter<string>();
  @ViewChild('windowsHost', {static:false,read: ViewContainerRef}) windowsHost: ViewContainerRef;
  interval:any;

  public lockDrag : boolean = false;
  public cwidth : number = 218;
  public cheight : number = 218-71;
  private cri: MyDynamicComponent; 

  private updateMyStyle(twidth,theight) {
    this.cwidth = twidth - 4;
    this.cheight = theight-71;
    this.cri.inMsg = "resize:"+this.cwidth+":"+this.cheight;
  }

  ngAfterViewInit(): void {
    this.loadComponent();
  }
  loadComponent() {
    var cmp: any;
    if (typeof this.windowsHost === 'undefined') {
      console.error("windowsHost undefined");
      return;
    }
    switch (this.config.component) {
      case 'SimpleEditComponent': cmp = SimpleEditComponent; break;
      case 'EditorComponent': cmp = EditorComponent; break;
      case 'DirlistComponent': cmp = DirlistComponent; break;
      default: console.log("Unknown Component:",this.config.component); return;
    }
    let componentFactory = this.componentFactoryResolver.resolveComponentFactory(cmp);
    this.windowsHost.clear();

    let componentRef = this.windowsHost.createComponent(componentFactory);
    this.cri = (<MyDynamicComponent>componentRef.instance);
    this.cri.config = this.config;
    this.cri.outMsg.subscribe((x:string) => {
      console.log("outMsg: ",x);
      this.config.outGoingEvents.emit(x);
    }, err => {
      console.log("outMsg-Error: ",err);
      this.config.outGoingEvents.error(err);
    }, () => {
      console.log("outMsg-complete");
      this.config.outGoingEvents.complete();
    });
    let self = this;
    this.winsrv.getDownStream().subscribe((x:string)=>{
      let exp = x.split(":");
      if (exp[0] == this.config.windowid) {
        self.cri.inMsg = exp.slice(1).join(":");
      }
    },(err:any)=>{
      // console.log("DownStream-error: ",err)
    },()=>{
      // console.log("downStream -complete");
    })
    this.cdRef.detectChanges();
  }

  onMenuAction(what) {
    console.log('menuAction',this.config.windowid,what);
    switch (what) {
      case 'lock':
        this.lockDrag = !this.lockDrag;
        if (this.lockDrag) {
          this.menuAction.emit(this.config.windowid+':lock');
        } else {
          this.menuAction.emit(this.config.windowid+':unlock');
        }
        return;
      case 'save':
        this.menuAction.emit(this.config.windowid+':save');
        return;
      case 'cancel':
        this.menuAction.emit(this.config.windowid+':cancel');
        return;
    }
  }

  onResizeStart(event:IResizeEvent) {
    this.updateMyStyle(event.size.width,event.size.height);
  }

  onResizing(event:IResizeEvent) {
    this.updateMyStyle(event.size.width,event.size.height);
  }

  onResizeStop(event:IResizeEvent) {
    this.updateMyStyle(event.size.width,event.size.height);
  }

	constructor(private componentFactoryResolver: ComponentFactoryResolver,private cdRef : ChangeDetectorRef,private winsrv : WindowsService) {}

}
