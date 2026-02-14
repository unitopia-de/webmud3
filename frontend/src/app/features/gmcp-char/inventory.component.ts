import { AsyncPipe } from '@angular/common';
import { Component, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { WindowConfig } from '../windows';

import { CharGmcpHandler } from './char-gmcp-handler';
import { InventoryList } from './inventory-data';

/**
 * Displays a categorised inventory list inside a modeless window.
 *
 * Items are grouped by category (e.g. "Waffen", "Rüstung") with
 * a collapsible tree-style layout.
 *
 * The component subscribes to `CharGmcpHandler.inventory$` for
 * reactive updates when items are added/removed.
 */
@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <div class="inventory" role="list" aria-label="Inventar">
      @if (inventory.isEmpty) {
        <div class="inventory-empty">Inventar ist leer.</div>
      } @else {
        @for (category of inventory.getCategories(); track category) {
          <div class="inventory-category" role="listitem">
            <div class="inventory-category-name">{{ category }}</div>
            <ul class="inventory-items">
              @for (item of inventory.getItems(category); track $index) {
                <li class="inventory-item">{{ item }}</li>
              }
            </ul>
          </div>
        }
        <div class="inventory-footer">
          {{ inventory.totalItems }} Gegenstände
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        overflow: auto;
      }

      .inventory {
        padding: 4px 8px;
        font-family: monospace;
        font-size: 13px;
        color: #cdd6f4;
      }

      .inventory-empty {
        padding: 12px 0;
        color: #6c7086;
        font-style: italic;
        text-align: center;
      }

      .inventory-category {
        margin-bottom: 6px;
      }

      .inventory-category-name {
        font-weight: 600;
        color: #89b4fa;
        padding: 2px 0;
      }

      .inventory-items {
        list-style: none;
        padding-left: 16px;
        margin: 0;
      }

      .inventory-item {
        color: #cdd6f4;
        padding: 1px 0;
        line-height: 1.4;
      }

      .inventory-item:hover {
        color: #f5e0dc;
      }

      .inventory-footer {
        margin-top: 8px;
        padding-top: 4px;
        border-top: 1px solid #313244;
        color: #6c7086;
        font-size: 11px;
        text-align: right;
      }
    `,
  ],
})
export class InventoryComponent implements OnInit, OnDestroy {
  @Input() config!: WindowConfig;

  protected inventory = new InventoryList();

  private readonly charHandler = inject(CharGmcpHandler);
  private subscription?: Subscription;

  ngOnInit(): void {
    this.subscription = this.charHandler.inventory$.subscribe((inv) => {
      this.inventory = inv;
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
