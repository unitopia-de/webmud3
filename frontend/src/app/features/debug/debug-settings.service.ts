import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Runtime-toggleable debug switches. Each flag is exposed both as a
 * synchronous getter (for non-Angular helpers like the screen-reader
 * announcer) and as an Observable (for components / menu state).
 *
 * All flags default to `false` so no extra console output is produced
 * in normal usage.
 */
@Injectable({ providedIn: 'root' })
export class DebugSettingsService {
  private readonly screenReaderLoggingSubject = new BehaviorSubject<boolean>(
    false,
  );
  private readonly pasteLoggingSubject = new BehaviorSubject<boolean>(false);

  public readonly screenReaderLogging$ =
    this.screenReaderLoggingSubject.asObservable();
  public readonly pasteLogging$ = this.pasteLoggingSubject.asObservable();

  public get screenReaderLogging(): boolean {
    return this.screenReaderLoggingSubject.value;
  }

  public get pasteLogging(): boolean {
    return this.pasteLoggingSubject.value;
  }

  public setScreenReaderLogging(enabled: boolean): void {
    if (this.screenReaderLoggingSubject.value !== enabled) {
      this.screenReaderLoggingSubject.next(enabled);
    }
  }

  public setPasteLogging(enabled: boolean): void {
    if (this.pasteLoggingSubject.value !== enabled) {
      this.pasteLoggingSubject.next(enabled);
    }
  }

  public toggleScreenReaderLogging(): boolean {
    const next = !this.screenReaderLoggingSubject.value;
    this.screenReaderLoggingSubject.next(next);
    return next;
  }

  public togglePasteLogging(): boolean {
    const next = !this.pasteLoggingSubject.value;
    this.pasteLoggingSubject.next(next);
    return next;
  }
}
