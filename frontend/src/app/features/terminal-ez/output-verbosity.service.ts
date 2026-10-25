import { Injectable, signal } from '@angular/core';
import type { OutputVerbosity } from '@webmud3/frontend/features/terminal';
import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';

const STORAGE_SUFFIX = 'webmud3-ez-output-verbosity';
/** Legacy-Schlüssel der früheren „Ruhige Ausgabe"-Checkbox ('1' = an). */
const LEGACY_QUIET_SUFFIX = 'webmud3-ez-quiet-output';

const VALID_LEVELS: readonly OutputVerbosity[] = ['chatty', 'normal', 'quiet'];
const DEFAULT_LEVEL: OutputVerbosity = 'chatty';

/**
 * Vom Nutzer wählbare Vorlese-Ausführlichkeit der EZ-Shell.
 *
 * Verschiedene Screenreader haben gegensätzliche Bedürfnisse: Windows-JAWS
 * will Ausgabe zuverlässig angehängt bekommen, iOS-VoiceOver bricht bei vielen
 * DOM-Mutationen ein. Statt zwei Sonderwege bietet diese eine Einstellung drei
 * Stufen an (siehe {@link OutputVerbosity} im Announcer):
 *
 *  - 'chatty' (Gesprächig): jeder Chunk sofort — bisheriges, erprobtes
 *    NVDA/JAWS-Verhalten. **Default**, damit kein zufriedener Tester einen
 *    stillen Rückschritt erlebt.
 *  - 'normal': gebündelt angehängt — weniger Mutationen, Additions-Semantik.
 *  - 'quiet' (Ruhig): ersetzt + gebündelt — für iOS VoiceOver.
 *
 * Migration: Wer früher die „Ruhige Ausgabe"-Checkbox aktiviert hatte
 * (Legacy-localStorage '1'), startet auf 'quiet', behält also sein Verhalten.
 *
 * Eigener Root-Singleton, weil der Schalter von der Shell (Footer-Menü)
 * registriert, der Wert aber von Output-/Input-Komponente gelesen wird —
 * spiegelt das Muster von StickyInputService / PerfHudService.
 */
@Injectable({ providedIn: 'root' })
export class OutputVerbosityService {
  /** Reaktive Stufe, die Output-Komponente / Announcer / Input lesen. */
  public readonly level = signal<OutputVerbosity>(DEFAULT_LEVEL);

  constructor() {
    this.level.set(this.load());
  }

  private load(): OutputVerbosity {
    const stored = namespacedStorage.get(STORAGE_SUFFIX);
    if (stored && (VALID_LEVELS as readonly string[]).includes(stored)) {
      return stored as OutputVerbosity;
    }
    // Migration der alten „Ruhige Ausgabe"-Checkbox.
    if (namespacedStorage.get(LEGACY_QUIET_SUFFIX) === '1') {
      return 'quiet';
    }
    return DEFAULT_LEVEL;
  }

  public setLevel(level: OutputVerbosity): void {
    this.level.set(level);
    namespacedStorage.set(STORAGE_SUFFIX, level);
  }
}
