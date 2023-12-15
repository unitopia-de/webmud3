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
  windowsId? = undefined;
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
