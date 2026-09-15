import { AnnounceQueue, SpeechPacing } from './mud-announce-queue';

const INPUT_CLEAR_DELAY_MS = 700;
const ANSI_ESCAPE_PATTERN = /\x1B\[[0-9;?]*[ -\/]*[@-~]/g;
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B-\x1F\x7F]/g;
/**
 * Upper bound on the number of <p> line nodes kept in the history region.
 * The region is appended to on every output chunk and is a fully laid-out
 * (transparent, position:absolute, full-size) element, so an unbounded node
 * count made the whole app stall once the output reached ~100 pages
 * (thousands of nodes re-flowed on every style/layout pass). When the cap is
 * exceeded the oldest lines are dropped — recent history is what AT users
 * navigate, and the bound matches the spirit of a finite scrollback.
 */
const MAX_HISTORY_ITEMS = 2000;
/**
 * Upper bound on the number of text nodes kept in the live (announce) region.
 * Like the history region this grows by one node per output chunk and is
 * never cleared mid-session (clearing breaks NVDA/JAWS — see
 * {@link MudScreenReaderAnnouncer.appendToLiveRegion}). Unlike the history
 * region it is only a short read-ahead buffer for the screen reader, not a
 * navigable transcript, so a much smaller bound suffices. Trimming the OLDEST
 * nodes is safe: with `aria-relevant="additions text"` removals are not
 * announced, and nodes this far back were spoken long ago.
 */
const MAX_LIVE_ITEMS = 500;
/**
 * "Quiet output" caps and coalescing window for the 'quiet' verbosity level.
 * iOS VoiceOver chokes on the default high mutation rate + large DOM, so we
 * drop the caps hard and coalesce announcements into one node per window
 * instead of one per chunk/line. See `OutputVerbosityService` and
 * {@link VERBOSITY_CONFIG}.
 */
const QUIET_MAX_HISTORY_ITEMS = 200;
const QUIET_COALESCE_MS = 200;

/**
 * Untergrenzen, die im Modus „Ausreden lassen" über die gewählte Stufe
 * gelegt werden (siehe {@link MudScreenReaderAnnouncer.cfg}).
 *
 * 'chatty' hat kein Bündelungsfenster — jeder Chunk würde ein eigener
 * Warteschlangen-Eintrag. Ein Mindestfenster (identisch zu 'normal') hält die
 * Warteschlange kurz und senkt zugleich die Mutationsrate.
 */
const PACED_MIN_COALESCE_MS = 120;

/**
 * Untergrenze der Live-Region-Knoten im Modus „Ausreden lassen". Getrimmt
 * werden darf erst, wenn nichts mehr wartet — und selbst dann soll der Puffer
 * nicht so knapp sein, dass gerade Gesprochenes verschwindet.
 */
const PACED_MIN_LIVE_CAP = 200;

/**
 * Vorlese-Ausführlichkeit der Live-/Verlauf-Region. Vom Nutzer wählbar
 * (Footer-Menü „Vorlese-Ausführlichkeit"), weil verschiedene Screenreader
 * gegensätzliche Bedürfnisse haben — Windows-JAWS will zuverlässig anhängen,
 * iOS-VoiceOver bricht bei vielen Mutationen ein. Siehe `OutputVerbosityService`.
 *
 *  - 'chatty' (Gesprächig): jeder Chunk sofort angehängt — bisheriges,
 *    erprobtes NVDA/JAWS-Verhalten. Default.
 *  - 'normal': angehängt, aber über ein kurzes Fenster gebündelt — deutlich
 *    weniger Mutationen, behält aber die Additions-Semantik (gut für JAWS).
 *  - 'quiet' (Ruhig): ersetzt + bündelt — die Region hält genau einen Knoten,
 *    der genau einmal vorgelesen wird (für iOS VoiceOver).
 */
export type OutputVerbosity = 'chatty' | 'normal' | 'quiet';

