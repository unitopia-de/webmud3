import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { NGXLogger } from 'ngx-logger';

@Component({
  selector: 'app-editortest',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css']
})
export class EditorTestComponent implements OnInit,AfterViewInit {
  ngAfterViewInit(): void {
    throw new Error("Method not implemented.");
  }
  @ViewChild('editor', {static: false}) editor;
  public text : string = "";
  public mode : string = "text";
  public theme : string = "chrome";
  public options :  Object = {};
  public readOnly : boolean = false;

  textChanged(event) {
    this.logger.trace(event);
  }
  onChange(event) {
    
  }
  constructor(private logger:NGXLogger) { }

  ngOnInit() {
  }

}
// https://ace.c9.io/
// https://ace.c9.io/tool/mode_creator.html
