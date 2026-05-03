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

  /**
   * Cached MUD server name from the last Core.Hello message.
   * Used as a fallback when Char.Name doesn't carry the mudname itself.
   */
  private cachedMudname: string | undefined;

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
        return this.mapCharVitals(msg.data);
      case 'Char.Stats':
        return { type: 'Char.Stats', data: msg.data };

      // -- Inventory --
      case 'Char.Items.List':
        return {
          type: 'Char.Items.List',
          entries: this.extractItemsArray(msg.data).map((it) =>
            this.normalizeInventoryEntry(it),
          ),
        };
      case 'Char.Items.Add':
        return {
          type: 'Char.Items.Add',
          entry: this.normalizeInventoryEntry(this.extractSingleItem(msg.data)),
        };
      case 'Char.Items.Remove':
        return {
          type: 'Char.Items.Remove',
          entry: this.normalizeInventoryEntry(this.extractSingleItem(msg.data)),
        };

      // -- Sound --
      case 'Sound.Url':
        return this.mapSoundUrl(msg.data);
      case 'Sound.Event':
        return this.mapSoundEvent(msg.data);

      // -- Files --
      // UNItopia sends `Files.URL` (server -> client) in response to the
      // outgoing `Files.OpenFile` (client -> server) request. We accept both
      // spellings for forward compatibility with other MUDs.
      case 'Files.URL':
      case 'Files.OpenFile':
        return this.mapFilesOpen(msg.data);
      case 'Files.DirectoryList':
      case 'Files.Directory':
        return this.mapFilesDirectory(msg.data);

      // -- Input Completion --
      // UNItopia answers Input.Complete requests with one of three distinct
      // messages depending on the result; we map each separately.
      case 'Input.CompleteText':
        return this.mapInputCompleteText(msg.data);
      case 'Input.CompleteChoice':
        return this.mapInputCompleteChoice(msg.data);
      case 'Input.CompleteNone':
        return { type: 'Input.CompleteNone' };

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
      case 'Core.Hello':
        return this.mapCoreHello(msg.data);
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

    const name = String(d?.['name'] ?? '');
    // Prefer a mudname carried in the Char.Name payload itself; otherwise
    // fall back to whatever Core.Hello told us earlier.
    const inlineMudname =
      typeof d?.['mudname'] === 'string'
        ? (d['mudname'] as string)
        : typeof d?.['mud'] === 'string'
          ? (d['mud'] as string)
          : typeof d?.['host'] === 'string'
            ? (d['host'] as string)
            : undefined;

    const mudname = inlineMudname ?? this.cachedMudname;
    const fullName = mudname ? `${name}@${mudname}` : name;

    return {
      type: 'Char.Name',
      name,
      mudname,
      fullName,
      wizard: typeof d?.['wizard'] === 'number' ? d['wizard'] : undefined,
    };
  }

  private mapCoreHello(data: unknown): MudSignal {
    const d = data as Record<string, unknown>;

    // UNItopia sends `name` for the MUD identifier; spec also allows "mudname".
    const mudname =
      typeof d?.['name'] === 'string'
        ? (d['name'] as string)
        : typeof d?.['mudname'] === 'string'
          ? (d['mudname'] as string)
          : undefined;

    const version =
      typeof d?.['version'] === 'string' ? (d['version'] as string) : undefined;

    if (mudname) {
      this.cachedMudname = mudname;
    }

    return { type: 'Core.Hello', mudname, version };
  }

  private mapCharVitals(data: unknown): MudSignal {
    // UNItopia typically supplies a pre-formatted "string" field with the
    // human-readable vitals summary alongside the raw numeric fields.
    let text: string | undefined;

    if (data && typeof data === 'object') {
      const value = (data as Record<string, unknown>)['string'];
      if (typeof value === 'string') {
        text = value;
      }
    }

    return { type: 'Char.Vitals', text, data };
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
    const d = (data ?? {}) as Record<string, unknown>;

    // UNItopia sends the listing under `entries`. We fall back to `files`
    // so other MUDs that follow the IRE convention also work.
    const rawEntries = Array.isArray(d['entries'])
      ? (d['entries'] as unknown[])
      : Array.isArray(d['files'])
        ? (d['files'] as unknown[])
        : [];

    return {
      type: 'Files.Dir',
      path: String(d['path'] ?? '/'),
      entries: rawEntries as FileEntry[],
    };
  }

  private mapFilesOpen(data: unknown): MudSignal {
    const d = (data ?? {}) as Record<string, unknown>;

    // UNItopia delivers the editable URL in `url`; the rest of the codebase
    // refers to it as `lasturl`. Map it explicitly here so downstream
    // consumers don't have to know the wire-level name.
    const fileinfo: import('./mud-signals').FileInfo = {
      lasturl: String(d['url'] ?? d['lasturl'] ?? ''),
      file: String(d['file'] ?? ''),
      path: String(d['path'] ?? ''),
      filename: String(d['filename'] ?? ''),
      filetype: String(d['filetype'] ?? ''),
      title: String(d['title'] ?? ''),
      filesize: typeof d['filesize'] === 'number' ? (d['filesize'] as number) : -1,
      newfile: Boolean(d['newfile']),
      writeacl: Boolean(d['writeacl']),
      temporary: Boolean(d['temporary']),
      closable: Boolean(d['closable']),
      content: typeof d['content'] === 'string' ? (d['content'] as string) : undefined,
    };

    return { type: 'Files.Open', fileinfo };
  }

  /**
   * `Input.CompleteText` carries a bare JSON string as payload — the
   * fully-completed command line. We tolerate an object wrapper with a
   * `text` field for forward compatibility.
   */
  private mapInputCompleteText(data: unknown): MudSignal {
    let text = '';

    if (typeof data === 'string') {
      text = data;
    } else if (data && typeof data === 'object') {
      const candidate = (data as Record<string, unknown>)['text'];
      if (typeof candidate === 'string') {
        text = candidate;
      }
    }

    return { type: 'Input.CompleteText', text };
  }

  /**
   * `Input.CompleteChoice` carries a JSON array of strings. UNItopia only
   * sends this to wizards. We accept either a bare array or an object with
   * a `choices` array, again for forward compat.
   */
  private mapInputCompleteChoice(data: unknown): MudSignal {
    let choices: string[] = [];

    if (Array.isArray(data)) {
      choices = data.filter((entry): entry is string => typeof entry === 'string');
    } else if (data && typeof data === 'object') {
      const candidate = (data as Record<string, unknown>)['choices'];
      if (Array.isArray(candidate)) {
        choices = candidate.filter(
          (entry): entry is string => typeof entry === 'string',
        );
      }
    }

    return { type: 'Input.CompleteChoice', choices };
  }

  // ---------------------------------------------------------------------------
  // Inventory helpers
  // ---------------------------------------------------------------------------

  /**
   * Char.Items.List may arrive in several shapes:
   *   - direct array:           [item1, item2, ...]
   *   - wrapped in `items`:     {items: [...]}
   *   - wrapped in `inventory`: {inventory: [...]}
   *   - wrapped per location:   {inv: [...], eq: [...]}  -> we take the first array
   */
  private extractItemsArray(data: unknown): unknown[] {
    if (Array.isArray(data)) {
      return data;
    }

    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;

      for (const key of ['items', 'inventory', 'list', 'inv']) {
        const candidate = obj[key];
        if (Array.isArray(candidate)) {
          return candidate;
        }
      }

      // Fallback: first array-typed property
      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
          return value;
        }
      }
    }

    return [];
  }

  /**
   * Char.Items.Add and Char.Items.Remove may arrive as either the bare item
   * or wrapped: {location: "inv", item: {...}}. Unwrap if needed.
   */
  private extractSingleItem(data: unknown): unknown {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;

      // If it looks like a direct item (has a name/desc/id field), keep it.
      if (
        'name' in obj ||
        'desc' in obj ||
        'short' in obj ||
        'title' in obj ||
        'id' in obj
      ) {
        return obj;
      }

      // Otherwise look for a wrapper property.
      for (const key of ['item', 'entry']) {
        const candidate = obj[key];
        if (candidate && typeof candidate === 'object') {
          return candidate;
        }
      }
    }

    return data;
  }

  /**
   * Each inventory item may use different field names depending on the MUD.
   * Common variants: {name, category}, {desc, type}, {id, name}, plain string.
   */
  private normalizeInventoryEntry(item: unknown): InventoryEntry {
    if (typeof item === 'string') {
      return { name: item, category: 'Sonstiges' };
    }

    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;

      const name = String(
        o['name'] ?? o['desc'] ?? o['short'] ?? o['title'] ?? o['id'] ?? '',
      );
      const category = String(
        o['category'] ?? o['type'] ?? o['group'] ?? 'Sonstiges',
      );

      return { name, category };
    }

    return { name: String(item ?? ''), category: 'Sonstiges' };
  }
}
