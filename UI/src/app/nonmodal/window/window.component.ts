import { Component, OnInit, Input, ViewChild, ViewContainerRef, Compiler, ComponentFactory, Type, NgModule, Output, EventEmitter } from '@angular/core';
import { MyDynamicComponent } from './my-dynamic.component';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { WindowConfig } from '../window-config';

@Component({
  selector: 'app-window',
  templateUrl: './window.component.html',
  styleUrls: ['./window.component.css']
})
export class WindowComponent implements OnInit {
  @Input('config') config : WindowConfig;
  @Output('menuAction') menuAction= new EventEmitter<string>();
  @ViewChild('container', {read: ViewContainerRef}) viewContainer: ViewContainerRef;

  public lockDrag : boolean = false;

  onMenuAction(what) {
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


	constructor(private compiler: Compiler) {}

  ngOnInit() {
    this.lockDrag = this.config.initalLock || false;
    this.createComponentFactory(MyDynamicComponent).then(
      (factory: ComponentFactory<MyDynamicComponent>) => this.viewContainer.createComponent(factory),
      (err: any) => console.error(err));
  }

  private createComponentFactory(componentType: Type<MyDynamicComponent>): Promise<ComponentFactory<MyDynamicComponent>> {
		let runtimeModule = this.createDynamicModule(componentType);
		// compile module
		return this.compiler
			.compileModuleAndAllComponentsAsync(runtimeModule)
			// All factories available in this module are returned instead of just the one we are interested in.
			// We filter the array to just get the factory for this componentType.
			.then(moduleWithFactories =>
				moduleWithFactories.componentFactories.find(fact => fact.componentType === componentType));
	}

  private createDynamicModule(componentType: Type<MyDynamicComponent>): Type<any> {
		@NgModule({
			declarations: [
				componentType
			],
			imports: [BrowserModule, FormsModule]
		})
		class RuntimeComponentModule {
		}
		// a module for just this Type
		return RuntimeComponentModule;
	}
}
