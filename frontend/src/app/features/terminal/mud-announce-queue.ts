/**
 * Zugriff auf die gemeinsame Sprech-Uhr, wie ihn die Warteschlange braucht.
 *
 * Absichtlich als schmales Interface deklariert (und nicht als Import des
 * Angular-Service): `mud-screenreader.ts` und diese Datei bleiben dadurch frei
 * von Angular, und die Queue lässt sich in Tests mit einem Doppel bespielen.
 * Implementierung: `SpeechPacingService`.
 */
export interface SpeechPacing {
  isEnabled(): boolean;
  estimateMs(text: string): number;
  /** ms bis die zuletzt reservierte Ansage voraussichtlich fertig ist (0 = frei). */
  remainingMs(): number;
  reserve(durationMs: number): void;
  reset(): void;
}

/** Obergrenze wartender Einträge. */
const MAX_QUEUE_ITEMS = 20;

/** Obergrenze der geschätzten Gesamt-Restdauer aller wartenden Einträge. */
const MAX_QUEUE_MS = 20_000;

/**
 * So viele der neuesten Einträge überleben einen Überlauf auf jeden Fall.
 * Im MUD zählt der aktuelle Zustand (Bin ich tot? Wo stehe ich?), nicht die
 * Kampfrunde von vor 30 Sekunden — deshalb wird das ÄLTESTE verworfen.
 */
const KEEP_NEWEST = 2;

/**
 * Zwei aufeinanderfolgende Einträge, deren gemeinsame geschätzte Dauer
 * darunter liegt, werden zu einem verschmolzen. Das kürzt die Warteschlange
 * und senkt zugleich die DOM-Mutationsrate.
 */
const MERGE_BELOW_MS = 800;

interface QueueItem {
  text: string;
  /**
   * Anzahl der Meldungen, die dieser Eintrag als Platzhalter vertritt.
   * `0` = gewöhnlicher Ausgabe-Eintrag.
   */
  skipped: number;
}

/**
 * Ansage über verworfene Meldungen.
 *
 * Stilles Verwerfen ist für einen blinden Nutzer inakzeptabel — er muss
 * erfahren, dass etwas fehlt, und kann es im Ausgabe-Verlauf (eigene Region,
 * `aria-live="off"`) nachlesen. Bewusst als ganzer Satz ohne Auslassungs-
 * zeichen: Screenreader sprechen „…" je nach Einstellung als
 * „Auslassungspunkte" mit.
 */
function skippedNotice(count: number): string {
  return count === 1
    ? '1 Meldung übersprungen.\n'
    : `${count} Meldungen übersprungen.\n`;
}

/**
 * Warteschlange, die Ansagen so ausliefert, dass der Screenreader ausreden
 * kann („Ausreden lassen").
 *
 * Hintergrund: Ansagen entstehen ausschließlich durch DOM-Mutationen in
 * ARIA-Live-Regionen; der Browser meldet nicht, wann eine Ansage zu Ende
 * gesprochen ist. Die Queue schätzt die Dauer daher über {@link SpeechPacing}
 * und gibt den nächsten Eintrag erst frei, wenn der vorherige voraussichtlich
 * fertig ist.
 *
 * Zwei Eigenschaften sind für die Praxis entscheidend:
 *
 *  - **Leerlauf-Regel:** Ist nichts in Arbeit, wird SOFORT und synchron
 *    geschrieben. Im Normalspiel (Befehl → Antwort → Pause) entsteht also
 *    keinerlei zusätzliche Latenz; die Queue greift nur, wenn zwei Ansagen
 *    tatsächlich kollidieren.
 *  - **Rückstau darf verworfen werden, der Verlauf nie.** Die Verlauf-Region
 *    wird unabhängig von dieser Queue befüllt, deshalb ist Verwerfen
 *    vertretbar — es bleibt navigierbar.
 *
 * Bei ausgeschaltetem Pacing ist die Klasse ein transparenter Durchreicher:
 * jeder Eintrag geht sofort durch, es läuft kein einziger Timer.
 */
export class AnnounceQueue {
  private readonly items: QueueItem[] = [];
  private timer: number | undefined;

