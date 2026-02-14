import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';

import { GmcpService } from '../gmcp/gmcp.service';
import type { GmcpModuleHandler } from '../gmcp/gmcp-module-handler';
import { WindowAction } from '../windows/window-config';
import { WindowService } from '../windows/window.service';

import {
  CharacterData,
  createCharacterData,
  parseStats,
  parseVitals,
} from './character-data';
import { InventoryEntry, InventoryList } from './inventory-data';

/**
 * Payload shape for GMCP `Char.Name`.
 */
interface CharNamePayload {
  name: string;
  fullname?: string;
  gender?: string;
  wizard?: number;
}

/**
 * GMCP handler for the `Char` module.
 *
 * Handles:
 * - `Char.Name`        → Character name, title, wizard flag
 * - `Char.StatusVars`   → Available status variable definitions
 * - `Char.Status`       → Current status values (guild, race, rank)
 * - `Char.Vitals`       → HP/SP values (changes frequently)
 * - `Char.Stats`        → STR/INT/CON/DEX attributes
 * - `Char.Items.List`   → Full inventory list
 * - `Char.Items.Add`    → Add single item to inventory
 * - `Char.Items.Remove` → Remove single item from inventory
 *
 * State is exposed as a `BehaviorSubject<CharacterData | null>`.
 * The statusbar component subscribes to this for reactive rendering.
 * Inventory is managed separately via `inventory$` BehaviorSubject.
 *
 * When `Char.Name` is received with `wizard > 0`, wizard-only GMCP
 * modules (Files, Input, Numpad) are automatically enabled.
 */
@Injectable({ providedIn: 'root' })
export class CharGmcpHandler implements GmcpModuleHandler {
  readonly moduleName = 'Char';
  readonly version = '1';

  private readonly gmcpService = inject(GmcpService);
  private readonly titleService = inject(Title);
  private readonly windowService = inject(WindowService);

  /** Window ID of the inventory window (if open) */
  private inventoryWindowId: string | null = null;

  /**
   * Reactive stream of character data.
   * `null` means no character is logged in (statusbar hidden).
   */
  public readonly characterData$ = new BehaviorSubject<CharacterData | null>(null);

  /**
   * Reactive stream of inventory data.
   * The InventoryList instance is mutable; a new reference is emitted
   * on each change to trigger change detection.
   */
  public readonly inventory$ = new BehaviorSubject<InventoryList>(new InventoryList());

  /**
   * Routes incoming GMCP `Char.*` messages.
   */
  handleMessage(message: string, data: unknown): void {
    const msgLower = message.toLowerCase().trim();

    switch (msgLower) {
      case 'name':
        this.handleCharName(data as CharNamePayload);
        break;

      case 'statusvars':
        this.handleStatusVars(data as Record<string, string>);
        break;

      case 'status':
        this.handleStatus(data as Record<string, string | number>);
        break;

      case 'vitals':
        this.handleVitals(data as string | Record<string, unknown>);
        break;

      case 'stats':
        this.handleStats(data as string | Record<string, unknown>);
        break;

      case 'items.list':
        this.handleItemsList(data as { items: InventoryEntry[] });
        break;

      case 'items.add':
        this.handleItemsAdd(data as { item: InventoryEntry });
        break;

      case 'items.remove':
        this.handleItemsRemove(data as { item: InventoryEntry });
        break;

      default:
        console.debug(`[CharGmcpHandler] Unknown message: Char.${message}`, data);
    }
  }

  /**
   * Cleanup: reset character data and inventory to defaults, close inventory window.
   */
  dispose(): void {
    this.characterData$.next(null);
    this.inventory$.next(new InventoryList());

    // Close inventory window if open
    if (this.inventoryWindowId !== null) {
      this.windowService.close(this.inventoryWindowId);
      this.inventoryWindowId = null;
    }

    console.info('[CharGmcpHandler] Disposed.');
  }

  /**
   * Returns the current character data snapshot (for synchronous access).
   */
  public get currentData(): CharacterData | null {
    return this.characterData$.value;
  }

  /**
   * Handles `Char.Name`: initializes character data, sets browser title,
   * and enables wizard-only modules if applicable.
   */
  private handleCharName(payload: CharNamePayload): void {
    let charData = this.characterData$.value;

    if (charData === null) {
      charData = createCharacterData(payload.name);
    }

    charData = {
      ...charData,
      name: payload.name,
      fullname: payload.fullname,
      gender: payload.gender,
      wizard: payload.wizard ?? 0,
      isWizard: (payload.wizard ?? 0) > 0,
    };

    this.characterData$.next(charData);

    // Update browser tab title
    const titlePart = payload.fullname ?? payload.name;
    this.titleService.setTitle(titlePart);

    console.info(
      `[CharGmcpHandler] Char.Name: ${payload.name} (wizard: ${charData.wizard})`,
    );

    // Enable wizard-only modules
    if (charData.isWizard) {
      this.gmcpService.sendOutgoing('Core', 'Supports.Add', ['Files 1']);
      this.gmcpService.sendOutgoing('Core', 'Supports.Add', ['Input 1']);
      this.gmcpService.sendOutgoing('Core', 'Supports.Add', ['Numpad 1']);

      console.info('[CharGmcpHandler] Wizard detected — enabled Files, Input, Numpad modules.');
    }
  }

