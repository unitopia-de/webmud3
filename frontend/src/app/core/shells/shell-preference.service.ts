import { inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';

/** The two interactive shells the app can launch into. */
export type ShellPath = '/' | '/ez';

const STORAGE_SUFFIX = 'webmud3-last-shell';

/**
 * Remembers which shell (`/` classic or `/ez` splitscreen) the user last used
 * so an installed PWA can reopen it on the next launch (see
 * lastShellRedirectGuard).
 *
 * The preference is updated on every navigation that lands on a shell route;
 * `/hilfe` and other routes don't overwrite it. Persisted per deployment
 * (namespaced localStorage) so `/webmud3/` and `/webmud3test/` stay separate.
 */
@Injectable({ providedIn: 'root' })
export class ShellPreferenceService {
  private readonly router = inject(Router);

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const url = this.normalize(e.urlAfterRedirects);
        if (url === '/' || url === '/ez') {
          namespacedStorage.set(STORAGE_SUFFIX, url);
        }
      });
  }

  /** The remembered shell, or `null` if none stored / not a valid shell. */
  public getRemembered(): ShellPath | null {
    const raw = namespacedStorage.get(STORAGE_SUFFIX);
    return raw === '/' || raw === '/ez' ? raw : null;
  }

  /** Strips query/fragment and treats the empty path as the classic shell. */
  private normalize(url: string): string {
    const path = url.split(/[?#]/)[0];
    return path === '' ? '/' : path;
  }
}
