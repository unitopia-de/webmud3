import { CharacterData, WindowConfig } from '@mudlet3/frontend/shared';
import { MudSignals } from '../../shared/mud-signals';

export interface MudMessage {
  text: string;
}

export class MudSignalHelpers {
  public static updateCharStats(other: any, musi: MudSignals, _id: string) {
    return;
  }

  public static mudProecessSignals(
    other: any,
    musi: MudSignals | undefined,
    _id: string,
  ) {
    console.debug(
      'mudclient-socketService.mudReceiveSignals',
      _id,
      musi?.signal,
    );

    if (musi === undefined) {
      throw new Error(
        'mudclient-socketService.mudReceiveSignals: musi is undefined and shall not be?!',
      );
    }

    // console.debug('mudclient-socketService.mudReceiveSignals',_id,musi);
    let audio: any, newfile: any, filewincfg: WindowConfig;
    let nooldcfg, newcfg, xsplit;
    switch (musi.signal) {
      case 'NOECHO-START':
        other.v.inpType = 'password';
        other.doFocus();
        break;
      case 'NOECHO-END':
        other.v.inpType = 'text';
        other.doFocus();
        break;
      case 'name@mud':
        other.titleService.setTitle(musi.id);
        other.charData = new CharacterData(musi.id);
        if (typeof musi.wizard !== 'undefined') {
          other.filesrv.startFilesModule();
        }
        return;
      case 'status':
        other.charData.setStatus(musi.id);
        this.updateCharStats(other, other.charData, _id);
        return;
      case 'vitals':
        other.charData.setVitals(musi.id);
        this.updateCharStats(other, other.charData, _id);
        return;
      case 'stats':
        other.charData.setStats(musi.id);
        this.updateCharStats(other, other.charData, _id);
        return;
      case 'Input.CompleteText':
        other.inpmessage = musi.id;
        return;
      case 'Input.CompleteChoice':
        this.mudProcessData(other, _id, [null, other.tableOutput(musi.id, 78)]);
        return;
      case 'Input.CompleteNone': // TODO beep??
        return;
      case 'Sound.Play.Once':
        audio = new Audio();
        audio.src = musi.playSoundFile;
        audio.load();
        audio.play();
        break;
      case 'Files.URL':
        newfile = other.filesrv.processFileInfo(musi.fileinfo);
        if (newfile.alreadyLoaded) {
          console.log('Files.URL-alreadyLoaded', _id, newfile);
        } else {
          newfile.save04_closing = function (windowsid: any) {
            console.debug('Files.URL-save04_closing', _id, windowsid);
            other.wincfg.SavedAndClose(windowsid);
          };
          newfile.save05_error = function (windowsid: any, error: any) {
            console.error('Files.URL-save05_error', _id, windowsid, error);
            other.wincfg.WinError(windowsid, error);
          };
          newfile.save06_success = function (windowsid: any) {
            console.debug('Files.URL-save06_success', _id, windowsid);
            other.wincfg.SaveComplete(windowsid, newfile.closable);
          };
          console.log('Files.URL-firstLoad', _id, newfile);
          filewincfg = new WindowConfig();
          filewincfg.component = 'EditorComponent';
          filewincfg.data = newfile;
          filewincfg.dontCancel = true;
          if (typeof newfile.title !== 'undefined' && newfile.title != '') {
            filewincfg.wtitle = newfile.title;
          } else {
            filewincfg.wtitle = newfile.filename;
            filewincfg.tooltip = newfile.file;
          }
          if (!newfile.newfile) {
            newfile.load(function (err: any, data: any) {
              if (typeof err === 'undefined') {
                newfile.content = data;
                newfile.oldContent = data;
                filewincfg.data = newfile;
                filewincfg.save = true;
                const windowsid = other.wincfg.newWindow(filewincfg);
                newfile.relateWindow(windowsid);
              }
            });
          } else {
            newfile.content = '';
            newfile.oldContent = '';
            filewincfg.data = newfile;
            filewincfg.save = true;
            const windowsid = other.wincfg.newWindow(filewincfg);
            newfile.relateWindow(windowsid);
          }
        }
        return;
      case 'Files.Dir':
        nooldcfg = typeof other.filesWindow === 'undefined';
        newcfg = other.wincfg.findFilesWindow(other.filesWindow, musi);
        other.filesWindow = newcfg;
        if (nooldcfg) {
          other.filesWindow.outGoingEvents.subscribe(
            (x: string) => {
              console.debug('Files.Dir-outGoingEvents', _id, x);
              xsplit = x.split(':');
              switch (xsplit[0]) {
                case 'FileOpen':
                  // Files.OpenFile { "file": "/w/myonara/ed.tmp" }
                  other.socketsService.sendGMCP(_id, 'Files', 'OpenFile', {
                    file: xsplit[1] + xsplit[2],
                  });
                  break;
                case 'ChangeDir':
                  if (xsplit[2] == '../') {
                    other.socketsService.sendGMCP(_id, 'Files', 'ChDir', {
                      dir: xsplit[2],
                    });
                  } else {
                    other.socketsService.sendGMCP(_id, 'Files', 'ChDir', {
                      dir: xsplit[1] + xsplit[2],
                    });
                  }
                  break;
              }
            },
            (err: any) => {
              console.error('Files.Dir-outGoingEvents-Error', _id, err);
            },
            () => {
              console.debug('Files.Dir-outGoingEvents-complete', _id);
            },
          );
        }
        return;
      case 'Core.Ping':
        other.togglePing = !other.togglePing;
        return;
      case 'Numpad.SendLevel':
        other.keySetters.setLevel(musi.numpadLevel);
        return;
      case 'Core.GoodBye':
        console.log(
          'mudclient-socketService.mudReceiveSignals: new stuff-',
          musi,
        );
        return;
      case 'Char.Items.List':
        other.invlist.initList(musi.invEntries);
        return;
      case 'Char.Items.Add':
        other.invlist.addItem(musi.invEntry);
        return;
      case 'Char.Items.Remove':
        other.invlist.removeItem(musi.invEntry);
        return;
      default:
        console.info(
          'mudclient-socketService.mudReceiveSignals UNKNOWN',
          _id,
          musi.signal,
        );
        return;
    }
  }
  public static mudProcessData(
    other: any,
    _id: string,
    outline: [string | null, string | undefined],
  ) {
    const outp = outline[0];
    const iecho = outline[1];
    // console.log('mudclient-mudReceiveData',_id,outline);
    if (typeof outp !== 'undefined') {
      const idx = outp?.indexOf(other.ansiService.ESC_CLRSCR);

      if (idx !== undefined && idx >= 0) {
        other.messages = [];
        other.mudlines = [];
      }
      other.ansiCurrent.ansi = outp;
      other.ansiCurrent.mudEcho = undefined;
      other.messages.push({ text: outp });
    } else {
      other.ansiCurrent.ansi = '';
      other.ansiCurrent.mudEcho = iecho;
      other.messages.push({ text: iecho });
    }
    const ts = new Date();
    other.ansiCurrent.timeString =
      (ts.getDate() < 10 ? '0' : '') +
      ts.getDate() +
      '.' +
      (ts.getMonth() + 1 < 10 ? '0' : '') +
      (ts.getMonth() + 1) +
      '.' +
      ts.getFullYear() +
      ' ' +
      (ts.getHours() < 10 ? '0' : '') +
      ts.getHours() +
      ':' +
      (ts.getMinutes() < 10 ? '0' : '') +
      ts.getMinutes() +
      ':' +
      (ts.getSeconds() < 10 ? '0' : '') +
      ts.getSeconds();
    // console.log('mudclient-mudReceiveData-ansiCurrent-before',_id,other.ansiCurrent);
    const a2harr = other.ansiService.processAnsi(other.ansiCurrent);
    // console.log('mudclient-mudReceiveData-s2harr after',_id,a2harr);
    for (let ix = 0; ix < a2harr.length; ix++) {
      if (a2harr[ix].text != '' || typeof a2harr[ix].mudEcho !== 'undefined') {
        other.mudlines = other.mudlines.concat(a2harr[ix]);
      }
    }
    other.ansiCurrent = a2harr[a2harr.length - 1];
  }
}