interface VerbosityConfig {
  /** Bündelungsfenster in ms; `null` = sofort anhängen (kein Sammeln). */
  readonly coalesceMs: number | null;
  /** `true` = Live-Region ersetzen (ein Knoten); `false` = anhängen. */
  readonly replace: boolean;
  /** Obergrenze der Knoten in der Verlauf-Region. */
  readonly historyCap: number;
  /** Obergrenze der Knoten in der Live-Region (nur im Append-Pfad relevant). */
  readonly liveCap: number;
  /**
   * `true` = Verlauf-Einträge über das `coalesceMs`-Fenster sammeln und in EINER
   * DOM-Mutation einfügen statt pro Chunk/Zeile. Reduziert, wie oft VoiceOver
   * den Verlauf-Container neu scannt (jede Mutation löst einen Re-Scan aus).
   * Nur für 'quiet' aktiv.
   */
  readonly coalesceHistory: boolean;
}

const VERBOSITY_CONFIG: Record<OutputVerbosity, VerbosityConfig> = {
  chatty: {
    coalesceMs: null,
    replace: false,
    historyCap: MAX_HISTORY_ITEMS,
    liveCap: MAX_LIVE_ITEMS,
    coalesceHistory: false,
  },
  normal: {
    coalesceMs: 120,
    replace: false,
    historyCap: 1200,
    liveCap: MAX_LIVE_ITEMS,
    coalesceHistory: false,
  },
  quiet: {
    coalesceMs: QUIET_COALESCE_MS,
    replace: true,
    historyCap: QUIET_MAX_HISTORY_ITEMS,
    liveCap: 1,
    coalesceHistory: true,
  },
};

/**
 * Minimal screenreader announcer tailored for xterm output.
 *
 * Responsibilities:
 * - Announce only new chunks (based on session start timestamp)
 * - Normalize data by stripping control / ANSI sequences
 * - Clear the live region shortly after announcing to avoid re-reading history
 * - Announce typed input word-by-word (on whitespace) and as a full line on commit
 */
export class MudScreenReaderAnnouncer {
  private inputClearTimer: number | undefined;
  private sessionStartedAt: number;
  private lastAnnouncedBuffer = '';
  // Quiet-mode coalescing buffer for the live region (see appendToLiveRegion).
  private liveCoalesceBuffer = '';
  private liveCoalesceTimer: number | undefined;
  // Quiet-mode coalescing buffer for the history region (see appendToHistory):
  // one entry per chunk, flushed in a single DOM mutation per window.
  private historyCoalesceChunks: string[] = [];
  private historyCoalesceTimer: number | undefined;
  /**
   * Ansage-Warteschlange für „Ausreden lassen". Existiert nur, wenn ein
   * `pacing` übergeben wurde; sonst bleibt der Schreibpfad exakt der alte.
   */
  private readonly queue: AnnounceQueue | undefined;

  constructor(
    private readonly liveRegion: HTMLElement,
    private readonly historyRegion?: HTMLElement,
    private readonly isLoggingEnabled: () => boolean = () => false,
    private readonly inputRegion?: HTMLElement,
    // Liefert die gewählte Vorlese-Ausführlichkeit (siehe OutputVerbosity).
    // Steuert Bündelung, Append-vs-Replace und die DOM-Obergrenzen. Default
    // 'chatty' = bisheriges, erprobtes NVDA/JAWS-Verhalten (z. B. Classic-Shell,
    // die diesen Parameter nicht übergibt).
    private readonly verbosity: () => OutputVerbosity = () => 'chatty',
    // Gemeinsame Sprech-Uhr für „Ausreden lassen" (SpeechPacingService).
    // FEHLT er (Classic-Shell), gibt es keine Warteschlange und der gesamte
    // Code-Pfad verhält sich unverändert — das ist die Regressions-Absicherung.
    private readonly pacing?: SpeechPacing,
  ) {
    this.sessionStartedAt = Date.now();
    if (pacing) {
      // Die Obergrenze wird beim Schreiben frisch gelesen, damit ein
      // Stufenwechsel im Menü sofort greift.
      this.queue = new AnnounceQueue(
        (text) => this.appendLiveItem(text, this.cfg().liveCap),
        pacing,
      );
    }
  }

