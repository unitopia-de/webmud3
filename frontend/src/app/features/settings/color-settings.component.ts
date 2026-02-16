import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { ColorSettingsService, ColorSettings } from './color-settings.service';
import { WindowService } from '../windows/window.service';
import { WindowAction } from '../windows/window-config';

/**
 * Color settings dialog for the terminal.
 *
 * Rendered inside a modeless window (via WindowService).
 * Provides toggle switches for:
 * - Color inversion
 * - Black-on-white mode
 * - Monochrome mode (disable colors)
 * - Local echo color picker
 *
 * Changes are applied live (no explicit save button needed).
 *
 * ARIA: role="dialog", labels on all inputs.
 */
@Component({
  selector: 'app-color-settings',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="color-settings" role="group" aria-label="Farbeinstellungen">
      <div class="setting-row">
        <label for="invertColors">Farben invertieren</label>
        <input
          id="invertColors"
          type="checkbox"
          [ngModel]="settings.invertColors"
          (ngModelChange)="onToggle('invertColors', $event)"
          aria-label="Farben invertieren"
        />
      </div>

      <div class="setting-row">
        <label for="blackOnWhite">Heller Hintergrund</label>
        <input
          id="blackOnWhite"
          type="checkbox"
          [ngModel]="settings.blackOnWhite"
          (ngModelChange)="onToggle('blackOnWhite', $event)"
          aria-label="Heller Hintergrund"
        />
      </div>

      <div class="setting-row">
        <label for="disableColors">Farben ausschalten</label>
        <input
          id="disableColors"
          type="checkbox"
          [ngModel]="settings.disableColors"
          (ngModelChange)="onToggle('disableColors', $event)"
          aria-label="Farben ausschalten"
        />
      </div>

      <div class="setting-row">
        <label for="localEchoColor">Eingabe-Farbe</label>
        <input
          id="localEchoColor"
          type="color"
          [ngModel]="settings.localEchoColor"
          (ngModelChange)="onColorChange($event)"
          aria-label="Farbe für lokale Eingabe"
        />
      </div>

      <div class="setting-actions">
        <button
          class="btn btn-reset"
          (click)="onReset()"
          aria-label="Einstellungen zurücksetzen"
        >
          Zurücksetzen
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./color-settings.component.scss'],
})
export class ColorSettingsComponent implements OnInit, OnDestroy {
  private readonly colorSettingsService = inject(ColorSettingsService);

  settings: ColorSettings = { ...this.colorSettingsService.current };

  private subscription?: Subscription;

  ngOnInit(): void {
    this.subscription = this.colorSettingsService.settings$.subscribe(s => {
      this.settings = { ...s };
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  onToggle(key: keyof ColorSettings, value: boolean): void {
    this.colorSettingsService.update({ [key]: value });
  }

  onColorChange(color: string): void {
    this.colorSettingsService.update({ localEchoColor: color });
  }

  onReset(): void {
    this.colorSettingsService.reset();
  }
}
