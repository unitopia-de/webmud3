import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ShellPreferenceService } from '@webmud3/frontend/core/shells/shell-preference.service';
import { NetworkStatusService } from '@webmud3/frontend/features/connection/network-status.service';
import { PwaInstallService } from '@webmud3/frontend/features/connection/pwa-install.service';
import { PwaUpdateService } from '@webmud3/frontend/features/connection/pwa-update.service';

/**
 * Top-level application shell — now just a router outlet.
 *
 * Both the classic and the EZ variant live as sibling routes
 * (see app.routes.ts). The previous direct rendering of
 * `<app-mud-client> + <app-char-footer> + <app-window-container>` and
 * the `__windowService` debug hook have moved into
 * `ClassicShellComponent` so the `/` route stays visually and
 * behaviourally identical to the pre-routing version of the app.
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [RouterOutlet],
  standalone: true,
})
export class AppComponent {
  // PWA helpers, instantiated for their side effects so they are alive in both
  // shells (`/` and `/ez`). They listen globally (install prompt / SW version
  // updates) and register their own footer-menu entries. The `_` prefix marks
  // them as intentionally-unused injections.
  private readonly _pwaInstall = inject(PwaInstallService);
  private readonly _pwaUpdate = inject(PwaUpdateService);
  private readonly _networkStatus = inject(NetworkStatusService);
  // Tracks the last-used shell (`/` vs `/ez`) so an installed PWA can reopen
  // it on next launch. Instantiated here so the tracking is live from boot.
  private readonly _shellPreference = inject(ShellPreferenceService);
}
