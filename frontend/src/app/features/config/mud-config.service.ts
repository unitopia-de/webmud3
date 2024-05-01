import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MudConfig } from './mud-config';

import config from '../../../mud_config.json';

@Injectable({
  providedIn: 'root',
})
export class MudConfigService {
  data: MudConfig = {};

  constructor(private http: HttpClient) {}

  load(): Promise<MudConfig> {
    return new Promise<MudConfig>((resolve) => {

      this.data = config;

      resolve(config);

      // this.http.get(getBaseLocation() + 'config/mud_config.json').subscribe(
      //   (response) => {
      //     // console.log('USING server-side configuration');
      //     this.data = Object.assign({}, defaults || {}, response || {});
      //     console.log('server-side-scope:', this.data);
      //     resolve(this.data);
      //   },
      //   () => {
      //     // console.log('USING default configuration, scope local');
      //     this.data = Object.assign({}, defaults || {});
      //     console.log('default-scope:', this.data);
      //     resolve(this.data);
      //   },
      // );
    });
  }
}
