import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MudConfig } from './mud-config';
import { getBaseLocation } from './app-common-functions';

@Injectable({
  providedIn: 'root'
})
export class MudConfigService {

  data: MudConfig = {};

  constructor(private http: HttpClient) {}

  load(defaults?: MudConfig): Promise<MudConfig> {
    return new Promise<MudConfig>(resolve => {
      this.http.get(getBaseLocation()+'config/mud_config.json').subscribe(
        response => {
          // console.log('USING server-side configuration');
          this.data = Object.assign({}, defaults || {}, response || {});
          console.log("server-side-scope:",this.data);
          resolve(this.data);
        },
        () => {
          // console.log('USING default configuration, scope local');
          this.data = Object.assign({}, defaults || {});
          console.log("default-scope:",this.data);
          resolve(this.data);
        }
      );
    });
  }
}
