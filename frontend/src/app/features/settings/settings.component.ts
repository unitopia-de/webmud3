import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';

import { DebugSettingsService } from '@webmud3/frontend/features/debug/debug-settings.service';
import { PerfHudService } from '@webmud3/frontend/features/terminal-ez/perf-hud.service';
import {
  SPEECH_RATE_OPTIONS,
  SpeechPacingService,
  SpeechRate,
  SpeechSettingsService,
} from '@webmud3/frontend/features/terminal';
import { SettingsTransferService } from './settings-transfer.service';

type TabId = 'accessibility' | 'diagnostics' | 'transfer';

/**
 * Settings dialog hosted in a modeless window. Currently exposes two tabs:
 *
 *   - Barrierefreiheit: polite Safari input mode; „Ausreden lassen" und
 *     Lesetempo (Spiegel der Footer-Menü-Einträge der EZ-Shell, hier mit
 *     Erklärtext, für den im Menü kein Platz ist).
 *   - Diagnose: rarely-used dev / support toggles (screen reader debug log,
 *     paste debug log, raw output hex dump).
 *
 * Each toggle reads/writes its corresponding service directly; the
 * BehaviorSubjects in those services already drive the templates via the
 * async pipe, so no manual change detection wiring is needed.
 */
@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly speech = inject(SpeechSettingsService);
  private readonly pacing = inject(SpeechPacingService);
  private readonly debug = inject(DebugSettingsService);
  private readonly perfHud = inject(PerfHudService);
  private readonly transfer = inject(SettingsTransferService);

  public readonly activeTab = signal<TabId>('accessibility');

  // ---- Streams consumed by the template via the async pipe -----------------

  public readonly politeInput$ = this.speech.politeInputMode$;

  /** „Ausreden lassen" + Lesetempo (Signale; Menü und Fenster bleiben synchron). */
  public readonly pacingEnabled = this.pacing.enabled;
  public readonly speechRate = this.pacing.rate;
  public readonly rateOptions = SPEECH_RATE_OPTIONS;

  public readonly screenReaderLogging$ = this.debug.screenReaderLogging$;
  public readonly pasteLogging$ = this.debug.pasteLogging$;
  public readonly outputHexLogging$ = this.debug.outputHexLogging$;

  /** Perf-HUD toggle state (signal), shown in the Diagnose tab. */
  public readonly perfHudEnabled = this.perfHud.enabled;

  /** Status line for the Import/Export tab (aria-live). */
  public readonly transferStatus = signal('');

  // ---- Tab handling --------------------------------------------------------

  public selectTab(id: TabId): void {
    this.activeTab.set(id);
  }

  // ---- Toggle dispatchers --------------------------------------------------

  public togglePoliteInput(): void {
    this.speech.togglePoliteInputMode();
  }

  public togglePacing(): void {
    this.pacing.toggle();
  }

  public onRateChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as SpeechRate;
    if (this.rateOptions.some((o) => o.id === value)) {
      this.pacing.setRate(value);
    }
  }

  public toggleScreenReaderLogging(): void {
    this.debug.toggleScreenReaderLogging();
  }

  public togglePasteLogging(): void {
    this.debug.togglePasteLogging();
  }

  public toggleOutputHexLogging(): void {
    this.debug.toggleOutputHexLogging();
  }

  public togglePerfHud(): void {
    this.perfHud.toggle();
  }

  // ---- Import / Export -----------------------------------------------------

  public exportSettings(): void {
    this.transfer.download();
    this.transferStatus.set('Einstellungen wurden als Datei exportiert.');
  }

  public onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset so picking the same file again re-fires `change`.
    input.value = '';
    if (!file) {
      return;
    }
    void file.text().then((text) => {
      let count: number;
      try {
        count = this.transfer.applyImport(text);
      } catch {
        this.transferStatus.set(
          'Import fehlgeschlagen: keine gültige Einstellungsdatei.',
        );
        return;
      }
      // Settings are read by the services only at startup, so a reload is
      // needed to apply them. Ask first (the native confirm is read by JAWS).
      const reload = window.confirm(
        `${count} Einstellung(en) importiert. Seite jetzt neu laden, um sie anzuwenden?`,
      );
      if (reload) {
        window.location.reload();
      } else {
        this.transferStatus.set(
          `${count} Einstellung(en) importiert — wirksam beim nächsten Neuladen.`,
        );
      }
    });
  }
}
