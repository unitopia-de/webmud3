import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { HttpClient } from '@angular/common/http';
import type { ServerConfig } from '@webmud3/shared';

@Injectable({
  providedIn: 'root',
})
export class ServerConfigService {
  private readonly httpClient = inject(HttpClient);

  private readonly configUrl = this.buildBackendUrl('/api/config');

  private serverConfiguration: ServerConfig | null = null;

  /**
   * Loads the server configuration from the backend before the application bootstraps.
   *
   * @returns {Promise<void>} resolves once the configuration has been loaded (or a fallback was used).
   * @memberof ServerConfigService
   */
  async load(): Promise<void> {
    const configuration = await firstValueFrom(
      this.httpClient.get<ServerConfig>(this.configUrl),
    );

    this.serverConfiguration = configuration;
  }

  /**
   * returns the valid socket namespace depending on the backend code.
   *
   * @returns {string} the valid socket namespace.
   * @memberof ServerConfigService
   */
  public getSocketNamespace(): string {
    if (!this.serverConfiguration?.socketNamespace) {
      throw new Error(
        '[ServerConfigService] Socket namespace is not configured. Did you forget to call load()?',
      );
    }

    return this.serverConfiguration.socketNamespace;
  }

  public getBackendUrl(): string {
    return environment.backendUrl();
  }

  private buildBackendUrl(path: string): string {
    const backendUrl = environment.backendUrl().replace(/\/$/, '');

    return `${backendUrl}${path}`;
  }
}
