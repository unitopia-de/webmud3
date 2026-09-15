import { Injectable } from '@angular/core';

import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';

/**
 * localStorage-Suffixe, die als „Einstellungen" exportiert/importiert werden.
 *
 * Kuratierte Whitelist statt Präfix-Filter, weil es zwei Namens-Schemata gibt
 * (`webmud3-*` UND `wm3cc.*`). Bewusst NICHT enthalten:
 *  - `webmud3-session-token`, `webmud3-known-server-id` — Sitzungs-/
 *    Verbindungsdaten, gehören nicht in eine teilbare Datei.
 *  - `webmud3-history` — Ausgabe-Backlog, keine Einstellung.
 *  - `webmud3-window-geometry` — Fenster-Positionen (auf Nutzerwunsch außen vor;
 *    sitzen auf anderem Bildschirm evtl. ungünstig).
 */
export const EXPORTABLE_SETTING_KEYS: readonly string[] = [
  'webmud3-last-shell',
  'webmud3-mobile-input',
  'webmud3-numpad-bindings',
  'webmud3-sound-enabled',
  'webmud3-ez-output-verbosity',
  'webmud3-ez-quiet-output', // Legacy „Ruhige Ausgabe" (Migrationsquelle)
  'webmud3-ez-tail-fraction',
  'webmud3-ez-perf-hud',
  'webmud3-ez-sticky-input',
  'webmud3-ez-speech-pacing', // „Ausreden lassen" ('1'/'0')
  'webmud3-ez-speech-rate', // Lesetempo-Stufe
  'wm3cc.sounds.personal.v1',
  'wm3cc.triggers.v1',
  'wm3cc.triggers.settings.v1',
  'webmud3-speech-settings',
  'webmud3-terminal-theme',
];

const FILE_APP = 'webmud3';
const FILE_KIND = 'settings';
const FILE_VERSION = 1;

/** Form einer exportierten Einstellungsdatei. */
export interface SettingsExport {
  app: string;
  kind: string;
  version: number;
  exportedAt: string;
  entries: Record<string, string>;
}

/**
 * Exportiert/importiert die App-Einstellungen aus dem localStorage als
 * JSON-Datei. Root-Singleton; die UI sitzt im Einstellungs-Fenster
 * (Reiter „Import/Export").
 *
 * Portabel zwischen Deployments: gespeichert werden die Suffixe OHNE
 * Namespace-Präfix; beim Import wird über `namespacedStorage.set` der aktuelle
 * Namespace angewandt.
 */
@Injectable({ providedIn: 'root' })
export class SettingsTransferService {
  /** Baut das Export-Objekt aus allen aktuell gesetzten Whitelist-Schlüsseln. */
  public buildExport(): SettingsExport {
    const entries: Record<string, string> = {};
    for (const suffix of EXPORTABLE_SETTING_KEYS) {
      const value = namespacedStorage.get(suffix);
      if (value !== null) {
        entries[suffix] = value;
      }
    }
    return {
      app: FILE_APP,
      kind: FILE_KIND,
      version: FILE_VERSION,
      exportedAt: new Date().toISOString(),
      entries,
    };
  }

  /** Serialisiert den Export als hübsch eingerücktes JSON. */
  public serialize(): string {
    return JSON.stringify(this.buildExport(), null, 2);
  }

  /** Löst den Datei-Download der aktuellen Einstellungen aus. */
  public download(): void {
    const blob = new Blob([this.serialize()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `webmud3-einstellungen-${this.dateStamp()}.json`;
      a.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Wendet eine importierte Datei an: prüft die Form, schreibt nur Schlüssel
   * aus der Whitelist zurück (Fremdes wird ignoriert) und gibt die Anzahl der
   * übernommenen Schlüssel zurück. Wirft bei kaputtem/ungültigem Inhalt.
   *
   * Damit die Werte wirksam werden, muss die Seite anschließend neu geladen
   * werden — die Services lesen den localStorage nur beim Start.
   */
  public applyImport(text: string): number {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Datei ist kein gültiges JSON.');
    }

    if (!this.isSettingsExport(parsed)) {
      throw new Error('Keine gültige webmud3-Einstellungsdatei.');
    }

    const allowed = new Set(EXPORTABLE_SETTING_KEYS);
    let applied = 0;
    for (const [suffix, value] of Object.entries(parsed.entries)) {
      if (allowed.has(suffix) && typeof value === 'string') {
        namespacedStorage.set(suffix, value);
        applied += 1;
      }
    }
    return applied;
  }

  private isSettingsExport(value: unknown): value is SettingsExport {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const v = value as Record<string, unknown>;
    return (
      v['app'] === FILE_APP &&
      v['kind'] === FILE_KIND &&
      typeof v['entries'] === 'object' &&
      v['entries'] !== null
    );
  }

  private dateStamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