  /**
   * @param write   Schreibt einen Block in die Live-Region (DOM-Zugriff bleibt
   *                beim Aufrufer, damit diese Klasse DOM-frei testbar ist).
   * @param pacing  Gemeinsame Sprech-Uhr und Dauer-Schätzung.
   */
  constructor(
    private readonly write: (text: string) => void,
    private readonly pacing: SpeechPacing,
  ) {}

  /** `true`, solange Einträge warten oder eine Freigabe geplant ist. */
  public isPending(): boolean {
    return this.items.length > 0 || this.timer !== undefined;
  }

  /**
   * Reiht einen Ausgabe-Block ein — oder schreibt ihn sofort, wenn gerade
   * nichts gesprochen wird (Leerlauf-Regel).
   */
  public push(text: string): void {
    if (!text) {
      return;
    }

    if (!this.pacing.isEnabled()) {
      this.write(text);
      return;
    }

    if (!this.isPending() && this.pacing.remainingMs() === 0) {
      this.emit(text);
      return;
    }

    this.appendOrMerge(text);
    this.enforceLimits();
    this.scheduleNext();
  }

  /**
   * Verwirft alles Wartende und gibt die Sprech-Uhr frei.
   *
   * Das ist der bewusste Abbruch („Sprung zum Ende", Sitzungswechsel,
   * Dispose): Er muss sofort und vollständig wirken, sonst spricht nach dem
   * Abbruch noch ein Nachzügler.
   */
  public reset(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.items.length = 0;
    this.pacing.reset();
  }

  /** Schreibt einen Block und belegt die Sprech-Uhr für seine Dauer. */
  private emit(text: string): void {
    this.write(text);
    this.pacing.reserve(this.pacing.estimateMs(text));
  }

  /**
   * Hängt an — oder verschmilzt mit dem letzten Eintrag, solange das Ergebnis
   * kurz bleibt. Platzhalter werden nie verschmolzen, sonst ginge ihre
   * Zählung verloren.
   */
  private appendOrMerge(text: string): void {
    const last = this.items[this.items.length - 1];
    if (last && last.skipped === 0) {
      const merged = `${last.text}${text}`;
      if (this.pacing.estimateMs(merged) < MERGE_BELOW_MS) {
        last.text = merged;
        return;
      }
    }
    this.items.push({ text, skipped: 0 });
  }

  /**
   * Kappt den Rückstau auf {@link MAX_QUEUE_ITEMS} Einträge und
   * {@link MAX_QUEUE_MS} geschätzte Restdauer.
   *
   * Verworfen wird von vorn (das Älteste); die neuesten {@link KEEP_NEWEST}
   * bleiben immer erhalten. Die Zahl der Verworfenen wandert in einen
   * Platzhalter am Kopf der Warteschlange und kumuliert dort über mehrere
   * Überläufe hinweg, statt sich zu mehreren Platzhaltern zu häufen.
   */
  private enforceLimits(): void {
    let skipped = 0;

    while (
      this.items.length > KEEP_NEWEST &&
      (this.items.length > MAX_QUEUE_ITEMS ||
        this.estimatedTotalMs() > MAX_QUEUE_MS)
    ) {
      const dropped = this.items.shift()!;
      skipped += dropped.skipped > 0 ? dropped.skipped : 1;
    }

    if (skipped > 0) {
      this.items.unshift({ text: skippedNotice(skipped), skipped });
    }
  }

  private estimatedTotalMs(): number {
    let total = 0;
    for (const item of this.items) {
      total += this.pacing.estimateMs(item.text);
    }
    return total;
  }

  /**
   * Plant die nächste Freigabe auf den Zeitpunkt, an dem die laufende Ansage
   * voraussichtlich endet. Ein bereits laufender Timer wird nicht verschoben.
   */
  private scheduleNext(): void {
    if (this.timer !== undefined || this.items.length === 0) {
      return;
    }
    this.timer = window.setTimeout(() => {
      this.timer = undefined;
      this.releaseNext();
    }, this.pacing.remainingMs());
  }

  private releaseNext(): void {
    const item = this.items.shift();
    if (!item) {
      return;
    }
    this.emit(item.text);
    this.scheduleNext();
  }
}
