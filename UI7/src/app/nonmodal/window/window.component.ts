import { Component, OnInit, Input, ViewChild, Output, EventEmitter, ComponentFactoryResolver, OnDestroy, AfterViewInit } from '@angular/core';
import { MyDynamicComponent } from './my-dynamic.component';
import { WindowConfig } from '../window-config';
import { WindowsHostDirective } from '../windows-host.directive';
import { SimpleEditComponent } from '../simpleedit/simpleedit.component';

@Component({
  selector: 'app-window',
  templateUrl: './window.component.html',
  styleUrls: ['./window.component.css',"../../../../node_modules/angular2-draggable/css/resizable.min.css"]
})
export class WindowComponent implements OnInit, OnDestroy, AfterViewInit {
  ngOnDestroy(): void {
    
  }
  ngOnInit(): void {
    // clearInterval(this.interval);
  }
  @Input('config') config : WindowConfig;
  @Output('menuAction') menuAction= new EventEmitter<string>();
  @ViewChild(WindowsHostDirective) winHost : WindowsHostDirective;
  interval:any;

  ngAfterViewInit() {
    // this.loadComponent();
    /*this.interval = setInterval(() => {
      this.loadComponent();
    }, 3000);*/
  }

  public lockDrag : boolean = false;

  loadComponent() {
    var cmp: any;
    switch (this.config.component) {
      case 'SimpleEditComponent': cmp = SimpleEditComponent; break;
      default: console.log("Unknown Component:",this.config.component); return;
    }
    if (typeof this.winHost === 'undefined') {
      console.log("winHost undefined");
      return;
    }
    let componentFactory = this.componentFactoryResolver.resolveComponentFactory(cmp);
    let viewContainerRef = this.winHost.viewContainerRef;
    viewContainerRef.clear();

    let componentRef = viewContainerRef.createComponent(componentFactory);
    (<MyDynamicComponent>componentRef.instance).config = this.config;
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


	constructor(private componentFactoryResolver: ComponentFactoryResolver) {}

}
