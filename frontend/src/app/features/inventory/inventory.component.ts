import { CommonModule, KeyValuePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';

import { InventoryService } from './inventory.service';

/**
 * Displays the player's inventory grouped by category.
 * Reactive: subscribes to InventoryService.items$.
 */
@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
  standalone: true,
  imports: [CommonModule, KeyValuePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryComponent {
  private readonly inventory = inject(InventoryService);

  public readonly items$ = this.inventory.items$;

  public hasAnyItems(items: Record<string, string[]>): boolean {
    return Object.keys(items).length > 0;
  }
}