  /**
   * Effektive Konfiguration: die gewählte Stufe, im Modus „Ausreden lassen"
   * jedoch dort überschrieben, wo die Stufe mit einer Warteschlange
   * unvereinbar ist.
   *
   * Der Modus ist bewusst ORTHOGONAL zu den Stufen (ein iOS-Nutzer kann
   * „Ruhig" und „Ausreden lassen" zugleich brauchen), deshalb keine vierte
   * Stufe, sondern diese Überlagerung. Praktische Folge: „Ruhig" +
   * Ausreden verhält sich effektiv wie „Normal" + Ausreden.
   */
  private cfg(): VerbosityConfig {
    const base = VERBOSITY_CONFIG[this.verbosity()];
    if (!this.pacing?.isEnabled()) {
      return base;
    }
    return {
      ...base,
      // Ersetzen verwirft genau die Restausgabe, die wir schützen wollen.
      replace: false,
      coalesceMs: base.coalesceMs ?? PACED_MIN_COALESCE_MS,
      liveCap: Math.max(base.liveCap, PACED_MIN_LIVE_CAP),
    };
  }

  /** Internal: emits debug logs only when the runtime flag is enabled. */
  private log(...args: unknown[]): void {
    if (this.isLoggingEnabled()) {
      console.debug(...args);
    }
  }

  /**
   * Marks the current connection session start and clears any pending output.
   */
  public markSessionStart(timestamp: number = Date.now()): void {
    this.sessionStartedAt = timestamp;
    this.stopAnnouncements();
    this.clearHistory();
    this.lastAnnouncedBuffer = '';
  }

  /**
   * Announces sanitized output to the aria-live region when it is newer than the current session.
   */
  public announce(raw: string, receivedAt: number = Date.now()): void {
    if (receivedAt < this.sessionStartedAt) {
      this.log(
        '[ScreenReader] Ignoring old output (before session start):',
        {
          receivedAt,
          sessionStartedAt: this.sessionStartedAt,
          diff: receivedAt - this.sessionStartedAt,
        },
      );
      return;
    }

    const normalized = this.normalize(raw);

    this.log('[ScreenReader] Announcing:', {
      raw: raw.substring(0, 100),
      normalized: normalized.substring(0, 100),
    });

    if (!normalized) {
      this.log('[ScreenReader] Skipped empty normalized output');
      return;
    }

    this.appendToLiveRegion(normalized);
  }

  /**
   * Clears the live region and any pending timers.
   */
  public clear(): void {
    this.cancelLiveCoalesce();
    // Bewusster Abbruch: Wartendes verwerfen und die Sprech-Uhr freigeben,
    // sonst spricht nach „Sprung zum Ende" noch ein Nachzügler.
    this.queue?.reset();
    this.liveRegion.textContent = '';
  }

  /**
   * Meldet eine Ansage an die gemeinsame Sprech-Uhr, die NICHT über diese
   * Klasse lief — etwa der assertive Start-Block oder die Modus-Ansage der
   * Eingabe-Komponente. Ohne diese Meldung würde die Warteschlange sofort
   * darübersprechen.
   *
   * No-Op ohne Pacing oder bei ausgeschaltetem „Ausreden lassen".
   */
  public reserveSpeech(text: string): void {
    if (!this.pacing || !text) {
      return;
    }
    this.pacing.reserve(this.pacing.estimateMs(text));
  }

  /**
   * Stops any in-flight announcements and drops the queued backlog.
   */
  public stopAnnouncements(): void {
    this.clear();
  }

  /**
   * Disposes internal timers.
   */
  public dispose(): void {
    this.stopAnnouncements();
    this.cancelInputClearTimer();
    this.cancelHistoryCoalesce();
  }

