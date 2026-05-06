import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';

import { DebugSettingsService } from '@webmud3/frontend/features/debug/debug-settings.service';
import { SpeechSettingsService } from '@webmud3/frontend/features/terminal';

type TabId = 'accessibility' | 'diagnostics';

/**
 * Settings dialog hosted in a modeless window. Currently exposes two tabs:
 *
 *   - Barrierefreiheit: speech-related toggles (per-word announce, full-line
 *     announce, polite Safari mode).
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
  private readonly debug = inject(DebugSettingsService);

  public readonly activeTab = signal<TabId>('accessibility');

  // ---- Streams consumed by the template via the async pipe -----------------

  public readonly announceWord$ = this.speech.announceInputWord$;
  public readonly announceCommit$ = this.speech.announceInputCommit$;
  public readonly politeInput$ = this.speech.politeInputMode$;

  public readonly screenReaderLogging$ = this.debug.screenReaderLogging$;
  public readonly pasteLogging$ = this.debug.pasteLogging$;
  public readonly outputHexLogging$ = this.debug.outputHexLogging$;

  // ---- Tab handling --------------------------------------------------------

  public selectTab(id: TabId): void {
    this.activeTab.set(id);
  }

  // ---- Toggle dispatchers --------------------------------------------------

  public toggleAnnounceWord(): void {
    this.speech.toggleAnnounceInputWord();
  }

  public toggleAnnounceCommit(): void {
    this.speech.toggleAnnounceInputCommit();
  }

  public togglePoliteInput(): void {
    this.speech.togglePoliteInputMode();
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
}
