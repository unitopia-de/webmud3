import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

import { ServerConfigService } from '../serverconfig/server-config.service';

/**
 * Frontend representation of a MUD entry as returned by the backend.
 */
export interface MudListEntry {
  /** Display name of the MUD */
  name: string;
  /** Human-readable description */
  description: string;
  /** MUD family key (e.g. "unitopia") */
  mudfamily: string;
}

/**
 * Response shape of `GET /api/mud-config`.
 */
export interface MudConfigResponse {
  /** Whether a valid MUD config was loaded on the backend */
  available: boolean;
  /** Map of MUD IDs to their sanitized info */
  muds: Record<string, MudListEntry>;
  /** Map of URL routes (e.g. "/" or "/orbit") to MUD IDs */
  routes: Record<string, string>;
}

/**
 * Service that loads the multi-MUD configuration from the backend.
 *
 * When the backend has no `mud_config.json` loaded, the service reports
 * `isMultiMud = false` and all lookups return `undefined` — the app then
 * behaves as a single-MUD deployment using TELNET_HOST/PORT env vars.
 */
@Injectable({ providedIn: 'root' })
export class MudConfigService {
  private readonly http = inject(HttpClient);
  private readonly serverConfig = inject(ServerConfigService);

  private config: MudConfigResponse | null = null;
  private readonly loaded = new BehaviorSubject<boolean>(false);

  /** Emits `true` once the config has been loaded (even if multi-MUD is not available). */
  public readonly loaded$ = this.loaded.asObservable();

  /** Whether the backend has a multi-MUD config loaded. */
  public get isMultiMud(): boolean {
    return this.config?.available === true;
  }

  /** Returns the full MUD list (empty object if single-MUD mode). */
  public get muds(): Record<string, MudListEntry> {
    return this.config?.muds ?? {};
  }

  /** Returns the route map (empty object if single-MUD mode). */
  public get routes(): Record<string, string> {
    return this.config?.routes ?? {};
  }

  /**
   * Resolves a route path (e.g. "/" or "/orbit") to the corresponding MUD ID.
   */
  public getMudIdForRoute(routePath: string): string | undefined {
    return this.routes[routePath];
  }

  /**
   * Resolves a MUD ID from the route map or returns the ID itself if it
   * exists as a direct key in the muds map.
   */
  public resolveMudId(idOrRoute: string): string | undefined {
    // First try direct lookup
    if (this.muds[idOrRoute]) {
      return idOrRoute;
    }

    // Then try route lookup (with leading slash)
    const routeKey = idOrRoute.startsWith('/') ? idOrRoute : `/${idOrRoute}`;
    return this.routes[routeKey];
  }

  /**
   * Returns the default MUD ID (the one mapped to "/").
   */
  public getDefaultMudId(): string | undefined {
    return this.routes['/'];
  }

  /**
   * Loads the MUD config from the backend.
   * Called during app initialization.
   */
  public async load(): Promise<void> {
    try {
      const backendUrl = this.serverConfig
        .getBackendUrl()
        .replace(/\/$/, '');

      const response = await firstValueFrom(
        this.http.get<MudConfigResponse>(`${backendUrl}/api/mud-config`),
      );

      this.config = response;

      console.info(
        '[MudConfigService] Loaded config:',
        response.available
          ? `${Object.keys(response.muds).length} MUDs available`
          : 'Single-MUD mode',
      );
    } catch (error) {
      console.warn(
        '[MudConfigService] Failed to load MUD config, assuming single-MUD mode.',
        error,
      );

      this.config = { available: false, muds: {}, routes: {} };
    }

    this.loaded.next(true);
  }
}
