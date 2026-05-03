import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { map } from 'rxjs/operators';

import { PlayermapService, PlayermapState } from './playermap.service';

/** Visible window dimensions in characters. */
export const PLAYERMAP_VIEW_COLS = 25;
export const PLAYERMAP_VIEW_ROWS = 25;

/**
 * One cell of the rendered map view. We pre-split rows into individual
 * characters so the template can highlight the player's position cheaply.
 */
type ViewCell = {
  ch: string;
  isPlayer: boolean;
};

type ViewModel = {
  /** Always 25 rows * 25 columns; padded with `fill` if the source is smaller. */
  rows: ViewCell[][];
  /** True when no map data is available (e.g. between rooms or pre-connect). */
  empty: boolean;
};

/**
 * Renders the player's mini-map as a fixed 25x25 monospace block.
 *
 * The MUD-supplied map can be any size: we crop a 25x25 viewport around the
 * player position when known, otherwise we crop the top-left 25x25 corner.
 * If the map is smaller than 25x25 we pad with the provider's fill character
 * (or a space) so the window dimensions stay constant.
 *
 * ANSI escape sequences are stripped — the playermap is meant to be a quick
 * spatial overview, and we don't render colors here. (Per-cell colorization
 * could be added later if needed.)
 */
@Component({
  selector: 'app-playermap',
  templateUrl: './playermap.component.html',
  styleUrls: ['./playermap.component.scss'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayermapComponent {
  private readonly playermap = inject(PlayermapService);

  public readonly viewModel$ = this.playermap.state$.pipe(
    map((state) => this.buildView(state)),
  );

  /** Track-by helpers keep the DOM stable when only a few characters change. */
  public trackRow(index: number): number {
    return index;
  }

  public trackCell(index: number): number {
    return index;
  }

  private buildView(state: PlayermapState): ViewModel {
    const fill = state.fill && state.fill.length > 0 ? state.fill[0] : ' ';

    if (state.map === null) {
      return {
        rows: this.makeEmptyGrid(fill),
        empty: true,
      };
    }

    const stripped = this.stripAnsi(state.map);
    const sourceRows = stripped.replace(/\r\n/g, '\n').split('\n');

    // Decide which 25x25 window of the source to show. If we know where the
    // player stands, center on that; otherwise show the top-left corner.
    const playerCol = state.pos?.[0];
    const playerRow = state.pos?.[1];

    const startCol =
      typeof playerCol === 'number'
        ? this.clampStart(playerCol, PLAYERMAP_VIEW_COLS, this.maxRowLen(sourceRows))
        : 0;
    const startRow =
      typeof playerRow === 'number'
        ? this.clampStart(playerRow, PLAYERMAP_VIEW_ROWS, sourceRows.length)
        : 0;

    const rows: ViewCell[][] = [];

    for (let r = 0; r < PLAYERMAP_VIEW_ROWS; r++) {
      const sourceLine = sourceRows[startRow + r] ?? '';
      const lineCells: ViewCell[] = [];

      for (let c = 0; c < PLAYERMAP_VIEW_COLS; c++) {
        const sourceColIdx = startCol + c;
        const ch = sourceLine[sourceColIdx] ?? fill;
        const isPlayer =
          typeof playerCol === 'number' &&
          typeof playerRow === 'number' &&
          startCol + c === playerCol &&
          startRow + r === playerRow;

        lineCells.push({ ch, isPlayer });
      }

      rows.push(lineCells);
    }

    return { rows, empty: false };
  }

  private makeEmptyGrid(fill: string): ViewCell[][] {
    const rows: ViewCell[][] = [];
    for (let r = 0; r < PLAYERMAP_VIEW_ROWS; r++) {
      const row: ViewCell[] = [];
      for (let c = 0; c < PLAYERMAP_VIEW_COLS; c++) {
        row.push({ ch: fill, isPlayer: false });
      }
      rows.push(row);
    }
    return rows;
  }

  private maxRowLen(rows: string[]): number {
    let maxLen = 0;
    for (const row of rows) {
      if (row.length > maxLen) {
        maxLen = row.length;
      }
    }
    return maxLen;
  }

  /**
   * Picks the starting index so that `target` is centered in a viewport of
   * `viewSize` while never running past `total` (the source length).
   */
  private clampStart(target: number, viewSize: number, total: number): number {
    const half = Math.floor(viewSize / 2);
    const ideal = target - half;
    const max = Math.max(0, total - viewSize);
    return Math.max(0, Math.min(ideal, max));
  }

  private stripAnsi(raw: string): string {
    return raw.replace(/\x1B\[[0-9;?]*[ -\/]*[@-~]/g, '');
  }
}
