import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Type,
} from '@angular/core';

import { WindowComponent } from './window.component';
import { WindowService } from './window.service';
import { WINDOW_COMPONENTS } from './window-component-registry';
import type { WindowConfig } from './window-config';

/**
 * Renders all currently open windows from `WindowService.windows$`.
 *
 * For each window the matching component is looked up in WINDOW_COMPONENTS
 * (keyed by `cfg.component`) and rendered via ngComponentOutlet. Unknown
 * component ids fall back to a JSON-dump placeholder for debugging.
 *
 * Mount this component once at the application root.
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

  public componentFor(cfg: WindowConfig): Type<unknown> | null {
    return WINDOW_COMPONENTS[cfg.component] ?? null;
  }

  public toJson(value: unknown): string {
    if (value === undefined) {
      return '(no data)';
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      // Scheitert z. B. an zyklischen Referenzen. `String(value)` lieferte
      // dann das nutzlose "[object Object]" — für eine Diagnoseanzeige ist
      // ein klarer Hinweis brauchbarer. Primitive gibt es weiterhin wörtlich.
      if (typeof value === 'string') {
        return value;
      }
      if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'bigint'
      ) {
        return String(value);
      }
      return '(nicht darstellbar)';
    }
  }
}
