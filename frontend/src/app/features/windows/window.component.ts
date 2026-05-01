import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  ViewChild,
} from '@angular/core';

import type { WindowConfig } from './window-config';

/**
 * A modeless window shell.
 * Provides title bar (drag handle), close button, and content area.
 * Resize is done via native CSS `resize: both`.
 *
 * Communicates with the WindowService via `config.outgoing` events:
 *   - `do_focus`        — clicked anywhere
 *   - `do_close`        — close button
 *   - `move:x:y`        — after drag
 */
@Component({
  selector: 'app-window',
  templateUrl: './window.component.html',
  styleUrls: ['./window.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WindowComponent {
  @Input({ required: true }) config!: WindowConfig;

  @ViewChild('titleBar', { static: true }) titleBar!: ElementRef<HTMLElement>;

  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private dragging = false;

  @HostBinding('style.left.px') get left(): number {
    return this.config.posX;
  }

  @HostBinding('style.top.px') get top(): number {
    return this.config.posY;
  }

  @HostBinding('style.width.px') get width(): number | null {
    return this.config.width > 0 ? this.config.width : null;
  }

  @HostBinding('style.height.px') get height(): number | null {
    return this.config.height > 0 ? this.config.height : null;
  }

  @HostBinding('style.z-index') get zIndex(): number {
    return this.config.zIndex;
  }

  @HostBinding('style.display') get display(): string {
    return this.config.visible ? 'flex' : 'none';
  }

  @HostListener('pointerdown')
  onHostClick(): void {
    this.config.outgoing.next('do_focus');
  }

  onClose(event: Event): void {
    event.stopPropagation();
    this.config.outgoing.next('do_close');
  }

  onTitleBarPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    // Don't start a drag when clicking interactive elements like the close button.
    const target = event.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }

    this.dragging = true;
    this.dragOffsetX = event.clientX - this.config.posX;
    this.dragOffsetY = event.clientY - this.config.posY;
    this.titleBar.nativeElement.setPointerCapture(event.pointerId);
  }

  onTitleBarPointerMove(event: PointerEvent): void {
    if (!this.dragging) {
      return;
    }

    this.config.posX = event.clientX - this.dragOffsetX;
    this.config.posY = event.clientY - this.dragOffsetY;
  }

  onTitleBarPointerUp(event: PointerEvent): void {
    if (!this.dragging) {
      return;
    }

    this.dragging = false;
    this.titleBar.nativeElement.releasePointerCapture(event.pointerId);
    this.config.outgoing.next(`move:${this.config.posX}:${this.config.posY}`);
  }
}
