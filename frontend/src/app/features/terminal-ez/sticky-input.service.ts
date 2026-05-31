import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';

const STORAGE_SUFFIX = 'webmud3-ez-sticky-input';

/**
 * User preference for the EZ-Shell's "sticky input line" (Idee 1).
 *
 * When enabled, the default-mode input keeps the just-sent command in the
 * line and selects it instead of clearing it. That lets the user repeat a
 * command with bare Enter ("n, Enter, Enter, Enter" = 3× north) while the
 * first keystroke overwrites the whole selection.
 *
 * Opt-in (default off) and persisted per deployment so it survives reloads.
 * Lives in its own root singleton because the toggle is registered by the
 * shell (footer menu) but read by the input component.
 */
@Injectable({ providedIn: 'root' })
export class StickyInputService {
  private readonly enabledSubject = new BehaviorSubject<boolean>(false);
  public readonly enabled$: Observable<boolean> =
    this.enabledSubject.asObservable();

  constructor() {
    const raw = namespacedStorage.get(STORAGE_SUFFIX);
    if (raw === '1' || raw === 'true') {
      this.enabledSubject.next(true);
    }
    // Anything else (including the default empty key) keeps the initial
    // `false` value — the feature is off out of the box.
  }

  /** Synchronous read for the input component. */
  public get enabled(): boolean {
    return this.enabledSubject.value;
  }

  public setEnabled(enabled: boolean): void {
    if (this.enabledSubject.value === enabled) {
      return;
    }
    this.enabledSubject.next(enabled);
    namespacedStorage.set(STORAGE_SUFFIX, enabled ? '1' : '0');
  }

  public toggle(): boolean {
    const next = !this.enabledSubject.value;
    this.setEnabled(next);
    return next;
  }
}
