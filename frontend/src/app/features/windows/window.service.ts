import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

import {
  WindowAction,
  WindowConfig,
  WindowEvent,
} from './window-config';

/** Starting z-index for windows (leaves room for terminal at z-index 1) */
const BASE_Z_INDEX = 100;

let nextZIndex = BASE_Z_INDEX;

/**
 * Generates a UUID v4 string (browser-safe, no crypto dependency needed).
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Central service for managing modeless (floating) windows.
 *
 * Responsibilities:
 * - Maintains the list of active windows as a reactive BehaviorSubject
 * - Handles z-index management (auto-increment on focus)
 * - Manages parent-child relationships (closing parent closes children)
 * - Provides an event bus for window actions (focus, hide, save, etc.)
 *
 * Usage:
 * ```typescript
 * const windowId = windowService.open({
 *   title: 'Verzeichnisanzeige',
 *   componentType: 'DirlistComponent',
 *   allowSave: false,
 *   showCancel: true,
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class WindowService {
  /** Registry of all window configs, keyed by windowId */
  private readonly registry = new Map<string, WindowConfig>();

  /** Reactive stream of all currently active window configs */
  private readonly windowConfigs$ = new BehaviorSubject<WindowConfig[]>([]);

  /** Incoming events FROM window content components TO the service */
  public readonly incomingEvents$ = new Subject<WindowEvent>();

  /** Outgoing events FROM the service TO window content components */
  public readonly outgoingEvents$ = new Subject<WindowEvent>();

  /** Observable of all active windows (for the container component to render) */
  public readonly windows$ = this.windowConfigs$.asObservable();

  constructor() {
    // Handle incoming events from window components
    this.incomingEvents$.subscribe((event) => {
      this.handleWindowEvent(event);
    });
  }

  /**
   * Opens a new window with the given partial configuration.
   * Generates a windowId, assigns z-index, and adds to registry.
   *
   * @param config - Partial config (windowId and zIndex are auto-assigned)
   * @returns The generated windowId
   */
  public open(config: Partial<WindowConfig> & { title: string; componentType: string }): string {
    const windowId = generateId();

    const fullConfig: WindowConfig = {
      windowId,
      visible: true,
      initialLock: false,
      allowSave: false,
      showCancel: true,
      zIndex: ++nextZIndex,
      position: this.calculateDefaultPosition(),
      ...config,
    };

    this.registry.set(windowId, fullConfig);
    this.emitConfigs();

    console.info(`[WindowService] Opened window: ${fullConfig.title} (${windowId})`);

    return windowId;
  }

  /**
   * Closes a window and removes it from the registry.
   * Also closes all child windows recursively.
   */
  public close(windowId: string): void {
    // Close children first
    this.closeChildren(windowId);

    const config = this.registry.get(windowId);

    if (config !== undefined) {
      // Notify the content component
      this.outgoingEvents$.next({
        action: WindowAction.CloseParent,
        windowId,
      });

      this.registry.delete(windowId);
      this.emitConfigs();

      console.info(`[WindowService] Closed window: ${config.title} (${windowId})`);
    }
  }

  /**
   * Closes all child windows of the given parent.
   */
  public closeChildren(parentWindowId: string): void {
    const children = Array.from(this.registry.values()).filter(
      (c) => c.parentWindowId === parentWindowId,
    );

    for (const child of children) {
      this.close(child.windowId);
    }
  }

  /**
   * Brings a window to the front by giving it the highest z-index.
   */
  public focus(windowId: string): void {
    const config = this.registry.get(windowId);

    if (config === undefined) {
      return;
    }

    const updatedConfig: WindowConfig = {
      ...config,
      zIndex: ++nextZIndex,
    };

    this.registry.set(windowId, updatedConfig);
    this.emitConfigs();
  }

  /**
   * Updates the position of a window (after drag).
   */
  public updatePosition(windowId: string, x: number, y: number): void {
    const config = this.registry.get(windowId);

    if (config === undefined) {
      return;
    }

    this.registry.set(windowId, {
      ...config,
      position: { x, y },
    });

    this.emitConfigs();
  }

  /**
   * Updates the size of a window (after resize).
   */
  public updateSize(windowId: string, width: number, height: number): void {
    const config = this.registry.get(windowId);

    if (config === undefined) {
      return;
    }

    this.registry.set(windowId, {
      ...config,
      size: { width, height },
    });

    this.emitConfigs();
  }

  /**
   * Updates the data payload of a window (e.g. new directory listing).
   */
  public updateData(windowId: string, data: unknown): void {
    const config = this.registry.get(windowId);

    if (config === undefined) {
      return;
    }

    this.registry.set(windowId, {
      ...config,
      data,
    });

    this.emitConfigs();

    // Notify the content component about the data update
    this.outgoingEvents$.next({
      action: WindowAction.DataChanged,
      windowId,
      data,
    });
  }

  /**
   * Returns the config for a specific window.
   */
  public getConfig(windowId: string): WindowConfig | undefined {
    return this.registry.get(windowId);
  }

  /**
   * Closes all windows and resets state.
   */
  public closeAll(): void {
    this.registry.clear();
    nextZIndex = BASE_Z_INDEX;
    this.emitConfigs();

    console.info('[WindowService] All windows closed.');
  }

  /**
   * Handles incoming events from window content components.
   */
  private handleWindowEvent(event: WindowEvent): void {
    switch (event.action) {
      case WindowAction.Focus:
        this.focus(event.windowId);
        break;

      case WindowAction.Hide:
      case WindowAction.Cancel:
        this.close(event.windowId);
        break;

      case WindowAction.SaveAndClose:
        // Forward to content component, then close
        this.outgoingEvents$.next(event);
        this.close(event.windowId);
        break;

      case WindowAction.Save:
      case WindowAction.WinError:
        // Forward to content component
        this.outgoingEvents$.next(event);
        break;

      default:
        console.debug(`[WindowService] Unhandled event: ${event.action}`);
    }
  }

  /**
   * Calculates a staggered default position for new windows.
   */
  private calculateDefaultPosition(): { x: number; y: number } {
    const count = this.registry.size;
    const offset = (count % 10) * 24;

    return { x: 40 + offset, y: 40 + offset };
  }

  /**
   * Emits the current list of visible window configs.
   */
  private emitConfigs(): void {
    const configs = Array.from(this.registry.values()).filter((c) => c.visible);
    this.windowConfigs$.next(configs);
  }
}
