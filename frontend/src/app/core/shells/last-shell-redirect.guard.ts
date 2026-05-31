import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { ShellPreferenceService } from './shell-preference.service';

/**
 * Has the one-time launch redirect already been evaluated for this app
 * instance? Module-level so it survives across the guard's invocations but
 * resets on a full reload (= a fresh app launch).
 */
let launchRedirectChecked = false;

/**
 * On the FIRST navigation of an installed PWA, redirects `/` to whichever
 * shell the user last used (see ShellPreferenceService). Only fires when the
 * app runs in standalone display mode, so a normal browser tab keeps `/` as
 * the classic shell — behaviourally identical to before. Subsequent in-app
 * navigations to `/` (e.g. the "Eingabe-Modus: klassisch" footer entry) are
 * never redirected, thanks to the one-shot flag.
 */
export const lastShellRedirectGuard: CanActivateFn = () => {
  const router = inject(Router);
  const shellPref = inject(ShellPreferenceService);

  if (launchRedirectChecked) {
    return true;
  }
  launchRedirectChecked = true;

  if (!isStandaloneDisplay()) {
    return true;
  }

  const remembered = shellPref.getRemembered();
  if (remembered === '/ez') {
    return router.parseUrl('/ez');
  }
  return true;
};

/** True when the page runs as an installed app (PWA standalone / iOS home). */
function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const standaloneMedia =
    window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
    true;
  return standaloneMedia || iosStandalone;
}
