export class FileInfo {
  lasturl: string = '';
  file: string = '';
  path: string = '';
  filename: string = '';
  filetype: string = '';
  edditortype?: string = '';

  newfile: boolean = true;
  writeacl: boolean = false;
  temporary: boolean = false;
  saveActive: boolean = false;
  closable: boolean = false;
  filesize: number = -1;
  title: string = '';

  content?: string = '';
  oldContent?: string = '';

  alreadyLoaded?: boolean = false;
  windowsId?: string = undefined;
  save01_start? = function (filepath) {};
  save02_url? = function (url) {};
  save03_saved? = function (filepath) {};
  save04_closing? = function (windowsid) {};
  save05_error? = function (windowsid, error) {};
  save06_success? = function (windowsid) {};
  relateWindow? = function (wid) {};
  load? = function (cb) {};
  cancel01_start? = function (filepath, cb) {};
  cancel02_end? = function (filepath) {};
}
