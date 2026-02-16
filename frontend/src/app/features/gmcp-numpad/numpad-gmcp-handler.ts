import { inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { GmcpService } from '../gmcp/gmcp.service';
import type { GmcpMenuItem, GmcpModuleHandler } from '../gmcp/gmcp-module-handler';
import { WindowService } from '../windows/window.service';
import { WindowAction } from '../windows/window-config';

import { KeypadData, OneKeypadData } from './keypad-data';

/**
 * Payload shape for GMCP `Numpad.SendLevel`.
 */
interface NumpadLevelPayload {
  prefix: string;
  keys: Record<string, string>;
}

/**
 * GMCP handler for the `Numpad` module.
 *
 * Handles:
 * - `Numpad.SendLevel` → MUD sends key mappings for one modifier level
 *
 * Provides:
 * - `keypadData$` reactive stream of current keypad configuration
 * - `sendUpdate()` to push changed mappings back to the MUD
 * - `requestAll()` to request all levels from the MUD
 * - `lookupCommand()` for fast key lookup during keyboard interception
 *
 * The visual KeypadComponent subscribes to `keypadData$` and renders
 * a clickable 3x3 directional grid.
 */
@Injectable({ providedIn: 'root' })
export class NumpadGmcpHandler implements GmcpModuleHandler {
  readonly moduleName = 'Numpad';
  readonly version = '1';

  private readonly gmcpService = inject(GmcpService);
  private readonly windowService = inject(WindowService);

  /** Reactive stream of the full keypad configuration */
  public readonly keypadData$ = new BehaviorSubject<KeypadData>(new KeypadData());

  /** Whether the numpad module is currently active */
  private active = false;

  /** Window ID of the keypad widget (if open) */
  private keypadWindowId: string | null = null;

  /**
   * Routes incoming GMCP `Numpad.*` messages.
   */
  handleMessage(message: string, data: unknown): void {
    switch (message) {
      case 'SendLevel':
        this.handleSendLevel(data as NumpadLevelPayload);
        break;

      default:
        console.debug(`[NumpadGmcpHandler] Unknown message: Numpad.${message}`, data);
    }
  }

  /**
   * Returns menu items for the GMCP menu.
   */
  getMenuItems(): GmcpMenuItem[] {
    return [
      {
        label: 'Numpad anzeigen',
        action: () => this.openKeypadWindow(),
      },
    ];
  }

  /**
   * Looks up a MUD command for the given compound key.
   * Returns the command string or empty string if not mapped.
   */
  public lookupCommand(compoundKey: string): string {
    return this.keypadData$.value.getCompoundKey(compoundKey);
  }

  /**
   * Sends a key mapping update to the MUD.
   */
  public sendUpdate(prefix: string, key: string, value: string): void {
    this.gmcpService.sendOutgoing('Numpad', 'Update', { prefix, key, value });
    console.debug(`[NumpadGmcpHandler] Update sent: ${prefix}|${key} = ${value}`);
  }

  /**
   * Requests all numpad levels from the MUD.
   */
  public requestAll(): void {
    this.gmcpService.sendOutgoing('Numpad', 'GetAll', {});
    console.debug('[NumpadGmcpHandler] Requested all levels.');
  }

  /** Whether the numpad has any key mappings loaded */
  public get hasData(): boolean {
    return !this.keypadData$.value.isEmpty;
  }

  /**
   * Cleanup.
   */
  dispose(): void {
    this.keypadData$.next(new KeypadData());
    this.active = false;

    if (this.keypadWindowId !== null) {
      this.windowService.close(this.keypadWindowId);
      this.keypadWindowId = null;
    }

    console.info('[NumpadGmcpHandler] Disposed.');
  }

  /**
   * Handles `Numpad.SendLevel`: MUD sends key mappings for one modifier level.
   */
  private handleSendLevel(payload: NumpadLevelPayload): void {
    const keypadData = this.keypadData$.value;
    const level: OneKeypadData = {
      prefix: payload.prefix,
      keys: new Map(Object.entries(payload.keys)),
    };

    keypadData.setLevel(level);
    this.active = true;

    // Emit new reference to trigger change detection
    this.keypadData$.next(keypadData);

    console.info(
      `[NumpadGmcpHandler] Level received: "${payload.prefix}" with ${level.keys.size} keys`,
    );
  }

  /**
   * Opens the visual keypad widget as a modeless window.
   */
  private openKeypadWindow(): void {
    if (this.keypadWindowId !== null) {
      this.windowService.focus(this.keypadWindowId);
      return;
    }

    this.keypadWindowId = this.windowService.open({
      title: 'Numpad',
      componentType: 'KeypadComponent',
      size: { width: 260, height: 280 },
      position: { x: window.innerWidth - 300, y: 60 },
    });

    const sub = this.windowService.outgoingEvents$.subscribe(event => {
      if (event.windowId === this.keypadWindowId && event.action === WindowAction.CloseParent) {
        this.keypadWindowId = null;
        sub.unsubscribe();
      }
    });
  }
}
