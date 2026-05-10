import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * One `<stat>` definition pushed by the server during init_mxp().
 *
 * Example UNItopia inputs:
 *   <stat ap max=maxap caption="AP:">
 *   <stat zp max=maxzp caption="LP:">
 *
 * `name` is the entity to display (e.g. `ap`); `maxName` is the entity that
 * holds the maximum value (e.g. `maxap`) — both are looked up via
 * `MxpEntityService` at render time. `caption` is the short label shown
 * before the value.
 */
export type MxpStat = {
  name: string;
  maxName?: string;
  caption?: string;
};

/**
 * Reactive store for `<stat>` definitions. Definitions accumulate during a
 * session; on reconnect the server resends them, so consumers should call
 * `clear()` first to avoid duplicates with stale captions.
 */
@Injectable({ providedIn: 'root' })
export class MxpStatService {
  private readonly statsSubject = new BehaviorSubject<readonly MxpStat[]>([]);

  public readonly stats$: Observable<readonly MxpStat[]> =
    this.statsSubject.asObservable();

  public get stats(): readonly MxpStat[] {
    return this.statsSubject.value;
  }

  /**
   * Adds or replaces a stat definition. Replacement happens by `name`, so
   * a server that re-sends the same stat with an updated caption updates
   * the existing entry instead of producing a duplicate.
   */
  public upsert(stat: MxpStat): void {
    const current = this.statsSubject.value;
    const idx = current.findIndex((s) => s.name === stat.name);
    if (idx === -1) {
      this.statsSubject.next([...current, stat]);
      return;
    }
    const existing = current[idx];
    if (
      existing.maxName === stat.maxName &&
      existing.caption === stat.caption
    ) {
      return;
    }
    const next = [...current];
    next[idx] = stat;
    this.statsSubject.next(next);
  }

  public clear(): void {
    if (this.statsSubject.value.length === 0) {
      return;
    }
    this.statsSubject.next([]);
  }
}
