import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MyDynamicComponent } from '../window/my-dynamic.component';
import { FileInfo } from 'src/app/mud/file-info';

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css']
})
export class EditorComponent extends MyDynamicComponent implements OnInit {

  @ViewChild('editor') editor;
  public text : string = "";
  private fileinfo : FileInfo;

  constructor() { super(); }

  private cwidth : number = 100;
  private cheight : number = 100;
  myStyle(): object {
    return {"width": this.cwidth+'px',"height":this.cheight+'px'};
  } 

  private updateMyStyle(twidth,theight) {
    this.cwidth = twidth;
    this.cheight = theight;
    this.editor.getEditor().resize()
  }

  protected incommingMsg(msg : string) {
    var msgSplit = msg.split(":");
    switch (msgSplit[0]) {
      case 'resize':
        if (msgSplit.length == 3) {
          this.updateMyStyle(parseInt(msgSplit[1]),parseInt(msgSplit[2]));
          return;
        }
      case 'save':
        this.fileinfo.save(this.text,function(err,data){
          if (err !== null) {
            console.error("EditorComponent:Save:Failed",err);
            this.OutgoingMessage('error:Speichern fehlgeschlagen');
          } else {
            this.OutgoingMessage('saved');
          }
        })
        return;
      default:
        console.log('EditorComponent Unknown incomming message: ',msg);
    }
  }

  // snippets: this.editor.getEditor().insert("Something cool");

  ngOnInit() {
    this.fileinfo = <FileInfo>this.config.data;
    var emode = "text";
    if (typeof this.fileinfo !== 'undefined') {
      this.text = this.fileinfo.content;
      emode = this.fileinfo.filetype;
      // this.editor.getEditor().setValue()
  } else {
      this.text = 'Test-Log\nZeile2\n3';
    }

    this.editor.setTheme("eclipse");

    this.editor.getEditor().setOptions({
        mode : emode,
    });
  }
}
