import { Injectable, Inject } from '@angular/core';
import { WINDOW } from './WINDOW_PROVIDERS';
import { DeviceDetectorService } from 'ngx-device-detector';
import { UUID } from 'angular2-uuid';
import {NGXLogger} from 'ngx-logger';

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
/**
 * getBackend returns the socket-Connection string depending on the origin and path.
 *
 * @returns {string} the socket-Connection string.
 * @memberof ServerConfigService
 */
  getBackend(): string {
    const l_origin = this.window.location.origin;
    const l_path = this.window.location.pathname;
    if (l_origin == 'https://www.unitopia.de' && l_path.startsWith('/webmud3/')) {
      return 'https://www.unitopia.de/mysocket.io/';
    }
    if (l_origin == 'https://www.unitopia.de' && l_path.startsWith('/webmud3test/')) {
      return 'https://www.unitopia.de/mysocket-test.io/';
    }
    if (this.originMap.hasOwnProperty(l_origin)) {
      return this.originMap[l_origin];
    }
    return l_origin;
  }

  /**
   * REturns the code identifier, which socket Backend is valid. 0 for others.
   *
   * @returns {number}  &1 if UNItopia &2 if Test => 0,1,3.
   * @memberof ServerConfigService
   */
  getBackendCode():number{
    const l_origin = this.window.location.origin;
    const l_path = this.window.location.pathname;
    if (l_origin == 'https://www.unitopia.de' && l_path.startsWith('/webmud3/')) {
      return 1;
    }
    if (l_origin == 'https://www.unitopia.de' && l_path.startsWith('/webmud3test/')) {
      return 3;
    }
    return 0;
  }
/**
 * returns the valid socket namespace depending on the backend code.
 *
 * @returns {string} the valid socket namespace.
 * @memberof ServerConfigService
 */
  getSocketNamespace():string {
    switch (this.getBackendCode()) {
      case 1: return '/mysocket.io';
      case 3: return '/mysocket-test.io';
      default: return "/socket.io";
    }
  }
/**
 * returns the current Webmud-Name.
 *
 * @returns {string} The string "Webmud3"
 * @memberof ServerConfigService
 */
  getWebmudName(): string {
    return "Webmud3";
  }
/**
 * Returns the current version string.
 *
 * @returns {string} Version-String
 * @memberof ServerConfigService
 */
  getWebmudVersion(): string {
    return "v0.0.44";
  }
/**
 * Returns the corresponding string out of the server configuration to identify unitopia.
 *
 * @returns {string} string 'unitopia'
 * @memberof ServerConfigService
 */
  getUNItopiaName() : string {
    return 'unitopia';
  }

/**
 * Returns the corresponding string out of the server configuration to identify orbit.
 *
 * @returns {string} string 'orbit'
 * @memberof ServerConfigService
 */
  getOrbitName():string {
    return 'orbit';
  }

/**
 * Returns the corresponding string out of the server configuration to identify uni1993.
 *
 * @returns {string} string 'uni1993'
 * @memberof ServerConfigService
 */
  getUni1993Name():string {
    return 'uni1993';
  }
/**
 * returns some browserinformation...
 *
 * @returns {Object} some brower information
 * @memberof ServerConfigService
 */
  getBrowserInfo():Object {
    return this.browserInfo;
  }

  private displayBrowser() {
    this.deviceInfo = this.deviceService.getDeviceInfo();
    const isMobile = this.deviceService.isMobile();
    const isTablet = this.deviceService.isTablet();
    const isDesktopDevice = this.deviceService.isDesktop();
    var clientType : string;
    if (isDesktopDevice) {
      clientType = 'Desktop';
    } else if (isMobile) {
      clientType = 'Mobile';
    } else if (isTablet) {
      clientType = 'Tablet';
    } else {
      clientType = 'Unknown';
    }
    this.browserInfo["browser"] = this.deviceInfo.browser;
    this.browserInfo["browser_version"] = this.deviceInfo.browser_version;
    this.browserInfo["os"] = this.deviceInfo.os;
    this.browserInfo["os_version"] = this.deviceInfo.os_version;
    this.browserInfo["userAgent"] = this.deviceInfo.userAgent;
    this.browserInfo["isMobile"] = isMobile;
    this.browserInfo["isTablet"] = isTablet;
    this.browserInfo["isDesktop"] = isDesktopDevice;
    this.browserInfo["clientType"] = clientType;
    this.browserInfo["clientID"] = UUID.UUID();
    this.logger.trace('Browser and DeviceInfo: ',this.browserInfo,this.deviceInfo);
  }

  constructor(@Inject(WINDOW) private window:Window,private deviceService: DeviceDetectorService,private logger:NGXLogger) {
    this.displayBrowser();
   }
}
