import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import type {
  WindowConfig,
  WindowConfigInput,
  WindowEvent,
} from './window-config';

const Z_INDEX_BASE = 100;

/**
 * Minimum number of pixels of every window that must remain inside the
 * viewport. Mirrors the value used by the WindowComponent drag clamp so the
 * two clamps agree.
 */
const MIN_VISIBLE_PX = 32;

/**
 * Service for managing modeless windows.
 *
 * Responsibilities:
 * - Create/close windows with unique ids
 * - Z-index management (focus brings window to front)
 * - Parent-child relationships (closing a parent closes its children)
 * - Reactive window list via Observable
 *
 * Window components subscribe to `windows$` to render the current list.
 */
@Injectable({ providedIn: 'root' })
export class WindowService {
  private readonly windowsSubject = new BehaviorSubject<WindowConfig[]>([]);
  private lastZIndex = Z_INDEX_BASE;
  private readonly viewportResizeListener: () => void;

  /** Reactive list of all open windows, ordered by creation */
  public readonly windows$: Observable<WindowConfig[]> =
    this.windowsSubject.asObservable();

  constructor() {
    // Re-clamp every open window when the browser viewport shrinks so a
    // window that used to be reachable does not slip off-screen.
    this.viewportResizeListener = () => this.clampAllToViewport();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.viewportResizeListener);
    }
  }

  /**
   * Returns the current snapshot of all open windows.
   */
  public get windows(): WindowConfig[] {
    return this.windowsSubject.value;
  }

  /**
   * Creates and opens a new window.
   * @returns The window id (also accessible via `config.windowId`)
   */
  public newWindow(input: WindowConfigInput): string {
    const windowId = this.generateWindowId();

    this.lastZIndex += 1;

    const config: WindowConfig = {
      windowId,
      parentWindowId: input.parentWindowId,
      title: input.title,
      tooltip: input.tooltip,
      component: input.component,
      visible: input.visible ?? true,
      zIndex: this.lastZIndex,
      posX: input.posX ?? 0,
      posY: input.posY ?? 0,
      width: input.width ?? 0,
      height: input.height ?? 0,
      saveable: input.saveable ?? false,
      noCancel: input.noCancel ?? false,
      data: input.data,
      outgoing: new Subject<WindowEvent>(),
      incoming: new Subject<WindowEvent>(),
    };

    config.outgoing.subscribe((event) => this.handleOutgoingEvent(config, event));

    this.windowsSubject.next([...this.windowsSubject.value, config]);

    return windowId;
  }

  /**
   * Returns the WindowConfig for the given id, or undefined if not found.
   */
  public getWindow(windowId: string): WindowConfig | undefined {
    return this.windowsSubject.value.find((w) => w.windowId === windowId);
  }

  /**
   * Brings the given window to the front by assigning it the next z-index.
   */
  public focus(windowId: string): void {
    const config = this.getWindow(windowId);

    if (config === undefined) {
      return;
    }

    this.lastZIndex += 1;
    config.zIndex = this.lastZIndex;

    this.windowsSubject.next([...this.windowsSubject.value]);
  }

  /**
   * Closes the window with the given id and any of its child windows.
   * Completes the window's event subjects to free subscribers.
   * @returns Number of windows actually closed (parent + children)
   */
  public close(windowId: string): number {
    const toClose = new Set<string>([windowId]);

    for (const w of this.windowsSubject.value) {
      if (w.parentWindowId === windowId) {
        toClose.add(w.windowId);
      }
    }

    const remaining: WindowConfig[] = [];

    for (const w of this.windowsSubject.value) {
      if (toClose.has(w.windowId)) {
        w.outgoing.complete();
        w.incoming.complete();
      } else {
        remaining.push(w);
      }
    }

    this.windowsSubject.next(remaining);

    if (remaining.length === 0) {
      this.lastZIndex = Z_INDEX_BASE;
    }

    return toClose.size;
  }

  /**
   * Closes all windows and resets the z-index counter.
   */
  public closeAll(): void {
    for (const w of this.windowsSubject.value) {
      w.outgoing.complete();
      w.incoming.complete();
    }

    this.windowsSubject.next([]);
    this.lastZIndex = Z_INDEX_BASE;
  }

  /**
   * Sends an event to the window's hosting component via its `incoming` channel.
   */
  public sendToWindow(windowId: string, event: WindowEvent): void {
    const config = this.getWindow(windowId);

    config?.incoming.next(event);
  }

  /**
   * Updates the visibility of a window without closing it.
   */
  public setVisible(windowId: string, visible: boolean): void {
    const config = this.getWindow(windowId);

    if (config === undefined) {
      return;
    }

    config.visible = visible;
    this.windowsSubject.next([...this.windowsSubject.value]);
  }

  /**
   * Forces every open window back inside the viewport, regardless of where
   * it currently sits. Used as the "panic button" for windows the user has
   * managed to drag off-screen (or that became unreachable after a viewport
   * shrink). Each window keeps its size; only the top-left corner is moved.
   */
  public bringAllIntoView(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let mutated = false;

    for (const w of this.windowsSubject.value) {
      const width = w.width > 0 ? w.width : MIN_VISIBLE_PX;
      // Force the entire window back into the viewport (not just the title
      // bar): width <= vw -> full width fits, otherwise the right edge
      // matters less than seeing the close button.
      const newX = Math.max(0, Math.min(w.posX, Math.max(0, vw - width)));
      const newY = Math.max(0, Math.min(w.posY, Math.max(0, vh - MIN_VISIBLE_PX)));

      if (newX !== w.posX || newY !== w.posY) {
        w.posX = newX;
        w.posY = newY;
        mutated = true;
      }
    }

    if (mutated) {
      this.windowsSubject.next([...this.windowsSubject.value]);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Re-clamps each open window so MIN_VISIBLE_PX of its title bar stays
   * inside the viewport. Called from the global resize listener. Unlike
   * `bringAllIntoView`, this only nudges windows that have actually become
   * unreachable — a window that is fully visible is left untouched.
   */
  private clampAllToViewport(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let mutated = false;

    for (const w of this.windowsSubject.value) {
      const width = w.width > 0 ? w.width : MIN_VISIBLE_PX;
      const minX = MIN_VISIBLE_PX - width;
      const maxX = Math.max(minX, vw - MIN_VISIBLE_PX);
      const minY = 0;
      const maxY = Math.max(minY, vh - MIN_VISIBLE_PX);

      const newX = Math.max(minX, Math.min(w.posX, maxX));
      const newY = Math.max(minY, Math.min(w.posY, maxY));

      if (newX !== w.posX || newY !== w.posY) {
        w.posX = newX;
        w.posY = newY;
        mutated = true;
      }
    }

    if (mutated) {
      this.windowsSubject.next([...this.windowsSubject.value]);
    }
  }

  /**
   * Routes events sent by the window component (e.g. focus, hide, close requests).
   * Event format: "action" or "action:param1:param2"
   */
  private handleOutgoingEvent(config: WindowConfig, event: WindowEvent): void {
    const [action] = event.split(':');

    switch (action) {
      case 'do_focus':
        this.focus(config.windowId);
        break;
      case 'do_hide':
        this.setVisible(config.windowId, false);
        break;
      case 'do_close':
        this.close(config.windowId);
        break;
      default:
        // Other events are passed through for application-level handling
        // (the caller can subscribe directly to config.outgoing)
        break;
    }
  }

  private generateWindowId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `win-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }
}
