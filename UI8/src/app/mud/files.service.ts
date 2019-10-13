import { Injectable } from '@angular/core';
import { FileInfo } from './file-info';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {NGXLogger} from 'ngx-logger';

@Injectable({
  providedIn: 'root'
})
export class FilesService {

  private filemap : Object = {};

  startFilesModule() {
    
  }

  

  processFileInfo( fileinfo : FileInfo) : FileInfo {
    const url = fileinfo.lasturl;
    const filepath = fileinfo.file;
    this.logger.trace('FilesService-processFileInfo-start',fileinfo);
    if (this.filemap.hasOwnProperty(filepath)) {
      var cfileinfo : FileInfo = this.filemap[filepath];
      if (fileinfo.saveActive) {
        cfileinfo.save02_url(url);
      } else {
        cfileinfo.save05_error(cfileinfo.windowsId,"Vorhandene FileInfo");
      }
      cfileinfo.alreadyLoaded = true;
      this.logger.trace('FilesService-processFileInfo-alreadyLoaded',cfileinfo);
      return cfileinfo;
    } else {
      fileinfo.saveActive = false;
      fileinfo.alreadyLoaded = false;
      this.filemap[filepath] = fileinfo;
    }
    var other = this;
    fileinfo.relateWindow = function(winid : string) {
      other.logger.debug('FilesService-relaeWindow',winid);
      this.windowsId = winid;
      other.filemap[filepath] = this;
    };
    fileinfo.save02_url = function(url2) {
      fileinfo.lasturl = url2;
      other.logger.debug('FilesService-save02_url',fileinfo);
      other.http.put(url2,fileinfo.content,{ responseType: 'text'}).subscribe((value:string) => {
        fileinfo.oldContent = fileinfo.content;
        fileinfo.save03_saved(filepath,function(err2,data){
          other.logger.debug('FilesService-save03_saved',fileinfo,err2);
          if (typeof(err2) !== "undefined") {
            fileinfo.save05_error(fileinfo.windowsId,err2);
            return;
          }
          if (fileinfo.temporary) {
            fileinfo.save04_closing(fileinfo.windowsId);
          } else {
            fileinfo.save06_success(fileinfo.windowsId);
          }
        });
      },(err:any) => {
        other.logger.error('FilesService-save02_url-rrror',fileinfo,err);
        fileinfo.save05_error(fileinfo.windowsId,err);
      });
    }
    fileinfo.load = function(cb) {
        other.http.get(url,{ responseType: 'text'}).subscribe((value:string) => {
          other.logger.debug('FilesService-load',filepath);
          cb(undefined,value);
        },(err:any) => {
          other.logger.debug('FilesService-load-failed',filepath,err);
          cb (err,undefined);
        });
      };
    return fileinfo;
  }

  constructor(
    private logger:NGXLogger,private http: HttpClient) { }
}