  /**
   * Handles `Char.StatusVars`: stores the available status variable definitions.
   */
  private handleStatusVars(vars: Record<string, string>): void {
    const charData = this.ensureCharData();

    this.characterData$.next({
      ...charData,
      statusVars: { ...vars },
    });

    console.debug('[CharGmcpHandler] StatusVars updated:', Object.keys(vars).length, 'vars');
  }

  /**
   * Handles `Char.Status`: updates current status values (guild, race, rank).
   */
  private handleStatus(status: Record<string, string | number>): void {
    const charData = this.ensureCharData();

    this.characterData$.next({
      ...charData,
      status: { ...charData.status, ...status },
    });

    console.debug('[CharGmcpHandler] Status updated:', status);
  }

  /**
   * Handles `Char.Vitals`: parses HP/SP values.
   *
   * Accepts both string format ("hp=100|sp=80") and object format ({ hp: 100, sp: 80 }).
   */
  private handleVitals(data: string | Record<string, unknown>): void {
    const charData = this.ensureCharData();
    let vitals;

    if (typeof data === 'string') {
      vitals = parseVitals(data);
    } else {
      // Object format — extract numeric values
      vitals = {
        hp: typeof data['hp'] === 'number' ? data['hp'] : charData.vitals.hp,
        sp: typeof data['sp'] === 'number' ? data['sp'] : charData.vitals.sp,
        maxHp: typeof data['maxhp'] === 'number' ? data['maxhp'] : charData.vitals.maxHp,
        maxSp: typeof data['maxsp'] === 'number' ? data['maxsp'] : charData.vitals.maxSp,
      };
    }

    this.characterData$.next({
      ...charData,
      vitals: { ...charData.vitals, ...vitals },
    });
  }

  /**
   * Handles `Char.Stats`: parses attribute values (STR, INT, CON, DEX).
   *
   * Accepts both string format ("str=59,8|int=130|con=34,2|dex=59,7")
   * and object format.
   */
  private handleStats(data: string | Record<string, unknown>): void {
    const charData = this.ensureCharData();
    let stats;

    if (typeof data === 'string') {
      stats = parseStats(data);
    } else {
      // Object format — convert to string and parse
      const parts = Object.entries(data)
        .map(([key, value]) => `${key}=${value}`)
        .join('|');

      stats = parseStats(parts);
    }

    this.characterData$.next({
      ...charData,
      stats,
    });
  }

  /**
   * Handles `Char.Items.List`: replaces the entire inventory and opens the window.
   */
  private handleItemsList(data: { items: InventoryEntry[] }): void {
    const inv = this.inventory$.value;
    inv.initList(data.items ?? []);

    // Emit a new reference to trigger change detection
    this.inventory$.next(inv);

    // Open or refresh the inventory window
    this.openInventoryWindow();

    console.debug(
      '[CharGmcpHandler] Items.List received:',
      inv.totalItems,
      'items in',
      inv.getCategories().length,
      'categories',
    );
  }

  /**
   * Handles `Char.Items.Add`: adds a single item to the inventory.
   */
  private handleItemsAdd(data: { item: InventoryEntry }): void {
    if (data.item == null) {
      return;
    }

    const inv = this.inventory$.value;
    inv.addItem(data.item);
    this.inventory$.next(inv);

    console.debug('[CharGmcpHandler] Items.Add:', data.item.name, '→', data.item.category);
  }

  /**
   * Handles `Char.Items.Remove`: removes a single item from the inventory.
   */
  private handleItemsRemove(data: { item: InventoryEntry }): void {
    if (data.item == null) {
      return;
    }

    const inv = this.inventory$.value;
    const removed = inv.removeItem(data.item);
    this.inventory$.next(inv);

    if (removed) {
      console.debug('[CharGmcpHandler] Items.Remove:', data.item.name, '←', data.item.category);
    } else {
      console.debug('[CharGmcpHandler] Items.Remove: item not found:', data.item.name);
    }
  }

  /**
   * Opens (or focuses) the inventory modeless window.
   */
  private openInventoryWindow(): void {
    // If already open, just focus it
    if (this.inventoryWindowId !== null) {
      this.windowService.focus(this.inventoryWindowId);
      return;
    }

    const windowId = this.windowService.open({
      title: 'Inventar',
      componentType: 'InventoryComponent',
      position: { x: 20, y: 60 },
      size: { width: 320, height: 400 },
    });

    this.inventoryWindowId = windowId;

    // Listen for close events to clear our reference
    const subscription = this.windowService.outgoingEvents$.subscribe((event) => {
      if (event.windowId === windowId && event.action === WindowAction.CloseParent) {
        this.inventoryWindowId = null;
        subscription.unsubscribe();
      }
    });
  }

  /**
   * Ensures charData exists (creates a placeholder if Char.Name hasn't been received yet).
   */
  private ensureCharData(): CharacterData {
    let charData = this.characterData$.value;

    if (charData === null) {
      charData = createCharacterData('');
      // Note: we don't emit here — the individual handler will emit after updating
    }

    return charData;
  }
}
