import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * A single entry in the footer menu.
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
  /** Callback invoked when the item is clicked */
  action: () => void;
};

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
   * Adds or replaces a menu item.
   */
  public register(item: FooterMenuItem): void {
    const current = this.itemsSubject.value.filter((i) => i.id !== item.id);

    this.itemsSubject.next([...current, item]);
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
   */
  public setChecked(id: string, checked: boolean): void {
    const current = this.itemsSubject.value.map((i) =>
      i.id === id ? { ...i, checked } : i,
    );

    this.itemsSubject.next(current);
  }
}
