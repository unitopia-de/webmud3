import { Injectable, Inject } from '@angular/core';
import { WINDOW } from './WINDOW_PROVIDERS';

@Injectable({
  providedIn: 'root'
})
export class ServerConfigService {
  private originMap = {
    'http://localhost:5000':'http://localhost:5000',
    'http://localhost:4200':'http://localhost:5000',
    'http://localhost:2018':'http://localhost:2018',
  };


  getBackend(): string {
    console.log(this.window);
    var l_origin = this.window.location.origin;
    if (this.originMap.hasOwnProperty(l_origin)) {
      return this.originMap[l_origin];
    }
    return l_origin;
  }

  getWebmudName(): string {
    return "Webmud3";
  }

  getWebmudVersion(): string {
    return "v0.0.13";
  }

  getUNItopiaName() : string {
    return 'unitopia';
  }

  getOrbitName():string {
    return 'orbit';
  }

  constructor(@Inject(WINDOW) private window:Window) { }
}
