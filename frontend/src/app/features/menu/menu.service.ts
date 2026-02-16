import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import type { MenuItem } from './menu-item';
import type { GmcpModuleHandler } from '../gmcp/gmcp-module-handler';
import { GmcpService } from '../gmcp/gmcp.service';

/**
 * Central menu service managing the application's hierarchical menu structure.
 *
 * Responsibilities:
 * - Maintains a reactive list of top-level menu items
 * - Supports dynamic registration/removal of menu items (by GMCP modules, etc.)
 * - Collects menu contributions from registered GMCP module handlers
 * - Provides observable stream for the MenuBarComponent to render
 *
 * Menu structure: 3 levels max (menubar → dropdown → submenu).
 */
@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly gmcpService = inject(GmcpService);

  /** Internal state of all top-level menu items */
  private readonly menuItems = new BehaviorSubject<MenuItem[]>([]);

  /** Observable stream of the current menu structure */
  public readonly items$: Observable<MenuItem[]> = this.menuItems.asObservable();

  /**
   * Replaces the entire menu structure.
   */
  public setItems(items: MenuItem[]): void {
    this.menuItems.next(items);
  }

  /**
   * Returns the current snapshot of menu items.
   */
  public getItems(): MenuItem[] {
    return this.menuItems.value;
  }

  /**
   * Registers or replaces a top-level menu item by id.
   * If an item with the same id exists, it is replaced.
   * If parentId is provided, the item is added as a child of that parent.
   */
  public registerItem(parentId: string | null, item: MenuItem): void {
    const items = [...this.menuItems.value];

    if (parentId === null) {
      const existingIndex = items.findIndex(i => i.id === item.id);

      if (existingIndex >= 0) {
        items[existingIndex] = item;
      } else {
        items.push(item);
      }

      this.menuItems.next(items);
    } else {
      const updated = this.addToParent(items, parentId, item);
      this.menuItems.next(updated);
    }
  }

  /**
   * Removes a menu item by id (searches recursively).
   */
  public removeItem(itemId: string): void {
    const items = this.removeFromTree(this.menuItems.value, itemId);
    this.menuItems.next(items);
  }

  /**
   * Rebuilds the dynamic parts of the menu by collecting contributions
   * from all registered GMCP module handlers.
   *
   * Call this after GMCP state changes (e.g. module enabled/disabled).
   */
  public refreshGmcpMenuItems(): void {
    const items = [...this.menuItems.value];
    let gmcpMenu = items.find(i => i.id === 'gmcp');

    if (gmcpMenu === undefined) {
      gmcpMenu = { id: 'gmcp', label: 'GMCP', children: [] };
      items.push(gmcpMenu);
    }

    // Collect menu items from all registered GMCP handlers
    const gmcpChildren: MenuItem[] = [];
    const modules = this.gmcpService.getRegisteredModules();

    for (const [, handler] of modules) {
      const handlerItems = handler.getMenuItems?.();

      if (handlerItems !== undefined && handlerItems.length > 0) {
        for (const gmcpItem of handlerItems) {
          gmcpChildren.push({
            id: `gmcp-${handler.moduleName}-${gmcpItem.label}`,
            label: gmcpItem.label,
            icon: gmcpItem.icon,
            checked: gmcpItem.checked,
            command: () => gmcpItem.action(),
          });
        }
      }
    }

    gmcpMenu.children = gmcpChildren;

    // Update the reference in the items array
    const gmcpIndex = items.findIndex(i => i.id === 'gmcp');

    if (gmcpIndex >= 0) {
      items[gmcpIndex] = { ...gmcpMenu };
    }

    this.menuItems.next(items);
  }

  /**
   * Recursively adds an item as a child of the specified parent.
   */
  private addToParent(items: MenuItem[], parentId: string, newItem: MenuItem): MenuItem[] {
    return items.map(item => {
      if (item.id === parentId) {
        const children = [...(item.children ?? [])];
        const existingIndex = children.findIndex(c => c.id === newItem.id);

        if (existingIndex >= 0) {
          children[existingIndex] = newItem;
        } else {
          children.push(newItem);
        }

        return { ...item, children };
      }

      if (item.children !== undefined) {
        return { ...item, children: this.addToParent(item.children, parentId, newItem) };
      }

      return item;
    });
  }

  /**
   * Recursively removes an item by id from the tree.
   */
  private removeFromTree(items: MenuItem[], itemId: string): MenuItem[] {
    return items
      .filter(item => item.id !== itemId)
      .map(item => {
        if (item.children !== undefined) {
          return { ...item, children: this.removeFromTree(item.children, itemId) };
        }

        return item;
      });
  }
}
