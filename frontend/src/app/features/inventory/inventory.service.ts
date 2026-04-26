import { inject, Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';

import { MudSignalService } from '@webmud3/frontend/features/gmcp/signals/mud-signal.service';
import type { InventoryEntry } from '@webmud3/frontend/features/gmcp/signals/mud-signals';

/**
 * Inventory grouped by category, e.g.:
 *   { "Waffen": ["Schwert", "Dolch"], "Trank": ["Heiltrank"] }
 */
export type InventoryByCategory = Record<string, string[]>;

/**
 * Holds the player's inventory state, derived from Char.Items.* GMCP signals.
 *
 * The MUD sends:
 *   - Char.Items.List   — full list (typically once after enabling Char.Items)
 *   - Char.Items.Add    — single item added
 *   - Char.Items.Remove — single item removed
 */
@Injectable({ providedIn: 'root' })
export class InventoryService implements OnDestroy {
  private readonly signals = inject(MudSignalService);

  private readonly itemsSubject = new BehaviorSubject<InventoryByCategory>({});
  private readonly subscriptions: Subscription[] = [];

  /** Reactive view of the inventory grouped by category */
  public readonly items$ = this.itemsSubject.asObservable();

  constructor() {
    this.subscriptions.push(
      this.signals.on('Char.Items.List').subscribe((s) => {
        console.info(
          `[Inventory] Char.Items.List received with ${s.entries?.length ?? 0} entries`,
          s.entries?.slice(0, 3),
        );
        this.replaceAll(s.entries);
      }),
      this.signals.on('Char.Items.Add').subscribe((s) => {
        console.info('[Inventory] Char.Items.Add', s.entry);
        this.addItem(s.entry);
      }),
      this.signals.on('Char.Items.Remove').subscribe((s) => {
        console.info('[Inventory] Char.Items.Remove', s.entry);
        this.removeItem(s.entry);
      }),
    );
  }

  ngOnDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }

  /** Synchronous snapshot of the current inventory */
  public get items(): InventoryByCategory {
    return this.itemsSubject.value;
  }

  public clear(): void {
    this.itemsSubject.next({});
  }

  // ---------------------------------------------------------------------------
  // Internal mutations
  // ---------------------------------------------------------------------------

  private replaceAll(entries: InventoryEntry[]): void {
    const next: InventoryByCategory = {};

    for (const entry of entries ?? []) {
      this.appendInto(next, entry);
    }

    this.itemsSubject.next(next);
  }

  private addItem(entry: InventoryEntry): void {
    const next: InventoryByCategory = { ...this.itemsSubject.value };

    this.appendInto(next, entry);

    this.itemsSubject.next(next);
  }

  private removeItem(entry: InventoryEntry): void {
    const current = this.itemsSubject.value;
    const list = current[entry.category];

    if (!list) {
      return;
    }

    const idx = list.indexOf(entry.name);
    if (idx < 0) {
      return;
    }

    const nextList = [...list.slice(0, idx), ...list.slice(idx + 1)];
    const next: InventoryByCategory = { ...current };

    if (nextList.length === 0) {
      delete next[entry.category];
    } else {
      next[entry.category] = nextList;
    }

    this.itemsSubject.next(next);
  }

  private appendInto(
    target: InventoryByCategory,
    entry: InventoryEntry,
  ): void {
    if (!entry?.category || !entry?.name) {
      return;
    }

    const existing = target[entry.category];

    if (existing) {
      target[entry.category] = [...existing, entry.name];
    } else {
      target[entry.category] = [entry.name];
    }
  }
}
