import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';

import { WindowComponent } from './window.component';
import type { WindowConfig } from './window-config';
import { WindowService } from './window.service';

/**
 * Renders all currently open windows from `WindowService.windows$`.
 *
 * Mount this component once at the application root.
 * Concrete content rendering inside windows will be added when
 * specific window types (editor, inventory, char-stat) are migrated.
 */
@Component({
  selector: 'app-window-container',
  templateUrl: './window-container.component.html',
  styleUrls: ['./window-container.component.scss'],
  standalone: true,
  imports: [CommonModule, WindowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WindowContainerComponent {
  private readonly windowService = inject(WindowService);

  public readonly windows$ = this.windowService.windows$;

  public trackByWindowId(_index: number, cfg: WindowConfig): string {
    return cfg.windowId;
  }

  public toJson(value: unknown): string {
    if (value === undefined) {
      return '(no data)';
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
}
