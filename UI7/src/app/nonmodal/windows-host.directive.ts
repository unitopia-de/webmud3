import { Directive, ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[win-host]'
})
export class WindowsHostDirective {

  constructor(public viewContainerRef: ViewContainerRef) { }

}
