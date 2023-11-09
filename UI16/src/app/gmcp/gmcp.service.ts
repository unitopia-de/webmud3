import { Injectable, EventEmitter } from '@angular/core';
import { GmcpMenu } from './gmcp-menu';
import { GmcpConfig } from './gmcp-config';
import { UnitopiaService } from '../mudconfig/unitopia.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GmcpService {
  private gmcpconfig: GmcpConfig[] = [];
  private gmcpconn = {};
  private gmcpmenus = {};
  private gmcpOb = {};
  private gmcpEvE = {};

  private add_mudConnAndModule(mud_id: string, module_name: string) {
    if (typeof this.gmcpconn[mud_id] === 'undefined') {
      this.gmcpconn[mud_id] = {};
    }
    if (typeof this.gmcpconn[mud_id][module_name] === 'undefined') {
      this.gmcpconn[mud_id][module_name] = {};
    }
    console.debug('GmcpService-add_mudConnAndModule', mud_id, module_name);
  }

  private find_menu(mud_id: string, actual_menu: GmcpMenu): number {
    if (typeof this.gmcpmenus[mud_id] === 'undefined') {
      return -1;
    }
    for (let i = 0; i < this.gmcpmenus[mud_id].length; i++) {
      const m = this.gmcpmenus[mud_id][i];
      if (actual_menu.name == m.name) {
        return i;
      }
    }
    return -1;
  }
  /* eslint @typescript-eslint/no-this-alias: "warn" */
  public menuAction(actual_menu: GmcpMenu) {
    console.debug('GmcpService-menuAction', actual_menu);
    const mud_id = actual_menu.cfg.mud_id;
    const index = this.find_menu(mud_id, actual_menu);
    const other = this;
    actual_menu.cfg.callback(
      actual_menu.action,
      actual_menu.cfg,
      actual_menu,
      index,
      function (reaction) {
        switch (reaction) {
          case 'toggle':
            if (index > -1) {
              other.gmcpmenus[mud_id][index].active =
                !other.gmcpmenus[mud_id][index].active;
              other.gmcpEvE[mud_id].emit(other.gmcpmenus[mud_id]);
              console.debug(
                'GmcpService-G05: emit-toggle',
                mud_id,
                other.gmcpmenus[mud_id],
              );
            }
        }
      },
    );
  }

  public GmcpObservableMenu(_id: string): Observable<GmcpMenu[]> {
    console.debug('GmcpService-GmcpObservableMenu-1', _id);
    if (typeof this.gmcpOb[_id] === 'undefined') {
      this.gmcpmenus[_id] = [];
      const other = this;
      this.gmcpEvE[_id] = new EventEmitter();
      const observable = new Observable<GmcpMenu[]>((observer) => {
        console.debug('GmcpService-G05: GmcpObservableMenu-2');
        observer.next(other.gmcpmenus[_id]);
        other.gmcpEvE[_id].subscribe((gmenu) => {
          console.debug('GmcpService-G05: GmcpObservableMenu-3', gmenu);
          observer.next(gmenu);
        });
      });
      this.gmcpOb[_id] = observable;
    }
    return this.gmcpOb[_id];
  }

  public add_gmcp_module(gcfg: GmcpConfig) {
    console.debug('GmcpService-add_gmcp_module-1', gcfg);
    gcfg.initial_menu.index = this.gmcpconfig.length;
    const actual_menu = Object.assign({}, gcfg.initial_menu);
    this.gmcpconfig.push(gcfg);
    this.add_mudConnAndModule(gcfg.mud_id, gcfg.module_name);
    const other = this;
    if (
      typeof gcfg.callback === 'function' &&
      typeof gcfg.initial_menu !== 'undefined' &&
      gcfg.initial_menu.name != ''
    ) {
      gcfg.callback(
        'add_gmcp_module',
        gcfg,
        actual_menu,
        actual_menu.index,
        function (chgmenu: string) {
          actual_menu.mud_id = gcfg.mud_id;
          actual_menu.cfg = gcfg;
          if (typeof other.gmcpmenus[gcfg.mud_id] === 'undefined') {
            actual_menu.index = 0;
            other.gmcpmenus[gcfg.mud_id] = [actual_menu];
            other.gmcpEvE[gcfg.mud_id] = new EventEmitter();
            const observable = new Observable<GmcpMenu[]>((observer) => {
              observer.next(other.gmcpmenus[gcfg.mud_id]);
              other.gmcpEvE[gcfg.mud_id].subscribe((gmenu) => {
                console.log('GmcpService-add_gmcp_module-2', gcfg, gmenu);
                observer.next(gmenu);
              });
            });
            other.gmcpOb[gcfg.mud_id] = observable;
          } else {
            actual_menu.index = other.gmcpmenus[gcfg.mud_id].length;
            other.gmcpmenus[gcfg.mud_id].push(actual_menu);
            other.gmcpEvE[gcfg.mud_id].emit(other.gmcpmenus[gcfg.mud_id]);
            console.log('GmcpService-add_gmcp_module-3', gcfg, actual_menu);
          }
        },
      );
    } else {
      // console.log('GmcpService-add_gmcp_module-4',gcfg);
    }
  }

  public set_gmcp_support(
    mud_id: string,
    gmcp_support: object,
    cb_mudSwitchGmcpModule,
  ) {
    if (typeof this.gmcpconn[mud_id] === 'undefined') {
      this.gmcpconn[mud_id] = {};
      this.gmcpconfig[mud_id] = {};
      this.gmcpOb[mud_id] = new Observable<GmcpMenu[]>();
    }
    const other = this;
    this.gmcpconfig[mud_id]['gmcp_support'] = gmcp_support;
    this.unitopiaSrv.set_callbacks(
      mud_id,
      cb_mudSwitchGmcpModule,
      function (gcfg: GmcpConfig) {
        other.add_gmcp_module(gcfg);
      },
      function (mud_id: string, module_name: string) {
        return other.remove_gmcp_module(mud_id, module_name);
      },
    );
    // console.log("gmcp_support",gmcp_support);
    Object.getOwnPropertyNames(gmcp_support).forEach((element) => {
      // console.log("gmcp_support-element-1",element);
      if (Object.prototype.hasOwnProperty.call(gmcp_support, element)) {
        const modver = element + ' ' + gmcp_support[element].version;
        // TODO pre configered modules...
        if (typeof other.gmcpconn[mud_id][element] === 'undefined') {
          if (
            gmcp_support['mudfamily'] == 'unitopia' &&
            gmcp_support[element].standard
          ) {
            // TODO dynamic mud-service
            // console.log("gmcp_support-modver-1",modver);
            other.unitopiaSrv.init_module(mud_id, modver);
            other.unitopiaSrv.init_module_config(mud_id, modver);
            other.gmcpconn[mud_id][element] = other.find(mud_id, element);
          }
        }
      }
    });
  }

  private find(mud_id: string, module_name: string): number {
    for (let i = 0; i < this.gmcpconfig.length; i++) {
      const m = this.gmcpconfig[i];
      if (m.module_name == module_name && m.mud_id == mud_id) {
        return i;
      }
    }
    return -1;
  }

  public remove_gmcp_module(mud_id: string, module_name: string): boolean {
    const index = this.find(mud_id, module_name);
    if (index >= 0) {
      this.gmcpconfig = this.gmcpconfig.filter(function (val, ix) {
        if (ix == index) return false;
        return true;
      });
      delete this.gmcpconn[mud_id][module_name];
      return true;
    }
    return false;
  }

  constructor(private unitopiaSrv: UnitopiaService) {}
}
