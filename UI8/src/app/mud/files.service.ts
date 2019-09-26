import { Injectable } from '@angular/core';
import { FileInfo } from './file-info';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class FilesService {

  private filemap : Object = {};

  startFilesModule() {
    
  }

  processURL( url : string) : FileInfo {
    const urlparts = url.split("=");
    if (urlparts.length != 2) {
      console.log("url mismatch:",url);
      return;
    }
    const token = urlparts[1].split(".");
    if (token.length!=3) {
      console.log("token mismatch:",url);
      return;
    }
    var fileinfo  :FileInfo;
    const payload = atob(token[1]);
    var ob = JSON.parse(payload);
    const filepath = ob["file"];
    const fileparts = filepath.split("/");
    const filename = fileparts[fileparts.length-1];
    const fileidx = filename.lastIndexOf('.');
    var fileext = '';
    var filetype = 'text';
    if (fileidx > -1) {
      fileext = filename.slice(fileidx);
      switch (fileext) {
        case '.c':
        case '.h':
        case '.inc':
          filetype = 'c_cpp';
      }
    }
    if (this.filemap.hasOwnProperty(filepath)) {
      fileinfo = this.filemap[filepath];
      fileinfo.alreadyLoaded = true;
    } else {
      fileinfo = new FileInfo();
      fileinfo.filename = filename;
      fileinfo.filepath = filepath;
      fileinfo.filetype = filetype;
      fileinfo.lasturl = url;
      fileinfo.saveActive = false;
      fileinfo.alreadyLoaded = false;
      this.filemap[filepath] = fileinfo;
    }
    var other = this;
    fileinfo.relateWindow = function(winid : string) {
      this.windowsId = winid;
      other.filemap[filepath] = fileinfo;
    };
    fileinfo.load = function(cb) {
        other.http.get<string>(url).subscribe((value:string) => {
          console.log("File loaded: ",filepath);
          cb(null,value);
        },(err:any) => {
          console.log("File load failed: ",filepath,err);
          cb (err,null);
        });
      };
    fileinfo.save = function(txt,cb) {
        other.http.put<string>(url,txt).subscribe((value:string) => {
          console.log("File saved: ",filepath);
          cb(null,value);
        },(err:any) => {
          console.log("File save failed: ",filepath,err);
          cb (err,null);
        });
    };
    return fileinfo;
  }

  constructor(private http: HttpClient) { }
}