  /**
   * Appends sanitized text to the history region so users can navigate it later.
   * Splits text by newlines to create separate entries for each line, allowing
   * screen readers to navigate line-by-line.
   *
   * In 'quiet' mode the lines are COALESCED: buffered per chunk and inserted in
   * a single DOM mutation per window (see flushHistoryCoalesce). Every mutation
   * of this container makes VoiceOver re-scan it, so batching cuts the re-scan
   * frequency that otherwise stalled the main thread. Other modes insert
   * immediately (the region is `aria-live="off"`, so this never announces).
   */
  public appendToHistory(raw: string): void {
    if (!this.historyRegion) {
      return;
    }

    const normalized = this.normalize(raw);
    if (!normalized) {
      return;
    }

    const cfg = this.cfg();
    if (cfg.coalesceHistory && cfg.coalesceMs !== null) {
      this.historyCoalesceChunks.push(normalized);
      if (this.historyCoalesceTimer === undefined) {
        this.historyCoalesceTimer = window.setTimeout(
          () => this.flushHistoryCoalesce(),
          cfg.coalesceMs,
        );
      }
      return;
    }

    this.appendHistoryLines([normalized]);
  }

  /**
   * Inserts one `<p>` per non-empty line of the given chunks in a SINGLE DOM
   * mutation (DocumentFragment), then trims to the cap.
   */
  private appendHistoryLines(chunks: string[]): void {
    if (!this.historyRegion) {
      return;
    }
    const doc = this.historyRegion.ownerDocument;
    const frag = doc.createDocumentFragment();
    for (const chunk of chunks) {
      for (const line of chunk.split('\n')) {
        if (!line.trim()) {
          continue;
        }
        const item = doc.createElement('p');
        item.className = 'sr-log-item';
        item.textContent = line;
        item.setAttribute('role', 'text');
        frag.appendChild(item);
      }
    }
    this.historyRegion.appendChild(frag);
    this.trimHistory();
  }

  /** Flushes the coalesced quiet-mode history buffer in one DOM mutation. */
  private flushHistoryCoalesce(): void {
    this.historyCoalesceTimer = undefined;
    const chunks = this.historyCoalesceChunks;
    this.historyCoalesceChunks = [];
    if (chunks.length > 0) {
      this.appendHistoryLines(chunks);
    }
  }

  /** Cancels a pending history flush and drops its buffered chunks. */
  private cancelHistoryCoalesce(): void {
    if (this.historyCoalesceTimer !== undefined) {
      window.clearTimeout(this.historyCoalesceTimer);
      this.historyCoalesceTimer = undefined;
    }
    this.historyCoalesceChunks = [];
  }

  /**
   * Drops the oldest line nodes once the history region exceeds
   * {@link MAX_HISTORY_ITEMS}, keeping the DOM (and its layout cost) bounded
   * no matter how much output a session produces.
   */
  private trimHistory(): void {
    if (!this.historyRegion) {
      return;
    }
    const cap = this.cfg().historyCap;
    while (this.historyRegion.childElementCount > cap) {
      this.historyRegion.removeChild(this.historyRegion.firstElementChild!);
    }
  }

  /**
   * Clears the history region entirely (e.g., on reconnect). Also drops any
   * pending coalesced lines so a stale flush can't re-add the old session's
   * output after the clear.
   */
  public clearHistory(): void {
    this.cancelHistoryCoalesce();
    if (this.historyRegion) {
      this.historyRegion.textContent = '';
    }
  }

