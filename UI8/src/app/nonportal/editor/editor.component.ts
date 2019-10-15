import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { NGXLogger } from 'ngx-logger';

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css']
})
export class EditorComponent implements OnInit,AfterViewInit {
  ngAfterViewInit(): void {
    throw new Error("Method not implemented.");
  }
  @ViewChild('editor', {static: false}) editor;
  public text : string = "";
  
  constructor(private logger:NGXLogger) { }

  ngOnInit() {
  }

}
