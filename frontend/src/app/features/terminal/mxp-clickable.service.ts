import { Injectable } from '@angular/core';

/**
 * Click action attached to a region of the xterm buffer.
 *
 *  - `simple`: send the `command` verbatim to the MUD.
 *  - `choice`: present `commands` as a menu and send the picked one. Stage 3
 *    sends `commands[0]` immediately; stage 4 will hook in the menu UI.
 */
export type ClickAction =
  | { kind: 'simple'; command: string }
  | { kind: 'choice'; commands: string[] };

/**
 * Anything we can ask for the current buffer-line of a registered region.
 * Mirrors the shape of xterm.js's `IMarker` so the MudClient can pass a
 * marker straight in without us depending on `@xterm/xterm` here. Markers
 * report `line: -1` once their backing line has scrolled out of the buffer.
 */
export interface LineMarker {
  readonly line: number;
}

/**
 * A single clickable region in the xterm buffer.
 *
 * `marker.line` is dynamic — every time the buffer scrolls or shifts, the
 * marker tracks its anchor row automatically. `xStart` is inclusive, `xEnd`
 * exclusive; both are 0-based column indices into that row.
 *
 * `expireDomain` lets the server invalidate groups of regions in one call
 * via `<expire name="…">` — UNItopia uses "room" so room-bound tags get
 * expired when the player moves.
 */
export type ClickRegion = {
  id: number;
  marker: LineMarker;
  xStart: number;
  xEnd: number;
  action: ClickAction;
  label: string;
  expireDomain?: string;
  expired: boolean;
};

@Injectable({ providedIn: 'root' })
export class MxpClickableService {
  private nextId = 1;
  private readonly regions: ClickRegion[] = [];

  public register(
    marker: LineMarker,
    xStart: number,
    xEnd: number,
    action: ClickAction,
    label: string,
    expireDomain?: string,
  ): ClickRegion | null {
    if (xEnd <= xStart) {
      // Empty region — happens when a clickable tag wraps zero-width
      // content. Nothing to highlight; skip registration.
      return null;
    }

    const region: ClickRegion = {
      id: this.nextId++,
      marker,
      xStart,
      xEnd,
      action,
      label,
      expireDomain,
      expired: false,
    };
    this.regions.push(region);
    return region;
  }

  /**
   * Returns all currently-active regions on the given line. Expired
   * regions and regions whose marker has scrolled out of the buffer
   * (`marker.line === -1`) are filtered out so the link-provider stops
   * decorating them.
   */
  public regionsForLine(line: number): ClickRegion[] {
    return this.regions.filter(
      (r) => !r.expired && r.marker.line === line && r.marker.line >= 0,
    );
  }

  /** Marks every region in the given expire-domain as expired. */
  public expireDomain(name: string): void {
    for (const r of this.regions) {
      if (r.expireDomain === name) {
        r.expired = true;
      }
    }
  }

  /** Drops everything — use on disconnect. */
  public clear(): void {
    this.regions.length = 0;
    this.nextId = 1;
  }

  /** Test-only accessor. */
  public _all(): readonly ClickRegion[] {
    return this.regions;
  }
}
