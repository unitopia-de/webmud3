import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MyDynamicComponent } from '../window/my-dynamic.component';
import { FileInfo } from 'src/app/mud/file-info';
import { NGXLogger } from 'ngx-logger';

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css']
})
export class EditorComponent extends MyDynamicComponent implements OnInit,AfterViewInit {
  @ViewChild('editor', {static: false}) editor;
  public text : string = "";
  private fileinfo : FileInfo;

  constructor(private logger:NGXLogger) { super(); }

  private cwidth : number = 400;
  private cheight : number = 400;
  myStyle(): object {
    return {"width": this.cwidth+'px',"height":this.cheight+'px'};
  } 

  private updateMyStyle(twidth,theight) {
    this.cwidth = twidth;
    this.cheight = theight;
    this.editor.getEditor().resize();
  }

  protected outgoingMsg(msg:string) {
    this.logger.debug('EditorComponent-outgoingMsg',msg);
    super.outgoingMsg(msg);
  }

  protected incommingMsg(msg : string) {
    var msgSplit = msg.split(":");
    var other = this;
    switch (msgSplit[0]) {
      case 'resize':
        if (msgSplit.length == 3) {
          this.updateMyStyle(parseInt(msgSplit[1]),parseInt(msgSplit[2]));
        }
        break;
      case 'moving':
        break;
      case 'endMove':
        this.logger.debug('EditorComponent-incommingMsg',msg);
        break;
      case 'save':
        this.logger.debug('EditorComponent-incommingMsg',msg);
        this.fileinfo.content = this.text;
        this.fileinfo.save01_start(this.fileinfo.file);
        return;
      default: 
        this.logger.error('EditorComponent-incommingMsg UNKNOWN',msg);
        return;;
    }
    
  }

  // snippets: this.editor.getEditor().insert("Something cool");

  ngOnInit() {
    this.fileinfo = <FileInfo>this.config.data;
    
    if (typeof this.fileinfo !== 'undefined') {
      this.text = this.fileinfo.content;
      // this.editor.getEditor().setValue()
  } else {
      this.text = 'Test-Log\nZeile2\n3';
    }
  }
  ngAfterViewInit(){
    var emode = "text";
    if (typeof this.fileinfo !== 'undefined') {
        emode = this.fileinfo.edditortype || 'text';
    } else {
        emode = 'text';
    }
    this.logger.debug('EditorComponent-editortype',emode);
    this.editor.getEditor().setOptions({
        mode : emode,
    });
    this.editor.setTheme("eclipse");
    this.editor.getEditor().resize();
}
}