  /**
   * Announces input changes with three levels:
   * (a) Per-character: textarea is read automatically by SR; no manual announcement
   * (b) Per-word: when whitespace is encountered, announce the complete word
   * (c) On commit: full line is announced via announceInputCommitted()
   *
   * Note: Per-character feedback is handled by the helper textarea being read
   * by the screen reader automatically, so we skip manual textContent updates
   * for individual chars to avoid double announcements.
   */
  public announceInput(buffer: string): void {
    if (!this.inputRegion) {
      return;
    }

    const lastLength = this.lastAnnouncedBuffer.length;
    const currentLength = buffer.length;

    if (currentLength > lastLength) {
      const newestChar = buffer[currentLength - 1];

      this.log('[ScreenReader] Input changed:', {
        newestChar,
        lastLength,
        currentLength,
      });

      // (b) Check if we just completed a word (whitespace as delimiter)
      if (/\s/.test(newestChar)) {
        const lastWord = this.extractLastWord(buffer);
        const normalizedWord = lastWord ? this.normalizeInput(lastWord) : '';

        this.log('[ScreenReader] Word boundary detected:', {
          lastWord,
          normalizedWord,
        });

        // Announce the word (or fallback to the whitespace token if empty)
        this.inputRegion.textContent =
          normalizedWord || this.describeChar(newestChar);
      }
    } else if (currentLength < lastLength) {
      // Backspace/delete: silently track, textarea is read by SR automatically
      this.log('[ScreenReader] Buffer shortened (backspace/delete):', {
        lastLength,
        currentLength,
      });
    }

    this.lastAnnouncedBuffer = buffer;
  }

  /**
   * Extracts the last word from the buffer (text before the last whitespace).
   * Used for per-word announcements when user types a space.
   */
  private extractLastWord(buffer: string): string {
    if (!buffer) return '';

    // Find the last whitespace (remove trailing whitespace)
    const trimmedFromRight = buffer.replace(/\s+$/, '');
    if (trimmedFromRight === buffer) {
      // No trailing whitespace, return empty
      return '';
    }

    // Find position of last word (before trailing whitespace)
    let lastNonWhitespace = -1;
    for (let i = trimmedFromRight.length - 1; i >= 0; i--) {
      if (/\S/.test(trimmedFromRight[i])) {
        lastNonWhitespace = i;
        break;
      }
    }

    if (lastNonWhitespace === -1) {
      return '';
    }

    // Find the start of the last word (after previous whitespace)
    let wordStart = 0;
    for (let i = lastNonWhitespace; i >= 0; i--) {
      if (/\s/.test(trimmedFromRight[i])) {
        wordStart = i + 1;
        break;
      }
    }

    return trimmedFromRight.slice(wordStart, lastNonWhitespace + 1);
  }

  /**
   * Maps characters to speakable tokens for screen readers.
   */
  private describeChar(char: string): string {
    if (char === ' ') {
      return 'Leerzeichen';
    }

    if (char === '\n') {
      return 'Zeilenumbruch';
    }

    if (char === '\t') {
      return 'Tab';
    }

    const normalized = this.normalizeInput(char);
    return normalized || '';
  }

  /**
   * (c) Announces the committed input after user presses Enter.
   *
   * Reads back ONLY the last word of the line — the one that sits after
   * the final whitespace. All earlier words have already been spoken by
   * `announceInput` when the user typed their trailing whitespace, so
   * re-reading the whole line on Enter would echo everything twice. The
   * last word never gets a per-word boundary trigger, so this is the only
   * chance to surface it before the server response arrives.
   *
   * For single-word commands (no whitespace), the "last word" equals the
   * whole input, so the command is still confirmed in full.
   */
  public announceInputCommitted(buffer: string): void {
    if (!this.inputRegion) {
      return;
    }

    const tailWord = this.extractTailWord(buffer);
    const normalized = tailWord ? this.normalize(tailWord) : '';

    this.log('[ScreenReader] Announcing committed input (tail word):', {
      raw: buffer.substring(0, 100),
      tail: normalized.substring(0, 100),
    });

    if (!normalized) {
      this.lastAnnouncedBuffer = '';
      return;
    }

    this.inputRegion.textContent = normalized;

    // Auto-clear after delay so user gets confirmation but next input starts fresh
    this.scheduleInputClear();

    // Reset buffer tracker since we're starting fresh after commit
    this.lastAnnouncedBuffer = '';
  }

