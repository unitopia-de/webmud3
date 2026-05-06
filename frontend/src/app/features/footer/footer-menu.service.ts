import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * A single entry in the footer menu.
 *
 * Items with `children` open a flyout submenu instead of running `action`
 * directly. Submenus are exactly one level deep — nested children are not
 * supported, since nested submenus on touch devices are notoriously fiddly
 * and we don't currently have a use case for them.
 */
export type FooterMenuItem = {
  /** Unique id of the item */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon (emoji or character) shown before the label */
  icon?: string;
  /** Whether the item is currently checked / toggled on */
  checked?: boolean;
  /** Whether the item is disabled */
  disabled?: boolean;
  /**
   * Sort key. Lower values are listed first; entries without `order` are
   * treated as `DEFAULT_MENU_ORDER` (= mid range), so they end up below
   * items that explicitly request a top position and above items that
   * explicitly request the bottom. Stable: items with the same `order`
   * keep their registration order.
   */
  order?: number;
  /**
   * Callback invoked when the item is clicked. Required for leaf items;
   * for items that have `children` it is optional (a click on the parent
   * opens the submenu, the action — if any — runs in addition).
   */
  action?: () => void;
  /** Optional submenu. When present, the item is rendered as a flyout. */
  children?: FooterMenuItem[];
};

export const DEFAULT_MENU_ORDER = 100;

/**
 * Manages dynamic items for the footer menu (gear button on the right
 * side of the CharFooter). Other features can register entries here
 * to expose actions or toggles to the user (e.g. "Show inventory").
 */
@Injectable({ providedIn: 'root' })
export class FooterMenuService {
  private readonly itemsSubject = new BehaviorSubject<FooterMenuItem[]>([]);

  public readonly items$: Observable<FooterMenuItem[]> =
    this.itemsSubject.asObservable();

  /**
   * Adds or replaces a menu item. The resulting list is kept stably sorted
   * by `order` (entries without `order` use `DEFAULT_MENU_ORDER`), so a
   * caller that wants a fixed top/bottom position can simply set `order`
   * once at registration time.
   */
  public register(item: FooterMenuItem): void {
    const remaining = this.itemsSubject.value.filter((i) => i.id !== item.id);
    const next = [...remaining, item];

    // Decorate with the original index so ties (same `order`) keep their
    // registration order — Array.prototype.sort is not guaranteed stable
    // across all engines for large arrays, but this works regardless.
    const decorated = next.map((it, idx) => ({ it, idx }));
    decorated.sort((a, b) => {
      const oa = a.it.order ?? DEFAULT_MENU_ORDER;
      const ob = b.it.order ?? DEFAULT_MENU_ORDER;
      return oa !== ob ? oa - ob : a.idx - b.idx;
    });

    this.itemsSubject.next(decorated.map((d) => d.it));
  }

  /**
   * Removes a menu item by id.
   */
  public unregister(id: string): void {
    const current = this.itemsSubject.value.filter((i) => i.id !== id);

    this.itemsSubject.next(current);
  }

  /**
   * Updates the `checked` state of an item without rebuilding it.
   * Searches both the top-level list and any one-level submenu so callers
   * can reference children by id without juggling the parent.
   */
  public setChecked(id: string, checked: boolean): void {
    let mutated = false;

    const current = this.itemsSubject.value.map((item) => {
      if (item.id === id) {
        mutated = true;
        return { ...item, checked };
      }

      if (item.children) {
        const newChildren = item.children.map((child) => {
          if (child.id === id) {
            mutated = true;
            return { ...child, checked };
          }
          return child;
        });
        if (newChildren !== item.children) {
          return { ...item, children: newChildren };
        }
      }

      return item;
    });

    if (mutated) {
      this.itemsSubject.next(current);
    }
  }
}
