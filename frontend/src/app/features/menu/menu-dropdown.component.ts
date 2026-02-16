import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';

import type { MenuItem, MenuEvent } from './menu-item';

/**
 * A dropdown panel for displaying submenu items.
 *
 * Features:
 * - Renders a vertical list of MenuItem entries
 * - Supports nested submenus (hover to open)
 * - Keyboard navigation: ArrowUp/Down, Enter, Escape
 * - ARIA: role="menu", role="menuitem"
 * - Click-outside closes the dropdown
 */
@Component({
  selector: 'app-menu-dropdown',
  standalone: true,
  template: `
    <ul class="menu-dropdown" role="menu" [attr.aria-label]="ariaLabel">
      @for (item of items; track item.id) {
        @if (item.separator) {
          <li class="menu-separator" role="separator"></li>
        } @else if (item.visible !== false) {
          <li
            class="menu-item"
            role="menuitem"
            [class.disabled]="item.disabled"
            [class.has-children]="item.children && item.children.length > 0"
            [class.checked]="item.checked"
            [attr.aria-disabled]="item.disabled || null"
            [attr.aria-haspopup]="item.children && item.children.length > 0 ? 'true' : null"
            [attr.aria-expanded]="activeSubmenuId === item.id ? 'true' : null"
            [tabindex]="item.disabled ? -1 : 0"
            (click)="onItemClick($event, item)"
            (keydown)="onItemKeydown($event, item)"
            (mouseenter)="onItemHover(item)"
            (mouseleave)="onItemLeave()"
          >
            <span class="menu-item-label">
              @if (item.checked !== undefined) {
                <span class="menu-check" aria-hidden="true">{{ item.checked ? '✓' : '' }}</span>
              }
              {{ item.label }}
            </span>
            @if (item.children && item.children.length > 0) {
              <span class="menu-arrow" aria-hidden="true">▸</span>
            }

            @if (activeSubmenuId === item.id && item.children) {
              <app-menu-dropdown
                class="submenu"
                [items]="item.children"
                [ariaLabel]="item.label"
                (itemSelected)="itemSelected.emit($event)"
                (closeRequest)="activeSubmenuId = null"
              ></app-menu-dropdown>
            }
          </li>
        }
      }
    </ul>
  `,
  styleUrls: ['./menu-dropdown.component.scss'],
})
export class MenuDropdownComponent {
  @Input() items: MenuItem[] = [];
  @Input() ariaLabel = 'Untermenü';
  @Output() itemSelected = new EventEmitter<MenuEvent>();
  @Output() closeRequest = new EventEmitter<void>();

  /** ID of the currently open submenu (hover-triggered) */
  activeSubmenuId: string | null = null;

  private submenuTimeout: ReturnType<typeof setTimeout> | null = null;

  onItemClick(event: Event, item: MenuItem): void {
    if (item.disabled) {
      return;
    }

    // If item has children, toggle submenu
    if (item.children !== undefined && item.children.length > 0) {
      this.activeSubmenuId = this.activeSubmenuId === item.id ? null : item.id;
      return;
    }

    // Execute command
    if (item.command !== undefined) {
      item.command({ item, originalEvent: event });
    }

    this.itemSelected.emit({ item, originalEvent: event });
  }

  onItemKeydown(event: KeyboardEvent, item: MenuItem): void {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.onItemClick(event, item);
        break;

      case 'Escape':
        event.preventDefault();
        this.closeRequest.emit();
        break;

      case 'ArrowDown': {
        event.preventDefault();
        const next = (event.target as HTMLElement).nextElementSibling as HTMLElement | null;
        next?.focus();
        break;
      }

      case 'ArrowUp': {
        event.preventDefault();
        const prev = (event.target as HTMLElement).previousElementSibling as HTMLElement | null;
        prev?.focus();
        break;
      }

      case 'ArrowRight':
        if (item.children !== undefined && item.children.length > 0) {
          event.preventDefault();
          this.activeSubmenuId = item.id;
        }
        break;

      case 'ArrowLeft':
        event.preventDefault();
        this.closeRequest.emit();
        break;
    }
  }

  onItemHover(item: MenuItem): void {
    if (this.submenuTimeout !== null) {
      clearTimeout(this.submenuTimeout);
    }

    if (item.children !== undefined && item.children.length > 0) {
      this.submenuTimeout = setTimeout(() => {
        this.activeSubmenuId = item.id;
      }, 150);
    } else {
      this.activeSubmenuId = null;
    }
  }

  onItemLeave(): void {
    if (this.submenuTimeout !== null) {
      clearTimeout(this.submenuTimeout);
      this.submenuTimeout = null;
    }
  }
}
