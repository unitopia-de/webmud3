import { Injectable } from '@angular/core';
import { GmcpConfig } from '../gmcp/gmcp-config';
import { GmcpMenu } from '../gmcp/gmcp-menu';

@Injectable({
  providedIn: 'root',
})
export class UnitopiaService {
  private mudconfs: Record<string, Record<string, any>> = {};

  private set_mudconf(_id: string, key: string, value: any) {
    if (typeof this.mudconfs[_id] === 'undefined') {
      this.mudconfs[_id] = {};
    }
    this.mudconfs[_id][key] = value;
  }
  private get_mudconf(_id: string, key: string) {
    if (typeof this.mudconfs[_id] === 'undefined') {
      return undefined;
    }
    return this.mudconfs[_id][key];
  }
  public set_callbacks(
    _id: string,
    cb_mudSwitchGmcpModule: (
      mud_id: string,
      module_name: string,
      onoff: boolean,
    ) => void,
    cb_add_gmcp_module: (gcfg: GmcpConfig) => void,
    cb_remove_gmcp_module: (mud_id: string, module_name: string) => boolean,
  ) {
    this.set_mudconf(_id, 'cb_mudSwitchGmcpModule', cb_mudSwitchGmcpModule);
    this.set_mudconf(_id, 'cb_add_gmcp_module', cb_add_gmcp_module);
    this.set_mudconf(_id, 'cb_remove_gmcp_module', cb_remove_gmcp_module);
  }

  private toggleSound(
    gcfg: GmcpConfig,
    gmen: GmcpMenu,
    _cb: (arg0: string) => void,
  ) {
    if (!gmen.active) {
      this.init_module(gcfg.mud_id, 'Sound');
    } else {
      this.delete_module(gcfg.mud_id, 'Sound');
    }
    _cb('toggle'); // switch gmen.active-bit.
  }

  public menuAction(
    action: string,
    gcfg: GmcpConfig,
    gmen: GmcpMenu,
    index: number,
    _cb: (arg0: string) => void,
  ) {
    console.debug('UnitopiaService-menuAction', action, gcfg, gmen, index);
    switch (action) {
      case 'ToggleSound':
        this.toggleSound(gcfg, gmen, _cb);
        return;
      case 'add_gmcp_module':
        _cb(action);
        return;
      default:
        console.error(
          'UnitopiaService-menuAction-UNKNOWN',
          action,
          gcfg,
          gmen,
          index,
        );
    }
  }
  /* eslint @typescript-eslint/no-this-alias: "warn" */
  public init_module_config(_id: string, mod: string) {
    const cb_add_gmcp_module = this.get_mudconf(_id, 'cb_add_gmcp_module');
    const gmcpcfg = new GmcpConfig();
    const other = this;
    gmcpcfg.mud_family = 'unitopia';
    gmcpcfg.mud_id = _id;
    gmcpcfg.callback = function (
      action: string,
      gcfg: GmcpConfig,
      gmen: GmcpMenu,
      index: number,
      _cb: any,
    ) {
      other.menuAction(action, gcfg, gmen, index, _cb);
    };
    switch (mod.toLowerCase()) {
      case 'sound':
      case 'sound 1':
        gmcpcfg.module_name = 'Sound';
        gmcpcfg.version = '1';
        gmcpcfg.initial_menu = {
          action: 'ToggleSound',
          active: true,
          name: 'Vertonung',
          mud_id: _id,
          cfg: gmcpcfg,
          index: 0,
        };
        cb_add_gmcp_module(gmcpcfg);
        return;
      case 'input':
      case 'input 1':
        gmcpcfg.module_name = 'Input';
        gmcpcfg.version = '1';
        cb_add_gmcp_module(gmcpcfg);
        return;
      case 'files':
      case 'files 1':
        gmcpcfg.module_name = 'Files';
        gmcpcfg.version = '1';
        cb_add_gmcp_module(gmcpcfg);
        return;
      case 'char':
      case 'char 1':
        gmcpcfg.module_name = 'Char';
        gmcpcfg.version = '1';
        cb_add_gmcp_module(gmcpcfg);
        return;
      case 'char.items':
      case 'char.items 1':
        gmcpcfg.module_name = 'Char.Items';
        gmcpcfg.version = '1';
        cb_add_gmcp_module(gmcpcfg);
        return;
      case 'comm':
      case 'comm 1':
        gmcpcfg.module_name = 'Comm';
        gmcpcfg.version = '1';
        cb_add_gmcp_module(gmcpcfg);
        return;
      case 'playermap':
      case 'playermap 1':
        gmcpcfg.module_name = 'PlayerMap';
        gmcpcfg.version = '1';
        cb_add_gmcp_module(gmcpcfg);
        return;
    }
  }

  public init_module(_id: string, mod: string) {
    const cb_switch = this.get_mudconf(_id, 'cb_mudSwitchGmcpModule');
    switch (mod.toLowerCase()) {
      case 'sound':
      case 'sound 1':
        cb_switch(_id, 'Sound 1', true);
        return;
      case 'char':
      case 'char 1':
        cb_switch(_id, 'Char 1', true);
        return;
      case 'files':
      case 'files 1':
        cb_switch(_id, 'Files 1', true);
        return;
      case 'input':
      case 'input 1':
        return;
      case 'char.items':
      case 'char.items 1':
        cb_switch(_id, 'Char.Items 1', true);
        return;
      case 'comm':
      case 'comm 1':
      case 'playermap':
      case 'playermap 1':
    }
  }
  public delete_module(_id: string, mod: string) {
    const cb_switch = this.get_mudconf(_id, 'cb_mudSwitchGmcpModule');
    const cb_remove_gmcp_module = this.get_mudconf(
      _id,
      'cb_remove_gmcp_module',
    );
    switch (mod.toLowerCase()) {
      case 'sound':
      case 'sound 1':
        cb_remove_gmcp_module(_id, 'Sound');
        cb_switch(_id, 'Sound', false);
        return;
      case 'char':
      case 'char 1':
      case 'char.items':
      case 'char.items 1':
      case 'comm':
      case 'comm 1':
      case 'playermap':
      case 'playermap 1':
    }
  }
}
