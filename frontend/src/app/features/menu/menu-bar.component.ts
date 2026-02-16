import {
  Component,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Subscription } from 'rxjs';

import { MenuService } from './menu.service';
import { MenuDropdownComponent } from './menu-dropdown.component';
import type { MenuItem, MenuEvent } from './menu-item';

/**
 * Horizontal menu bar at the top of the application.
 *
 * Features:
 * - Renders top-level menu items horizontally
 * - Click to open dropdown, click again or Escape to close
 * - Keyboard navigation: Arrow keys, Enter, Escape
 * - ARIA: role="menubar", role="menuitem", aria-expanded, aria-haspopup
 * - Catppuccin Mocha color scheme (consistent with WindowComponent)
 * - Click-outside closes any open dropdown
 */
@Component({
  selector: 'app-menu-bar',
  standalone: true,
  imports: [AsyncPipe, MenuDropdownComponent],
  template: `
    <nav class="menu-bar" role="menubar" aria-label="Hauptmenü">
      @for (item of menuService.items$ | async; track item.id) {
        @if (item.visible !== false) {
          <div
            class="menu-bar-item"
            role="menuitem"
            [class.active]="openMenuId === item.id"
            [attr.aria-haspopup]="item.children && item.children.length > 0 ? 'true' : null"
            [attr.aria-expanded]="openMenuId === item.id ? 'true' : 'false'"
            [tabindex]="0"
            (click)="onTopItemClick($event, item)"
            (keydown)="onTopItemKeydown($event, item)"
            (mouseenter)="onTopItemHover(item)"
          >
            {{ item.label }}

            @if (openMenuId === item.id && item.children && item.children.length > 0) {
              <app-menu-dropdown
                [items]="item.children"
                [ariaLabel]="item.label"
                (itemSelected)="onItemSelected($event)"
                (closeRequest)="closeMenu()"
              ></app-menu-dropdown>
            }
          </div>
        }
      }
    </nav>
  `,
  styleUrls: ['./menu-bar.component.scss'],
})
export class MenuBarComponent {
  protected readonly menuService = inject(MenuService);
  private readonly elementRef = inject(ElementRef);

  /** ID of the currently open top-level menu item */
  openMenuId: string | null = null;

  /**
   * Close dropdown when clicking outside the menu bar.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.openMenuId === null) {
      return;
    }

    const clickedInside = this.elementRef.nativeElement.contains(event.target as Node);

    if (!clickedInside) {
      this.closeMenu();
    }
  }

  /**
   * Close dropdown on Escape key.
   */
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeMenu();
  }

  onTopItemClick(event: Event, item: MenuItem): void {
    event.stopPropagation();

    if (item.children !== undefined && item.children.length > 0) {
      // Toggle dropdown
      this.openMenuId = this.openMenuId === item.id ? null : item.id;
    } else if (item.command !== undefined) {
      item.command({ item, originalEvent: event });
      this.closeMenu();
    }
  }

  onTopItemKeydown(event: KeyboardEvent, item: MenuItem): void {
    switch (event.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
        event.preventDefault();
        this.openMenuId = item.id;
        break;

      case 'ArrowRight': {
        event.preventDefault();
        const items = this.menuService.getItems().filter(i => i.visible !== false);
        const currentIndex = items.findIndex(i => i.id === item.id);
        const nextItem = items[(currentIndex + 1) % items.length];

        if (nextItem !== undefined) {
          this.openMenuId = this.openMenuId !== null ? nextItem.id : null;
          this.focusTopItem(nextItem.id);
        }
        break;
      }

      case 'ArrowLeft': {
        event.preventDefault();
        const items = this.menuService.getItems().filter(i => i.visible !== false);
        const currentIndex = items.findIndex(i => i.id === item.id);
        const prevItem = items[(currentIndex - 1 + items.length) % items.length];

        if (prevItem !== undefined) {
          this.openMenuId = this.openMenuId !== null ? prevItem.id : null;
          this.focusTopItem(prevItem.id);
        }
        break;
      }

      case 'Escape':
        event.preventDefault();
        this.closeMenu();
        break;
    }
  }

  onTopItemHover(item: MenuItem): void {
    // If a menu is already open, switch to the hovered item
    if (this.openMenuId !== null) {
      this.openMenuId = item.id;
    }
  }

  onItemSelected(_event: MenuEvent): void {
    this.closeMenu();
  }

  closeMenu(): void {
    this.openMenuId = null;
  }

  private focusTopItem(itemId: string): void {
    const items = this.elementRef.nativeElement.querySelectorAll('.menu-bar-item');

    for (const el of items) {
      if (el.textContent?.trim() === this.menuService.getItems().find(i => i.id === itemId)?.label) {
        (el as HTMLElement).focus();
        break;
      }
    }
  }
}
