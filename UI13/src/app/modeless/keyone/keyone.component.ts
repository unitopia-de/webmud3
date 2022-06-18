import { Component, OnInit, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-keyone',
  templateUrl: './keyone.component.html',
  styleUrls: ['./keyone.component.css']
})
export class KeyoneComponent implements OnInit {
  
  @Input() prefix:string;
  @Input() key:string;
  @Input() set value(val:string) {
    this.keyinp = val;
  } get value():string {return this.keyinp};
  @Output('keyAction') keyAction= new EventEmitter<string>();
  @ViewChild('keyoneInput', {static: false}) keyoneInput: ElementRef;
  public keyinp : string = '';
  
  submit() {
    this.keyAction.emit(this.prefix+':'+this.key+'.'+this.keyinp);
  }

  constructor() { }

  ngOnInit(): void {
  }

}
