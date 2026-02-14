import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import { WindowAction, WindowConfig, WindowEvent } from './window-config';

/** Minimum window dimensions in pixels */
const MIN_WIDTH = 200;
const MIN_HEIGHT = 120;

/**
 * A single floating modeless window with title bar, close button, drag and resize.
 *
 * Features:
 * - Draggable via pointer events on the title bar
 * - Resizable via a corner handle (bottom-right)
 * - ARIA: `role="dialog"`, `aria-label`, keyboard-accessible close
 * - Emits WindowEvents for focus, close, save, cancel
 * - Content is projected via `<ng-content>`
 */
@Component({
  selector: 'app-window',
  standalone: true,
  template: `
    <div
      class="wm-window"
      role="dialog"
      [attr.aria-label]="config.title"
      [style.left.px]="config.position.x"
      [style.top.px]="config.position.y"
      [style.z-index]="config.zIndex"
      [style.width.px]="config.size?.width"
      [style.height.px]="config.size?.height"
      (pointerdown)="onWindowPointerDown()"
    >
      <!-- Title bar -->
      <div
        class="wm-titlebar"
        #titleBar
        (pointerdown)="onDragStart($event)"
      >
        <span class="wm-title" [title]="config.tooltip ?? config.title">
          {{ config.title }}
        </span>
        <div class="wm-titlebar-buttons">
          @if (config.allowSave) {
            <button
              class="wm-btn wm-btn-save"
              (click)="emitAction(WindowAction.Save)"
              title="Speichern"
              aria-label="Speichern"
            >💾</button>
          }
          @if (config.showCancel) {
            <button
              class="wm-btn wm-btn-close"
              (click)="emitAction(WindowAction.Hide)"
              title="Schließen"
              aria-label="Fenster schließen"
            >✕</button>
          }
        </div>
      </div>

      <!-- Content area -->
      <div class="wm-content">
        <ng-content></ng-content>
      </div>

      <!-- Resize handle (bottom-right corner) -->
      <div
        class="wm-resize-handle"
        (pointerdown)="onResizeStart($event)"
        aria-hidden="true"
      ></div>
    </div>
  `,
  styleUrls: ['./window.component.scss'],
})
export class WindowComponent implements OnDestroy {
  @Input({ required: true }) config!: WindowConfig;
  @Output() windowEvent = new EventEmitter<WindowEvent>();

  protected readonly WindowAction = WindowAction;

  // Drag state
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  // Resize state
  private isResizing = false;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartWidth = 0;
  private resizeStartHeight = 0;

  // Bound event handlers for cleanup
  private readonly boundDragMove = this.onDragMove.bind(this);
  private readonly boundDragEnd = this.onDragEnd.bind(this);
  private readonly boundResizeMove = this.onResizeMove.bind(this);
  private readonly boundResizeEnd = this.onResizeEnd.bind(this);

  ngOnDestroy(): void {
    // Ensure event listeners are cleaned up
    this.cleanupDragListeners();
    this.cleanupResizeListeners();
  }

  /** Emit focus event when clicking anywhere in the window */
  onWindowPointerDown(): void {
    this.emitAction(WindowAction.Focus);
  }

  /** Start dragging from the title bar */
  onDragStart(event: PointerEvent): void {
    if (this.config.initialLock) {
      return;
    }

    // Only drag on primary button
    if (event.button !== 0) {
      return;
    }

    // Don't drag if clicking a button
    if ((event.target as HTMLElement).closest('.wm-btn')) {
      return;
    }

    event.preventDefault();

    this.isDragging = true;
    this.dragOffsetX = event.clientX - this.config.position.x;
    this.dragOffsetY = event.clientY - this.config.position.y;

    document.addEventListener('pointermove', this.boundDragMove);
    document.addEventListener('pointerup', this.boundDragEnd);
  }

  /** Start resizing from the resize handle */
  onResizeStart(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.isResizing = true;
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.resizeStartWidth = this.config.size?.width ?? MIN_WIDTH;
    this.resizeStartHeight = this.config.size?.height ?? MIN_HEIGHT;

    document.addEventListener('pointermove', this.boundResizeMove);
    document.addEventListener('pointerup', this.boundResizeEnd);
  }

  /** Emit a window action event */
  emitAction(action: WindowAction, data?: unknown): void {
    this.windowEvent.emit({
      action,
      windowId: this.config.windowId,
      data,
    });
  }

  private onDragMove(event: PointerEvent): void {
    if (!this.isDragging) {
      return;
    }

    const newX = Math.max(0, event.clientX - this.dragOffsetX);
    const newY = Math.max(0, event.clientY - this.dragOffsetY);

    this.windowEvent.emit({
      action: WindowAction.Focus,
      windowId: this.config.windowId,
      data: { x: newX, y: newY, type: 'drag' },
    });
  }

  private onDragEnd(): void {
    this.isDragging = false;
    this.cleanupDragListeners();
  }

  private onResizeMove(event: PointerEvent): void {
    if (!this.isResizing) {
      return;
    }

    const deltaX = event.clientX - this.resizeStartX;
    const deltaY = event.clientY - this.resizeStartY;

    const newWidth = Math.max(MIN_WIDTH, this.resizeStartWidth + deltaX);
    const newHeight = Math.max(MIN_HEIGHT, this.resizeStartHeight + deltaY);

    this.windowEvent.emit({
      action: WindowAction.Resize,
      windowId: this.config.windowId,
      data: { width: newWidth, height: newHeight },
    });
  }

  private onResizeEnd(): void {
    this.isResizing = false;
    this.cleanupResizeListeners();
  }

  private cleanupDragListeners(): void {
    document.removeEventListener('pointermove', this.boundDragMove);
    document.removeEventListener('pointerup', this.boundDragEnd);
  }

  private cleanupResizeListeners(): void {
    document.removeEventListener('pointermove', this.boundResizeMove);
    document.removeEventListener('pointerup', this.boundResizeEnd);
  }
}