  /**
   * Returns the substring after the last whitespace in `buffer`. If the
   * buffer has no whitespace, returns the whole buffer. Trailing whitespace
   * is treated as "no tail word" (the previous word was already announced
   * when the whitespace was typed).
   */
  private extractTailWord(buffer: string): string {
    if (!buffer) return '';
    // Trailing whitespace → no unsaid word; announceInput already covered it.
    if (/\s$/.test(buffer)) return '';
    const match = /\S+$/.exec(buffer);
    return match ? match[0] : '';
  }

  /**
   * Appends sanitized text to the live region. Does NOT auto-clear the region
   * afterwards — clearing within ~2s breaks NVDA/JAWS on Windows (the screen
   * reader picks up the change but the content is gone before it reads it,
   * resulting in silence). The region is drained on `markSessionStart` /
   * `stopAnnouncements` instead; growing content within a session is fine
   * because each block is appended as its own element node (see
   * {@link appendLiveItem}) and the region is marked `aria-relevant="additions"`,
   * so the screen reader speaks only the newly added block, not the history.
   */
  private appendToLiveRegion(normalized: string): void {
    const cfg = this.cfg();

    if (cfg.coalesceMs === null) {
      // 'chatty' (NVDA/JAWS): sofort anhängen, ein Knoten pro Chunk.
      this.emitLive(`${normalized}\n`, cfg.liveCap);
      return;
    }

    // 'normal'/'quiet': schnelle Ausgabe über ein Fenster sammeln, dann in
    // einem Rutsch anhängen ('normal') bzw. ersetzen ('quiet'). So bekommt der
    // Screenreader eine Mutation pro Fenster statt eine pro Chunk/Zeile.
    this.liveCoalesceBuffer += `${normalized}\n`;
    if (this.liveCoalesceTimer === undefined) {
      this.liveCoalesceTimer = window.setTimeout(
        () => this.flushLiveCoalesce(),
        cfg.coalesceMs,
      );
    }
  }

  /**
   * Leert den gesammelten Bündel-Puffer der Live-Region:
   *
   *  - 'quiet': ERSETZT die Region durch den Block (ein Textknoten). iOS
   *    VoiceOver liest eine Live-Region neu, sobald deren Knoten MUTIERT
   *    werden — Trimmen ließ VoiceOver Inhalt erneut vorlesen (das vom Tester
   *    gehörte „Wiederholen"). Ein sauberes Ersetzen sagt den Block genau
   *    einmal an und ist das kanonische VoiceOver-Live-Region-Muster.
   *  - 'normal': HÄNGT den gebündelten Block als EINEN neuen Knoten an. Damit
   *    bleibt die Additions-Semantik erhalten (gut für JAWS), aber es gibt
   *    eine Mutation pro Fenster statt pro Chunk.
   */
  private flushLiveCoalesce(): void {
    this.liveCoalesceTimer = undefined;
    const text = this.liveCoalesceBuffer;
    this.liveCoalesceBuffer = '';
    if (!text) {
      return;
    }
    const cfg = this.cfg();
    if (cfg.replace) {
      this.liveRegion.textContent = text;
      return;
    }
    this.emitLive(text, cfg.liveCap);
  }

  /**
   * Übergibt einen fertigen Block an die Warteschlange — oder schreibt ihn
   * direkt, wenn es keine gibt (Classic-Shell).
   *
   * Ist „Ausreden lassen" aus, reicht die Warteschlange synchron durch; der
   * Schreibzeitpunkt ist dann identisch zum bisherigen Verhalten.
   */
  private emitLive(text: string, cap: number): void {
    if (this.queue) {
      this.queue.push(text);
      return;
    }
    this.appendLiveItem(text, cap);
  }

