import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  inject,
  Input,
  NgZone,
  OnDestroy,
  ViewChild,
} from '@angular/core';

import type { WindowConfig } from './window-config';

/**
 * Minimum number of pixels of the title bar that must remain inside the
 * viewport at all times. Below this the user could drag the window into a
 * position where it can no longer be reached with the mouse.
 */
const MIN_VISIBLE_PX = 32;

/**
 * A modeless window shell.
 * Provides title bar (drag handle), close button, and content area.
 * Resize is done via native CSS `resize: both`.
 *
 * Communicates with the WindowService via `config.outgoing` events:
 *   - `do_focus`        — clicked anywhere
 *   - `do_close`        — close button
 *   - `move:x:y`        — after drag
 *
 * Size changes (CSS resize handle) are detected via `ResizeObserver` and
 * mirrored into `config.width` / `config.height` so callers can read the
 * latest user-chosen geometry at any time (e.g. when persisting on close).
 */
@Component({
  selector: 'app-window',
  templateUrl: './window.component.html',
  styleUrls: ['./window.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WindowComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) config!: WindowConfig;

  @ViewChild('titleBar', { static: true }) titleBar!: ElementRef<HTMLElement>;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private dragging = false;

  private resizeObserver: ResizeObserver | undefined;

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

    const rawX = event.clientX - this.dragOffsetX;
    const rawY = event.clientY - this.dragOffsetY;

    // Clamp so the title bar always keeps MIN_VISIBLE_PX of overlap with
    // the viewport on every side. Without this the user can drag a window
    // off-screen and lose access to the close button entirely.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = this.config.width > 0 ? this.config.width : MIN_VISIBLE_PX;

    // Y: never above the viewport top (-> title bar must stay >= 0) and
    // never further down than (vh - MIN_VISIBLE_PX) so a thin slice of the
    // title bar is always reachable.
    const minY = 0;
    const maxY = Math.max(minY, vh - MIN_VISIBLE_PX);
    // X: at least MIN_VISIBLE_PX of the window must overlap the viewport on
    // the right of the left edge and on the left of the right edge.
    const minX = MIN_VISIBLE_PX - w;
    const maxX = Math.max(minX, vw - MIN_VISIBLE_PX);

    this.config.posX = Math.max(minX, Math.min(rawX, maxX));
    this.config.posY = Math.max(minY, Math.min(rawY, maxY));
  }

  onTitleBarPointerUp(event: PointerEvent): void {
    if (!this.dragging) {
      return;
    }

    this.dragging = false;
    this.titleBar.nativeElement.releasePointerCapture(event.pointerId);
    this.config.outgoing.next(`move:${this.config.posX}:${this.config.posY}`);
  }

  ngAfterViewInit(): void {
    // Skip resize tracking for auto-sized windows (width/height = 0): we
    // would otherwise pin them to whatever the layout produces on the first
    // tick and lose the auto-sizing semantics.
    if (this.config.width <= 0 || this.config.height <= 0) {
      return;
    }

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    // Run outside Angular: this fires on every frame during a CSS resize and
    // does not need change detection — the values land in `config` directly,
    // and HostBinding picks them up on the next CD tick driven by other
    // events (focus, drag, close, …).
    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (!rect) {
          return;
        }

        const w = Math.round(rect.width);
        const h = Math.round(rect.height);

        if (w !== this.config.width || h !== this.config.height) {
          this.config.width = w;
          this.config.height = h;
        }
      });

      this.resizeObserver.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }
}
