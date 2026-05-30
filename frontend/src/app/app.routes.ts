import { Routes } from '@angular/router';

import { ClassicShellComponent } from '@webmud3/frontend/core/shells/classic-shell/classic-shell.component';
import { EzShellComponent } from '@webmud3/frontend/core/shells/ez-shell/ez-shell.component';

/**
 * Top-level routes for the WebMUD3 frontend.
 *
 * - `/`    — ClassicShellComponent: xterm-based input + output, the
 *            shipping default. **Must remain visually and behaviourally
 *            identical to the pre-routing version of the app.**
 * - `/ez`  — EzShellComponent: splitscreen variant with native input
 *            controls. Built out incrementally in SPLITSCREEN_TODO.md
 *            phases 2–8. Currently a stub.
 * - `**`   — any other path redirects to `/`. The backend already serves
 *            `index.html` for unknown paths (catch-all in
 *            backend/src/core/routes/routes.ts), so deep-linking into
 *            either route works.
 */
export const routes: Routes = [
  { path: '', component: ClassicShellComponent, pathMatch: 'full' },
  { path: 'ez', component: EzShellComponent },
  { path: '**', redirectTo: '' },
];
