import { Routes } from '@angular/router';

import { ClassicShellComponent } from '@webmud3/frontend/core/shells/classic-shell/classic-shell.component';
import { EzShellComponent } from '@webmud3/frontend/core/shells/ez-shell/ez-shell.component';
import { lastShellRedirectGuard } from '@webmud3/frontend/core/shells/last-shell-redirect.guard';
import { HilfeComponent } from '@webmud3/frontend/features/hilfe/hilfe.component';

/**
 * Top-level routes for the WebMUD3 frontend.
 *
 * - `/`    — ClassicShellComponent: xterm-based input + output, the
 *            shipping default. **Must remain visually and behaviourally
 *            identical to the pre-routing version of the app.** When launched
 *            as an installed PWA, `lastShellRedirectGuard` may redirect this
 *            once to the user's last-used shell (`/ez`); in a browser tab it
 *            always stays the classic shell.
 * - `/ez`  — EzShellComponent: splitscreen variant with native input
 *            controls. Built out incrementally in SPLITSCREEN_TODO.md
 *            phases 2–8.
 * - `/hilfe` — HilfeComponent: static help page that explains both modes
 *            and links back to `/` and `/ez`. No MUD connection.
 * - `**`   — any other path redirects to `/`. The backend already serves
 *            `index.html` for unknown paths (catch-all in
 *            backend/src/core/routes/routes.ts), so deep-linking into
 *            either route works.
 */
export const routes: Routes = [
  {
    path: '',
    component: ClassicShellComponent,
    pathMatch: 'full',
    canActivate: [lastShellRedirectGuard],
  },
  { path: 'ez', component: EzShellComponent },
  { path: 'hilfe', component: HilfeComponent },
  { path: '**', redirectTo: 'hilfe' },
];
