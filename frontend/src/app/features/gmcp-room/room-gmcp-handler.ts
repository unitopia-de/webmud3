import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';

import type { GmcpModuleHandler } from '../gmcp/gmcp-module-handler';

/**
 * Room information received from the MUD via GMCP.
 */
export interface RoomInfo {
  /** Room name */
  name?: string;
  /** Domain or area name */
  domain?: string;
  /** Available exits from this room */
  exits?: string[];
}

/**
 * GMCP handler for the `Room` module.
 *
 * Handles:
 * - `Room.Info` → Room name, domain, and exits
 *
 * Minimal implementation:
 * - Updates the browser tab title with the room name
 * - Exposes room info as a reactive observable for future UI use
 *   (e.g. exit buttons, mini-map)
 */
@Injectable({ providedIn: 'root' })
export class RoomGmcpHandler implements GmcpModuleHandler {
  readonly moduleName = 'Room';
  readonly version = '1';

  private readonly titleService = inject(Title);

  /** Reactive stream of current room information */
  public readonly roomInfo$ = new BehaviorSubject<RoomInfo | null>(null);

  /**
   * Routes incoming GMCP `Room.*` messages.
   */
  handleMessage(message: string, data: unknown): void {
    switch (message) {
      case 'Info':
        this.handleRoomInfo(data as RoomInfo);
        break;

      default:
        console.debug(`[RoomGmcpHandler] Unknown message: Room.${message}`, data);
    }
  }

  /**
   * Cleanup.
   */
  dispose(): void {
    this.roomInfo$.next(null);
    this.titleService.setTitle('WebMud3');

    console.info('[RoomGmcpHandler] Disposed.');
  }

  /**
   * Handles `Room.Info`: stores room data and updates browser title.
   */
  private handleRoomInfo(data: RoomInfo): void {
    this.roomInfo$.next(data);

    // Update browser tab title with room name
    if (data.name !== undefined && data.name !== '') {
      this.titleService.setTitle(`${data.name} - WebMud3`);
    }

    console.debug(
      `[RoomGmcpHandler] Room.Info: ${data.name ?? '(unnamed)'}`,
      data.exits ?? [],
    );
  }
}
