/**
 * A single inventory entry as received from GMCP `Char.Items.*`.
 */
export interface InventoryEntry {
  /** Display name of the item */
  name: string;
  /** Category grouping (e.g. "Waffen", "Rüstung", "Sonstiges") */
  category: string;
}

/**
 * Manages a categorised inventory list.
 *
 * Categories are created on-the-fly when items are added and removed
 * automatically when their last item is deleted.
 *
 * Thread-safety note: This class is designed for single-threaded use
 * within Angular's change-detection cycle.
 */
export class InventoryList {
  /** Internal storage: category name → ordered list of item names */
  private readonly namedList = new Map<string, string[]>();

  /**
   * Returns all category names in insertion order.
   */
  getCategories(): string[] {
    return [...this.namedList.keys()];
  }

  /**
   * Returns item names for a given category (or empty array if unknown).
   */
  getItems(category: string): string[] {
    return this.namedList.get(category) ?? [];
  }

  /**
   * Returns the total number of items across all categories.
   */
  get totalItems(): number {
    let count = 0;

    for (const items of this.namedList.values()) {
      count += items.length;
    }

    return count;
  }

  /**
   * Returns whether the inventory is empty.
   */
  get isEmpty(): boolean {
    return this.namedList.size === 0;
  }

  /**
   * Adds an item to the inventory.
   *
   * @param entry - The item to add
   * @param addTop - If true, prepend to category (default); if false, append
   */
  addItem(entry: InventoryEntry, addTop = true): void {
    const existing = this.namedList.get(entry.category);

    if (existing !== undefined) {
      if (addTop) {
        existing.unshift(entry.name);
      } else {
        existing.push(entry.name);
      }
    } else {
      this.namedList.set(entry.category, [entry.name]);
    }
  }

  /**
   * Removes a single item from the inventory.
   * If the category becomes empty, it is removed entirely.
   *
   * @param entry - The item to remove
   * @returns true if the item was found and removed
   */
  removeItem(entry: InventoryEntry): boolean {
    const items = this.namedList.get(entry.category);

    if (items === undefined) {
      return false;
    }

    const index = items.indexOf(entry.name);

    if (index < 0) {
      return false;
    }

    items.splice(index, 1);

    if (items.length === 0) {
      this.namedList.delete(entry.category);
    }

    return true;
  }

  /**
   * Replaces the entire inventory with a new list of entries.
   *
   * @param entries - Complete inventory from `Char.Items.List`
   */
  initList(entries: InventoryEntry[]): void {
    this.namedList.clear();

    for (const entry of entries) {
      this.addItem(entry, false);
    }
  }

  /**
   * Clears the entire inventory.
   */
  clear(): void {
    this.namedList.clear();
  }
}
