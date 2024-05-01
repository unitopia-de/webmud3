import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { FileInfo } from '@mudlet3/frontend/shared';

@Injectable({
  providedIn: 'root',
})
export class FilesService {
  private filemap: Record<string, FileInfo> = {};

  startFilesModule() {
    return;
  }

  processFileInfo(fileinfo: FileInfo): FileInfo {
    const url = fileinfo.lasturl;
    const filepath = fileinfo.file;
    console.debug('FilesService-processFileInfo-start', fileinfo);
    if (
      Object.prototype.hasOwnProperty.call(this.filemap, filepath) &&
      fileinfo.saveActive
    ) {
      const cfileinfo: FileInfo = this.filemap[filepath];
      cfileinfo.save02_url?.(url);
      cfileinfo.alreadyLoaded = true;
      cfileinfo.saveActive = true;
      console.debug('FilesService-processFileInfo-alreadyLoaded', cfileinfo);
      return cfileinfo;
    } else {
      fileinfo.saveActive = false;
      fileinfo.alreadyLoaded = false;
      this.filemap[filepath] = fileinfo;
    }
    const other = this;
    fileinfo.relateWindow = function (winid: string) {
      console.debug('FilesService-relaeWindow', winid);
      this.windowsId = winid;
      other.filemap[filepath] = this;
    };
    fileinfo.save02_url = function (url2) {
      fileinfo.lasturl = url2;
      console.debug('FilesService-save02_url', fileinfo);
      other.http
        .put(url2, fileinfo.content, { responseType: 'text' })
        .subscribe(
          (value: string) => {
            fileinfo.oldContent = fileinfo.content;
            fileinfo.saveActive = false;
            fileinfo.save03_saved?.(filepath);
          },
          (err: any) => {
            console.error('FilesService-save02_url-rrror', fileinfo, err);

            if (fileinfo.windowsId !== undefined) {
              fileinfo.save05_error?.(fileinfo.windowsId, err);
            }
          },
        );
    };
    fileinfo.load = function (cb: Function) {
      other.http.get(url, { responseType: 'text' }).subscribe(
        (value: string) => {
          console.debug('FilesService-load', filepath);
          cb(undefined, value);
        },
        (err: any) => {
          console.debug('FilesService-load-failed', filepath, err);
          cb(err, undefined);
        },
      );
    };
    return fileinfo;
  }

  constructor(private http: HttpClient) {}
}
