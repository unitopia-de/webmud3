import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';

import {
  DEFAULT_TERMINAL_THEME_ID,
  isTerminalThemeId,
  TERMINAL_THEMES,
  TerminalThemeDefinition,
  TerminalThemeId,
} from './terminal-themes';

const STORAGE_SUFFIX = 'webmud3-terminal-theme';

/**
 * Runtime-toggleable terminal theme. Mirrors the `SpeechSettingsService`
 * pattern: BehaviorSubject for reactive consumers, synchronous getter for
 * non-Angular callers, persistence via `namespacedStorage` so the choice
 * survives reloads.
 *
 * Components / services that own a `Terminal` instance should subscribe to
 * `theme$` and apply the resulting `ITheme` plus `minimumContrastRatio` to
 * their terminal — the service does not know about specific terminals itself.
 */
@Injectable({ providedIn: 'root' })
export class TerminalThemeService {
  private readonly themeIdSubject = new BehaviorSubject<TerminalThemeId>(
    DEFAULT_TERMINAL_THEME_ID,
  );

  /** Stream of the currently active theme definition (full object). */
  public readonly theme$: Observable<TerminalThemeDefinition>;

  /** Stream of just the id, for menu state synchronization. */
  public readonly themeId$: Observable<TerminalThemeId>;

  constructor() {
    this.loadFromStorage();
    this.themeId$ = this.themeIdSubject.asObservable();
    this.theme$ = new Observable<TerminalThemeDefinition>((sub) => {
      const inner = this.themeIdSubject.subscribe((id) => {
        sub.next(TERMINAL_THEMES[id]);
      });
      return () => inner.unsubscribe();
    });
  }

  public get themeId(): TerminalThemeId {
    return this.themeIdSubject.value;
  }

  public get theme(): TerminalThemeDefinition {
    return TERMINAL_THEMES[this.themeIdSubject.value];
  }

  public setTheme(id: TerminalThemeId): void {
    if (!isTerminalThemeId(id)) {
      return;
    }
    if (this.themeIdSubject.value === id) {
      return;
    }
    this.themeIdSubject.next(id);
    this.persist();
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  private loadFromStorage(): void {
    const raw = namespacedStorage.get(STORAGE_SUFFIX);
    if (!raw) {
      return;
    }
    if (isTerminalThemeId(raw)) {
      this.themeIdSubject.next(raw);
    }
  }

  private persist(): void {
    namespacedStorage.set(STORAGE_SUFFIX, this.themeIdSubject.value);
  }
}
