import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Reactive store for MXP `<!ENTITY>` declarations.
 *
 * UNItopia pushes vital signs (and any other published variables) as
 * `<!ENTITY name "value" PUBLISH>` tags inside temp-secure mode windows.
 * The MxpStreamFilter parses each tag and routes it here via `set(name, value)`.
 *
 * Components / `MxpStatService` consume `entities$` to render values that
 * are bound by name (e.g. a `<stat ap …>` definition reads the current
 * `ap` entity).
 */
@Injectable({ providedIn: 'root' })
export class MxpEntityService {
  private readonly entitiesSubject = new BehaviorSubject<
    ReadonlyMap<string, string>
  >(new Map());

  /** Reactive snapshot — emits a fresh map whenever any entity changes. */
  public readonly entities$: Observable<ReadonlyMap<string, string>> =
    this.entitiesSubject.asObservable();

  /** Synchronous accessor — useful for non-Angular helpers. */
  public get(name: string): string | undefined {
    return this.entitiesSubject.value.get(name);
  }

  /** Merges a single entity into the map. No-op when value is identical. */
  public set(name: string, value: string): void {
    const current = this.entitiesSubject.value;
    if (current.get(name) === value) {
      return;
    }
    const next = new Map(current);
    next.set(name, value);
    this.entitiesSubject.next(next);
  }

  /** Drops every stored entity — call on disconnect / reconnect. */
  public clear(): void {
    if (this.entitiesSubject.value.size === 0) {
      return;
    }
    this.entitiesSubject.next(new Map());
  }
}
