import { Directive,ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[appTabcon]'
})
export class TabconDirective {

  constructor(public viewContainerRef: ViewContainerRef) { }

}
