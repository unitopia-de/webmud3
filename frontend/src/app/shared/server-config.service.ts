import { Inject, Injectable } from '@angular/core';
import { UUID } from 'angular2-uuid';
import { DeviceDetectorService, DeviceInfo } from 'ngx-device-detector';
import { WINDOW } from './WINDOW_PROVIDERS';

interface BrowserInfo {
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  userAgent: string;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  clientType: string;
  clientID: string;
}

@Injectable({
  providedIn: 'root',
})
export class ServerConfigService {
  private originMap = {
    'http://localhost:5000': 'http://localhost:5000',
    'http://localhost:4200': 'http://localhost:5000',
    'http://localhost:2018': 'http://localhost:2018',
  };

  private deviceInfo: DeviceInfo | null = null;

  private browserInfo: BrowserInfo | null = null;

  /**
   * getBackend returns the socket-Connection string depending on the origin and path.
   *
   * @returns {string} the socket-Connection string.
   * @memberof ServerConfigService
   * @depreceated not valid, see full source code
   */
  getBackend(): string {
    const l_origin = this.window.location.origin;
    const l_path = this.window.location.pathname;

    if (
      l_origin == 'https://www.unitopia.de' &&
      l_path.startsWith('/webmud3/')
    ) {
      return 'https://www.unitopia.de/mysocket.io/';
    }

    if (
      l_origin == 'https://www.unitopia.de' &&
      l_path.startsWith('/webmud3test/')
    ) {
      return 'https://www.unitopia.de/mysocket-test.io/';
    }

    if (Object.prototype.hasOwnProperty.call(this.originMap, l_origin)) {
      return this.originMap[l_origin as keyof typeof this.originMap];
    }

    return l_origin;
  }

  /**
   * REturns the code identifier, which socket Backend is valid. 0 for others.
   *
   * @returns {number}  &1 if UNItopia &2 if Test => 0,1,3.
   * @memberof ServerConfigService
   */
  getBackendCode(): number {
    const l_origin = this.window.location.origin;
    const l_path = this.window.location.pathname;

    if (
      l_origin == 'https://www.unitopia.de' &&
      l_path.startsWith('/webmud3/')
    ) {
      return 1;
    }

    if (
      l_origin == 'https://www.unitopia.de' &&
      l_path.startsWith('/webmud3test/')
    ) {
      return 3;
    }

    if (
      l_origin == 'https://www.seifenblase.de' &&
      l_path.startsWith('/webmud3/')
    ) {
      return 4;
    }

    if (
      l_origin == 'https://seifenblase.de' &&
      l_path.startsWith('/webmud3/')
    ) {
      return 4;
    }

    if (
      l_origin == 'https://mud.seifenblase.de' &&
      l_path.startsWith('/webmud3/')
    ) {
      return 4;
    }

    if (
      l_origin == 'https://seifenblase.mud.de' &&
      l_path.startsWith('/webmud3/')
    ) {
      return 4;
    }

    if (l_origin == 'https://seife.mud.de' && l_path.startsWith('/webmud3/')) {
      return 4;
    }

    return 0;
  }

  /**
   * returns the valid socket namespace depending on the backend code.
   *
   * @returns {string} the valid socket namespace.
   * @memberof ServerConfigService
   */
  getSocketNamespace(): string {
    switch (this.getBackendCode()) {
      case 1:
        return '/mysocket.io';
      case 3:
        return '/mysocket-test.io';
      case 4:
        return '/sbsocket.io';
      default:
        return '/socket.io';
    }
  }

  getApiUrl(): string {
    const l_origin = this.window.location.origin;

    switch (this.getBackendCode()) {
      case 1:
        return l_origin + '/webmud3/api/';
      case 3:
        return l_origin + '/webmud3test/api/';
      case 4:
        return l_origin + '/webmud3/api/';
      default:
        return l_origin + '/api/';
    }
  }
  /**
   * returns the current Webmud-Name.
   *
   * @returns {string} The string "Webmud3"
   * @memberof ServerConfigService
   */
  getWebmudName(): string {
    return 'Webmud3';
  }

  /**
   * Returns the current version string.
   *
   * @returns {string} Version-String
   * @memberof ServerConfigService
   */
  getWebmudVersion(): string {
    return 'v0.4.0';
  }
  /**
   * Returns the corresponding string out of the server configuration to identify unitopia.
   *
   * @returns {string} string 'unitopia'
   * @memberof ServerConfigService
   */
  getUNItopiaName(): string {
    return 'unitopia';
  }

  /**
   * Returns the corresponding string out of the server configuration to identify orbit.
   *
   * @returns {string} string 'orbit'
   * @memberof ServerConfigService
   */
  getOrbitName(): string {
    return 'orbit';
  }

  /**
   * Returns the corresponding string out of the server configuration to identify uni1993.
   *
   * @returns {string} string 'uni1993'
   * @memberof ServerConfigService
   */
  getUni1993Name(): string {
    return 'uni1993';
  }

  /**
   * Returns the corresponding string out of the server configuration to identify uni1993.
   *
   * @returns {string} string 'uni1993'
   * @memberof ServerConfigService
   */
  getSeifenblase(): string {
    return 'seifenblase';
  }

  /**
   * returns some browserinformation...
   *
   * @returns {BrowserInfo} some brower information
   * @memberof ServerConfigService
   */
  getBrowserInfo(): BrowserInfo | null {
    return this.browserInfo;
  }

  private displayBrowser() {
    this.deviceInfo = this.deviceService.getDeviceInfo();

    const isMobile = this.deviceService.isMobile();
    const isTablet = this.deviceService.isTablet();
    const isDesktopDevice = this.deviceService.isDesktop();

    let clientType: string;

    if (isDesktopDevice) {
      clientType = 'Desktop';
    } else if (isMobile) {
      clientType = 'Mobile';
    } else if (isTablet) {
      clientType = 'Tablet';
    } else {
      clientType = 'Unknown';
    }

    this.browserInfo = {
      browser: this.deviceInfo.browser,
      browser_version: this.deviceInfo.browser_version,
      os: this.deviceInfo.os,
      os_version: this.deviceInfo.os_version,
      userAgent: this.deviceInfo.userAgent,
      isMobile: isMobile,
      isTablet: isTablet,
      isDesktop: isDesktopDevice,
      clientType: clientType,
      clientID: UUID.UUID(),
    };
  }

  constructor(
    @Inject(WINDOW) private window: Window,
    private deviceService: DeviceDetectorService,
  ) {
    this.displayBrowser();
  }
}
