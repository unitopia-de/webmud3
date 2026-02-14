import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';

import { CharacterData, formatStatusSummary } from './character-data';
import { CharGmcpHandler } from './char-gmcp-handler';

/**
 * Compact status bar displayed at the bottom of the screen.
 *
 * Shows character vitals (HP/SP), stats (STR/INT/CON/DEX),
 * and status info (guild, race, rank) in a single horizontal line.
 *
 * Only visible after GMCP `Char.Name` is received (character logged in).
 *
 * Layout:
 * ```
 * [Myonara] HP: 100/120 | SP: 80/100 | STR: 59.8 INT: 130 CON: 34.2 DEX: 59.7 | Zauberer, Mensch
 * ```
 */
@Component({
  selector: 'app-char-statusbar',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    @if (charHandler.characterData$ | async; as data) {
      @if (data.name) {
        <div class="statusbar" role="status" aria-live="polite" aria-label="Charakter-Status">
          <span class="statusbar-name" [title]="data.fullname ?? data.name">
            {{ data.name }}
          </span>

          @if (hasVitals(data)) {
            <span class="statusbar-sep">|</span>
            <span class="statusbar-vitals">
              @if (data.vitals.hp !== undefined) {
                <span class="statusbar-hp">
                  HP: {{ data.vitals.hp }}@if (data.vitals.maxHp !== undefined) {/{{ data.vitals.maxHp }}}
                </span>
              }
              @if (data.vitals.sp !== undefined) {
                <span class="statusbar-sp">
                  SP: {{ data.vitals.sp }}@if (data.vitals.maxSp !== undefined) {/{{ data.vitals.maxSp }}}
                </span>
              }
            </span>
          }

          @if (data.stats.length > 0) {
            <span class="statusbar-sep statusbar-stats-sep">|</span>
            <span class="statusbar-stats">
              @for (stat of data.stats; track stat.key) {
                <span class="statusbar-stat" [title]="stat.label">
                  {{ stat.key.toUpperCase() }}: {{ stat.value }}
                </span>
              }
            </span>
          }

          @if (getStatusSummary(data); as summary) {
            <span class="statusbar-sep statusbar-status-sep">|</span>
            <span class="statusbar-status">{{ summary }}</span>
          }
        </div>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
        flex: 0 0 auto;
      }

      .statusbar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 2px 8px;
        background: #181825;
        border-top: 1px solid #313244;
        color: #cdd6f4;
        font-family: monospace;
        font-size: 12px;
        line-height: 20px;
        white-space: nowrap;
        overflow: hidden;
      }

      .statusbar-name {
        color: #89b4fa;
        font-weight: 600;
        flex-shrink: 0;
      }

      .statusbar-sep {
        color: #45475a;
        flex-shrink: 0;
      }

      .statusbar-vitals {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }

      .statusbar-hp {
        color: #a6e3a1;
      }

      .statusbar-sp {
        color: #89dceb;
      }

      .statusbar-stats {
        display: flex;
        gap: 8px;
        flex-shrink: 1;
        overflow: hidden;
      }

      .statusbar-stat {
        color: #cba6f7;
      }

      .statusbar-status {
        color: #f9e2af;
        flex-shrink: 1;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Hide stats and status sections on narrow viewports */
      @media (max-width: 600px) {
        .statusbar-stats-sep,
        .statusbar-stats,
        .statusbar-status-sep,
        .statusbar-status {
          display: none;
        }
      }

      @media (max-width: 400px) {
        .statusbar-sep,
        .statusbar-vitals {
          display: none;
        }
      }
    `,
  ],
})
export class CharStatusBarComponent {
  protected readonly charHandler = inject(CharGmcpHandler);

  hasVitals(data: CharacterData): boolean {
    return data.vitals.hp !== undefined || data.vitals.sp !== undefined;
  }

  getStatusSummary(data: CharacterData): string {
    return formatStatusSummary(data.status, data.statusVars);
  }
}
