import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
} from '@angular/core';

import { MxpChoiceMenuService } from './mxp-choice-menu.service';

/**
 * Floating menu shown when the user clicks an MXP element with multiple
 * candidate commands (see `MxpChoiceMenuService`). Reads `currentMenu$`
 * from the service and renders a small popup at the requested coordinates.
 *
 * Closes on:
 *   - Picking an option       → calls `service.pick(cmd)`
 *   - Backdrop click          → `service.close()`
 *   - Escape key              → `service.close()`
 *
 * Mounted once in `mud-client.component.html`, so a single instance handles
 * every choice-menu request.
 */
@Component({
  selector: 'app-mxp-choice-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mxp-choice-menu.component.html',
  styleUrls: ['./mxp-choice-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MxpChoiceMenuComponent {
  private readonly service = inject(MxpChoiceMenuService);

  public readonly menu$ = this.service.currentMenu$;

  public onPick(command: string): void {
    this.service.pick(command);
  }

  public onBackdropClick(): void {
    this.service.close();
  }

  /**
   * Esc closes the menu while it is open. Bound on `document` so it works
   * regardless of focus position (the menu items grab focus when shown,
   * but the user might click outside immediately).
   */
  @HostListener('document:keydown.escape')
  public onEscape(): void {
    if (this.service.current !== null) {
      this.service.close();
    }
  }
}
