/* eslint @typescript-eslint/no-empty-function: "warn" */
export class FileInfo {
  lasturl = '';
  file = '';
  path = '';
  filename = '';
  filetype = '';
  edditortype? = '';

  newfile = true;
  writeacl = false;
  temporary = false;
  saveActive = false;
  closable = false;
  filesize = -1;
  title = '';

  content? = '';
  oldContent? = '';

  alreadyLoaded? = false;
  windowsId?: string = undefined;

  save01_start? = function (filepath: string) {};
  save02_url? = function (url: string) {};
  save03_saved? = function (filepath: string) {};
  save04_closing? = function (windowsid: string) {};
  save05_error? = function (windowsid: string, error: string) {};
  save06_success? = function (windowsid: string) {};
  relateWindow? = function (windowsid: string) {};
  load? = function (cb: Function) {};
  cancel01_start? = function (filepath: string, cb: Function) {};
  cancel02_end? = function (filepath: string) {};
}
