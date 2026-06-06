import { Injectable, signal } from '@angular/core';

import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';

const STORAGE_SUFFIX = 'webmud3-ez-quiet-output';

/**
 * User preference for the EZ-Shell's "quiet output" mode.
 *
 * The default screen-reader pipeline appends to the aria-live region on every
 * output chunk and creates one history node per line. That suits Windows
 * NVDA/JAWS, but iOS VoiceOver chokes on the high mutation rate + large DOM:
 * a single room can lag for many seconds while VoiceOver works through the
 * announcement backlog and rescans the tree.
 *
 * When enabled, the announcer coalesces announcements into one node per ~200ms
 * and keeps much smaller history/live caps — far fewer, smaller mutations for
 * VoiceOver. Opt-in (default off) and persisted, so the validated NVDA/JAWS
 * behaviour stays the default and VoiceOver users switch it on themselves.
 *
 * Own root singleton because the toggle is registered by the shell (footer
 * menu) but the flag is read by the output component — mirrors the existing
 * StickyInputService / PerfHudService pattern.
 */
@Injectable({ providedIn: 'root' })
export class QuietOutputService {
  /** Reactive flag the output component / announcer read. */
  public readonly enabled = signal(false);

  constructor() {
    this.enabled.set(namespacedStorage.get(STORAGE_SUFFIX) === '1');
  }

  public setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
    if (enabled) {
      namespacedStorage.set(STORAGE_SUFFIX, '1');
    } else {
      namespacedStorage.remove(STORAGE_SUFFIX);
    }
  }

  public toggle(): boolean {
    const next = !this.enabled();
    this.setEnabled(next);
    return next;
  }
}
