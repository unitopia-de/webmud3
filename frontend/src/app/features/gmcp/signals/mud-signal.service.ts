import { inject, Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, Subscription, filter } from 'rxjs';

import { GmcpService, GmcpMessage } from '../gmcp.service';
import type {
  MudSignal,
  MudSignalType,
  InventoryEntry,
  FileEntry,
} from './mud-signals';

/**
 * Converts incoming GMCP messages into typed MudSignal events.
 *
 * Components subscribe to specific signal types instead of dealing
 * with raw GMCP message parsing. This decouples UI components from
 * the GMCP protocol details.
 *
 * Usage:
 * ```typescript
 * signalService.on('Char.Name').subscribe(signal => {
 *   console.log(signal.name, signal.wizard);
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class MudSignalService implements OnDestroy {
  private readonly gmcp = inject(GmcpService);

  private readonly signals = new Subject<MudSignal>();
  private readonly subscription: Subscription;

  /** Stream of all signals */
  public readonly signals$ = this.signals.asObservable();

  constructor() {
    this.subscription = this.gmcp.messages$.subscribe((msg) => {
      const signal = this.mapToSignal(msg);

      if (signal !== null) {
        console.info(`[MudSignal] ${signal.type}`, signal);
        this.signals.next(signal);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /**
   * Returns an Observable emitting only signals of the given type.
   *
   * TypeScript narrows the signal type automatically:
   * ```typescript
   * service.on('Char.Name').subscribe(s => s.name); // string
   * service.on('Sound.Play').subscribe(s => s.url);  // string
   * ```
   */
  public on<T extends MudSignalType>(
    type: T,
  ): Observable<Extract<MudSignal, { type: T }>> {
    return this.signals$.pipe(
      filter((s): s is Extract<MudSignal, { type: T }> => s.type === type),
    );
  }

  /**
   * Maps a raw GMCP message to a typed MudSignal, or null if unknown.
   */
  private mapToSignal(msg: GmcpMessage): MudSignal | null {
    switch (msg.fullMessage) {
      // -- Character --
      case 'Char.Name':
        return this.mapCharName(msg.data);
      case 'Char.Status':
        return { type: 'Char.Status', data: msg.data };
      case 'Char.Vitals':
        return { type: 'Char.Vitals', data: msg.data };
      case 'Char.Stats':
        return { type: 'Char.Stats', data: msg.data };

      // -- Inventory --
      case 'Char.Items.List':
        return {
          type: 'Char.Items.List',
          entries: msg.data as InventoryEntry[],
        };
      case 'Char.Items.Add':
        return {
          type: 'Char.Items.Add',
          entry: msg.data as InventoryEntry,
        };
      case 'Char.Items.Remove':
        return {
          type: 'Char.Items.Remove',
          entry: msg.data as InventoryEntry,
        };

      // -- Sound --
      case 'Sound.Url':
        return this.mapSoundUrl(msg.data);
      case 'Sound.Event':
        return this.mapSoundEvent(msg.data);

      // -- Files --
      case 'Files.DirectoryList':
        return this.mapFilesDirectory(msg.data);
      case 'Files.OpenFile':
        return this.mapFilesOpen(msg.data);

      // -- Input Completion --
      case 'Input.Complete':
        return this.mapInputComplete(msg.data);

      // -- Numpad --
      case 'Numpad.SendLevel':
        return { type: 'Numpad.SendLevel', data: msg.data };
      case 'Numpad.Update':
        return { type: 'Numpad.SendLevel', data: msg.data };

      // -- Room --
      case 'Room.Info':
        return { type: 'Room.Info', data: msg.data };

      // -- Communication --
      case 'Comm.Say':
      case 'Comm.Tell':
      case 'Comm.Soul':
        return {
          type: 'Comm.Message',
          channel: msg.messageName,
          data: msg.data,
        };

      // -- Core --
      case 'Core.Ping':
        return { type: 'Core.Ping' };
      case 'Core.Goodbye':
        return { type: 'Core.Goodbye' };

      default:
        console.debug(
          `[MudSignal] Unhandled GMCP message: ${msg.fullMessage}`,
          msg.data,
        );
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Signal Mappers
  // ---------------------------------------------------------------------------

  private mapCharName(data: unknown): MudSignal {
    const d = data as Record<string, unknown>;

    return {
      type: 'Char.Name',
      name: String(d?.['name'] ?? ''),
      wizard: typeof d?.['wizard'] === 'number' ? d['wizard'] : undefined,
    };
  }

  private mapSoundUrl(data: unknown): MudSignal | null {
    const d = data as Record<string, unknown>;
    const url = d?.['url'];

    if (typeof url !== 'string') {
      return null;
    }

    return { type: 'Sound.Play', url };
  }

  private mapSoundEvent(data: unknown): MudSignal | null {
    const d = data as Record<string, unknown>;
    const url = d?.['file'] ?? d?.['url'];

    if (typeof url !== 'string') {
      return null;
    }

    return { type: 'Sound.Play', url };
  }

  private mapFilesDirectory(data: unknown): MudSignal {
    const d = data as Record<string, unknown>;

    return {
      type: 'Files.Dir',
      path: String(d?.['path'] ?? '/'),
      entries: (d?.['files'] ?? []) as FileEntry[],
    };
  }

  private mapFilesOpen(data: unknown): MudSignal {
    const d = data as Record<string, unknown>;

    return {
      type: 'Files.Open',
      fileinfo: d as unknown as import('./mud-signals').FileInfo,
    };
  }

  private mapInputComplete(data: unknown): MudSignal {
    const d = data as Record<string, unknown>;
    const type = d?.['type'];

    if (type === 'text') {
      return {
        type: 'Input.CompleteText',
        text: String(d?.['text'] ?? ''),
      };
    }

    if (type === 'choice') {
      return {
        type: 'Input.CompleteChoice',
        choices: (d?.['choices'] ?? []) as string[],
      };
    }

    return { type: 'Input.CompleteNone' };
  }
}
