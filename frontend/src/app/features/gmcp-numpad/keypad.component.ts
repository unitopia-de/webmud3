import { Component, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { NumpadGmcpHandler } from './numpad-gmcp-handler';
import type { OneKeypadData } from './keypad-data';
import type { WindowConfig } from '../windows/window-config';

/**
 * Grid layout for the directional numpad.
 * Each entry: [gridPosition, displayLabel, numpadKeyCode]
 */
const NUMPAD_GRID: Array<[string, string, string]> = [
  ['1/1', 'NW', 'Numpad7'],
  ['1/2', 'N', 'Numpad8'],
  ['1/3', 'NO', 'Numpad9'],
  ['2/1', 'W', 'Numpad4'],
  ['2/2', '·', 'Numpad5'],
  ['2/3', 'O', 'Numpad6'],
  ['3/1', 'SW', 'Numpad1'],
  ['3/2', 'S', 'Numpad2'],
  ['3/3', 'SO', 'Numpad3'],
];

/**
 * Visual numpad widget rendered in a modeless window.
 *
 * Displays a 3x3 directional grid (NW, N, NE, W, center, E, SW, S, SE).
 * Each button shows the mapped MUD command and sends it on click.
 *
 * ARIA: role="grid", aria-label per button.
 */
@Component({
  selector: 'app-keypad',
  standalone: true,
  template: `
    <div class="keypad-grid" role="grid" aria-label="Richtungs-Numpad">
      @for (cell of grid; track cell[2]) {
        <button
          class="keypad-btn"
          [style.grid-area]="cell[0]"
          [title]="getCommand(cell[2]) || cell[1]"
          [attr.aria-label]="cell[1] + ': ' + (getCommand(cell[2]) || 'nicht belegt')"
          [disabled]="!getCommand(cell[2])"
          (click)="onKeyClick(cell[2])"
        >
          <span class="keypad-label">{{ cell[1] }}</span>
          <span class="keypad-cmd">{{ getCommand(cell[2]) }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .keypad-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
      gap: 4px;
      padding: 4px;
      height: 100%;
    }

    .keypad-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 1px solid #45475a;
      border-radius: 6px;
      background: #313244;
      color: #cdd6f4;
      cursor: pointer;
      padding: 4px;
      font-family: sans-serif;
      min-height: 50px;
      transition: background 0.1s;

      &:hover:not(:disabled) {
        background: #45475a;
      }

      &:active:not(:disabled) {
        background: #585b70;
      }

      &:disabled {
        color: #585b70;
        cursor: default;
        border-color: #313244;
      }

      &:focus-visible {
        outline: 2px solid #89b4fa;
        outline-offset: 1px;
      }
    }

    .keypad-label {
      font-size: 11px;
      font-weight: 600;
      color: #a6adc8;
    }

    .keypad-cmd {
      font-size: 10px;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
  `],
})
export class KeypadComponent implements OnInit, OnDestroy {
  @Input() config!: WindowConfig;

  private readonly numpadHandler = inject(NumpadGmcpHandler);
  private subscription?: Subscription;

  /** Current level being displayed (default: no modifier) */
  private currentLevel: OneKeypadData | null = null;

  /** Grid layout definition */
  protected readonly grid = NUMPAD_GRID;

  ngOnInit(): void {
    this.subscription = this.numpadHandler.keypadData$.subscribe(data => {
      this.currentLevel = data.getLevel('');
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Returns the MUD command mapped to the given numpad key, or empty string.
   */
  getCommand(keyCode: string): string {
    return this.currentLevel?.keys.get(keyCode) ?? '';
  }

  /**
   * Sends the mapped command when a numpad button is clicked.
   */
  onKeyClick(keyCode: string): void {
    const command = this.getCommand(keyCode);

    if (command !== '') {
      this.numpadHandler['gmcpService'].sendOutgoing('Input', 'Line', command);
      console.debug(`[KeypadComponent] Sent: ${command} (key: ${keyCode})`);
    }
  }
}