  /**
   * Hängt einen Ausgabe-Block als EIGENES Element-Kind (`<div>`) an die
   * Live-Region an — nicht als nackten Textknoten.
   *
   * Warum ein Element statt `createTextNode`: Windows-JAWS braucht je Ansage
   * einen diskreten hinzugefügten KNOTEN, um nur diesen vorzulesen. Hängt man
   * bloß einen Textknoten an, sieht JAWS nur „der Gesamttext der Region hat
   * sich geändert" und liest die GANZE Region erneut vor (der vom Tester
   * gemeldete Effekt: bei jeder Meldung wird alles wiederholt). Ein Element je
   * Block — zusammen mit `aria-relevant="additions"` an der Region — macht die
   * Ansage zu einer sauberen Einzel-Addition. (Die Verlauf-Region verfährt mit
   * ihren `<p>` schon so.)
   */
  private appendLiveItem(text: string, cap: number): void {
    const doc = this.liveRegion.ownerDocument;
    const item = doc.createElement('div');
    item.className = 'sr-live-item';
    item.textContent = text;
    this.liveRegion.appendChild(item);
    this.trimLiveRegion(cap);
  }

  /** Cancels a pending coalesce flush and drops its buffered text. */
  private cancelLiveCoalesce(): void {
    if (this.liveCoalesceTimer !== undefined) {
      window.clearTimeout(this.liveCoalesceTimer);
      this.liveCoalesceTimer = undefined;
    }
    this.liveCoalesceBuffer = '';
  }

  /**
   * Drops the oldest text nodes once the live region exceeds `cap`. Only used
   * by the append paths ('chatty'/'normal') — 'quiet' replaces the region
   * instead (see flushLiveCoalesce). Only nodes far behind the read head are
   * removed, so the screen reader never loses text it is about to speak.
   */
  private trimLiveRegion(cap: number): void {
    // „Ausreden lassen": Solange noch etwas wartet, darf KEIN Knoten
    // entfernt werden — jede Entfernung lässt VoiceOver die Region neu
    // scannen und schneidet dabei die laufende Ansage ab.
    if (this.queue?.isPending()) {
      return;
    }
    while (this.liveRegion.childNodes.length > cap) {
      this.liveRegion.removeChild(this.liveRegion.firstChild!);
    }
  }

  public normalizeForComparison(raw: string): string {
    return this.normalize(raw);
  }

  private scheduleInputClear(): void {
    this.cancelInputClearTimer();
    this.inputClearTimer = window.setTimeout(() => {
      this.clearInputRegion();
    }, INPUT_CLEAR_DELAY_MS);
  }

  private cancelInputClearTimer(): void {
    if (this.inputClearTimer !== undefined) {
      window.clearTimeout(this.inputClearTimer);
      this.inputClearTimer = undefined;
    }
  }

  private clearInputRegion(): void {
    if (this.inputRegion) {
      this.inputRegion.textContent = '';
    }
  }

  private normalizeInput(raw: string): string {
    if (raw === undefined || raw === null) {
      return '';
    }

    // Do not trim for input to preserve spaces; still strip ANSI/control chars.
    const unifiedNewlines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const withoutAnsi = unifiedNewlines.replace(ANSI_ESCAPE_PATTERN, '');
    const withoutControl = withoutAnsi.replace(CONTROL_CHAR_PATTERN, '');
    return withoutControl;
  }

  private normalize(raw: string): string {
    if (!raw) {
      return '';
    }

    // Convert CRLF/CR to LF to keep announcements concise
    const unifiedNewlines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Strip ANSI escapes and non-printable control chars (except LF)
    const withoutAnsi = unifiedNewlines.replace(ANSI_ESCAPE_PATTERN, '');
    const withoutControl = withoutAnsi.replace(CONTROL_CHAR_PATTERN, '');

    // Collapse excessive blank lines and trim
    const collapsed = withoutControl.replace(/\n{3,}/g, '\n\n');

    return collapsed.trim();
  }
}
