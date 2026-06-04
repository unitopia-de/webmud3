import { Injectable } from '@angular/core';

/**
 * Click action attached to an OSC 8 hyperlink in the xterm buffer.
 *
 *  - `simple`: send the `command` verbatim to the MUD.
 *  - `choice`: present `commands` as a menu and send the picked one.
 */
export type ClickAction =
  | { kind: 'simple'; command: string }
  | { kind: 'choice'; commands: string[] };

/**
 * Stored region. The `epoch` value snapshots `roomEpoch` at registration
 * time — a link whose epoch no longer matches the current `roomEpoch`
 * (after a `<rexpire>`) is treated as expired and clicks are ignored,
 * so old room exits in the scrollback can't accidentally fire.
 *
 * Regions without an `expireDomain` always stay alive, regardless of
 * the epoch.
 */
export type ClickRegion = {
  id: number;
  action: ClickAction;
  label: string;
  expireDomain?: string;
  epoch: number;
};

@Injectable({ providedIn: 'root' })
export class MxpClickableService {
  private nextId = 1;
  private readonly regions = new Map<number, ClickRegion>();
  /**
   * Counter that increases every time the server sends `<rexpire>` (i.e.
   * the player has moved to a new room). Regions registered while
   * `roomEpoch === N` are only valid as long as `roomEpoch` is still N.
   */
  private roomEpoch = 0;

  public register(
    action: ClickAction,
    label: string,
    expireDomain?: string,
  ): number {
    const id = this.nextId++;
    this.regions.set(id, {
      id,
      action,
      label,
      expireDomain,
      epoch: this.roomEpoch,
    });
    return id;
  }

  /**
   * Returns the live region for the given id, or null if the region was
   * cleared or has been expired by a domain switch (e.g. the player has
   * moved to a new room and clicked an exit from the scrollback).
   */
  public lookup(id: number): ClickRegion | null {
    const region = this.regions.get(id);
    if (region === undefined) {
      return null;
    }
    if (region.expireDomain === 'room' && region.epoch !== this.roomEpoch) {
      return null;
    }
    return region;
  }

  /**
   * Invalidates every region in the given domain. For "room" we bump the
   * roomEpoch so any region registered before this point will fail the
   * epoch check in `lookup`. Other domains are not used by UNItopia yet,
   * but we still iterate so the API stays general.
   */
  public expireDomain(name: string): void {
    if (name === 'room') {
      this.roomEpoch += 1;
      // Bumping the epoch already makes stale room links fail the `lookup`
      // check, but the entries linger in the Map and would otherwise grow
      // unbounded over a long session (each room registers ~20-50 exits).
      // Drop them now that they can never resolve again.
      for (const [id, r] of this.regions) {
        if (r.expireDomain === 'room' && r.epoch !== this.roomEpoch) {
          this.regions.delete(id);
        }
      }
      return;
    }
    // Generic case: drop matching regions outright.
    for (const [id, r] of this.regions) {
      if (r.expireDomain === name) {
        this.regions.delete(id);
      }
    }
  }

  /** Drops everything — use on disconnect. */
  public clear(): void {
    this.regions.clear();
    this.nextId = 1;
    this.roomEpoch = 0;
  }

  /** Test-only accessor. */
  public _all(): readonly ClickRegion[] {
    return Array.from(this.regions.values());
  }

  /** Test-only accessor. */
  public _currentEpoch(): number {
    return this.roomEpoch;
  }
}
