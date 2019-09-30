import { Injectable, Inject } from '@angular/core';
import { WINDOW } from './WINDOW_PROVIDERS';
import { DeviceDetectorService } from 'ngx-device-detector';

@Injectable({
  providedIn: 'root'
})
export class ServerConfigService {
  private originMap = {
    'http://localhost:5000':'http://localhost:5000',
    'http://localhost:4200':'http://localhost:5000',
    'http://localhost:2018':'http://localhost:2018',
  };
  private deviceInfo = null;
  private browserInfo = {};


  getBackend(): string {
    // console.log(this.window);
    const l_origin = this.window.location.origin;
    const l_path = this.window.location.pathname;
    if (l_origin == 'https://www.unitopia.de' && l_path.startsWith('/webmud3/')) {
      return 'https://www.unitopia.de/mysocket.io/';
    }

    // console.log('l_origin:',l_origin);
    if (this.originMap.hasOwnProperty(l_origin)) {
      return this.originMap[l_origin];
    }
    return l_origin;
  }

  getWebmudName(): string {
    return "Webmud3";
  }

  getWebmudVersion(): string {
    return "v0.0.37";
  }

  getUNItopiaName() : string {
    return 'unitopia';
  }

  getOrbitName():string {
    return 'orbit';
  }

  getUni1993Name():string {
    return 'uni1993';
  }

  getBrowserInfo():Object {
    return this.browserInfo;
  }

  displayBrowser() {
    this.deviceInfo = this.deviceService.getDeviceInfo();
    const isMobile = this.deviceService.isMobile();
    const isTablet = this.deviceService.isTablet();
    const isDesktopDevice = this.deviceService.isDesktop();
    this.browserInfo["browser"] = this.deviceInfo.browser;
    this.browserInfo["browser_version"] = this.deviceInfo.browser_version;
    this.browserInfo["os"] = this.deviceInfo.os;
    this.browserInfo["os_version"] = this.deviceInfo.os_version;
    this.browserInfo["userAgent"] = this.deviceInfo.userAgent;
    this.browserInfo["isMobile"] = isMobile;
    this.browserInfo["isTablet"] = isTablet;
    this.browserInfo["isDesktop"] = isDesktopDevice;
    console.log('Device_info: ', this.deviceInfo);
  }

  constructor(@Inject(WINDOW) private window:Window,private deviceService: DeviceDetectorService) {
    this.displayBrowser();
   }
}
