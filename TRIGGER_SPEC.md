# TRIGGER_SPEC.md — Spezifikation: Output-Trigger (Highlight & Sound)

> **Status:** Implementiert (Phasen T1–T6 abgeschlossen). Diese Spec spiegelt den aktuellen Code-Stand wider; Abweichungen vom ursprünglichen Entwurf sind im Text markiert.

## 1. Ziel

Einführung eines **Trigger-Systems** im Frontend von `u3_migrate`. Trigger erkennen mittels **Regular Expressions** Muster im eingehenden MUD-Output und lösen daraufhin eine von zwei Aktionen aus:

1. **Highlight** — der gematchte Text wird farblich hervorgehoben (Vorder- und/oder Hintergrundfarbe, optional fett).
2. **Sound** — ein zugeordnetes Audio-File wird abgespielt.

Es gibt zwei Sound-Quellen:

- **Allgemeine Sounds**: vom Projekt mitgelieferte Audio-Assets (in `frontend/src/assets/sounds/`).
- **Persönliche Sounds**: vom Benutzer importierte Audio-Dateien, im **Local Storage** des Browsers persistiert (als Base64-DataURL).

---

## 2. Begriffe

| Begriff | Bedeutung |
|---|---|
| Trigger | Regelobjekt: `{ pattern, flags, action, ... }` |
| Match | Treffer einer RegEx im aktuellen Output-Stream |
| Built-in Sound | Mitgeliefertes Audio in `assets/sounds/` |
| Personal Sound | Benutzer-Audio im Local Storage |
| Highlight | Einfärbung des gematchten Substrings im Terminal |

---

## 3. Datenmodell

### 3.1 Trigger

```ts
// frontend/src/app/features/triggers/models/trigger.ts
export type TriggerAction =
  | { kind: 'highlight'; foreground?: string; background?: string; bold?: boolean }
  | { kind: 'sound'; soundId: string; volume?: number /* 0..1 */ };

export interface Trigger {
  id: string;              // UUID
  name: string;            // sprechender Name für die UI
  pattern: string;         // RegEx-Quelltext (ohne Slashes)
  flags: string;           // z.B. "i", "gi"
  action: TriggerAction;
  enabled: boolean;
  createdAt: number;       // epoch ms
  updatedAt: number;
}
```

### 3.2 Sound

```ts
// frontend/src/app/features/triggers/models/sound.ts
export interface BuiltinSound {
  kind: 'builtin';
  id: string;              // z.B. "alert", "bell", "ding"
  label: string;           // Anzeigename
  url: string;             // ausgelöster Pfad, z.B. "assets/sounds/alert.wav"
}

export interface PersonalSound {
  kind: 'personal';
  id: string;              // UUID
  label: string;           // vom Benutzer vergeben
  mimeType: string;        // "audio/ogg", "audio/mpeg", "audio/wav"
  dataUrl: string;         // "data:audio/wav;base64,..."
  sizeBytes: number;
  createdAt: number;
}

export type Sound = BuiltinSound | PersonalSound;
```

`soundId` in `TriggerAction` referenziert entweder eine Built-in-ID (`"builtin:alert"`) oder eine Personal-ID (`"personal:<uuid>"`). Das Präfix dient als Discriminator und vermeidet Kollisionen. Helfer `builtinSoundId()` / `personalSoundId()` / `parseSoundId()` bauen die IDs auf und zerlegen sie wieder.

---

## 4. Persistenz (Local Storage)

Drei Local-Storage-Schlüssel-**Suffixe**, alle JSON-serialisiert. Der projektweite [`namespacedStorage`](u3_migrate/frontend/src/app/shared/utils/storage-namespace.ts) hängt vor jedem Suffix `<host>:<base-href>:` an, damit `Webmud3` und `webmud3test` getrennte Daten haben:

| Suffix | Inhalt |
|---|---|
| `wm3cc.triggers.v1` | `Trigger[]` |
| `wm3cc.sounds.personal.v1` | `PersonalSound[]` |
| `wm3cc.triggers.settings.v1` | `{ globallyEnabled: boolean; masterVolume: number }` |

### 4.1 Größenbeschränkung

- Local Storage ist je Origin meist auf **5–10 MB** begrenzt.
- **Limit pro persönlichem Sound**: 512 KB (konfigurierbar als Konstante).
- **Gesamt-Limit für persönliche Sounds**: 4 MB.
- Beim Import wird die Größe geprüft, bei Überschreitung wird ein klarer Fehler in der UI angezeigt.
- Auf Wunsch in einer späteren Phase Migration nach **IndexedDB** (siehe Abschnitt 11).

### 4.2 Versionierung

Suffix `.v1` im Key. Bei späteren Schema-Änderungen liest ein Migrations-Step `vN-1` → `vN` und schreibt unter neuem Key.

---

## 5. Architektur

### 5.1 Neue Module/Services

```
frontend/src/app/features/triggers/
├── models/
│   ├── trigger.ts                # Trigger / TriggerAction / TriggerDraft, compileTrigger()
│   ├── sound.ts                  # Built-in / Personal Sound, ID-Helper
│   └── highlight.ts              # HighlightSegment / SoundPlay / TriggerResult
├── ansi-injector.ts              # stripAnsi(), injectHighlights(), dropOverlaps()
├── trigger.service.ts            # Verwaltung der Trigger-Liste (CRUD + Persistenz)
├── trigger-engine.service.ts     # Matching gegen Output-Stream (Watchdog, Compile-Cache)
├── sound-library.service.ts      # Built-in + Personal Sounds
├── sound-player.service.ts       # HTMLAudioElement-basierter Player (siehe §7)
├── trigger-config.component.{ts,html,scss}     # UI: Trigger-Liste & Editor
├── trigger-config-window.service.ts            # Window-Toggle + Footer-Menü-Eintrag
├── sound-library.component.{ts,html,scss}      # UI: Sound-Verwaltung
├── sound-library-window.service.ts             # Window-Toggle + Footer-Menü-Eintrag
└── index.ts                                    # Barrel-Export
```

Die beiden `*-window.service.ts` registrieren je einen Footer-Menü-Eintrag ("Trigger…", "Sounds…") und werden in [`mud-client.component.ts`](u3_migrate/frontend/src/app/core/mud/components/mud-client/mud-client.component.ts) einmal injiziert, damit die Registrierung beim App-Start passiert.

Die Window-Container-Komponenten sind in [`window-component-registry.ts`](u3_migrate/frontend/src/app/features/windows/window-component-registry.ts) unter den IDs `'trigger-config'` und `'sound-library'` eingetragen.

### 5.2 Built-in Sounds (Assets)

```
frontend/src/assets/sounds/
├── alert.wav       # 880 Hz, 0.22 s   (~10 KB)
├── bell.wav        # 660 Hz, 0.55 s   (~24 KB)
├── ding.wav        # 1320 Hz, 0.18 s  (~8 KB)
├── notify.wav      # 523 Hz, 0.30 s   (~13 KB)
└── manifest.json   # Liste aller Built-in-Sounds
```

> **Abweichung vom Ursprungsentwurf:** Es sind **`.wav`**-Beeps statt `.ogg` (programmatisch via Node generiert, damit das Feature ohne externe Audio-Assets sofort testbar ist). `.ogg`-Dateien können später als Drop-in-Ersatz hinterlegt werden — der Service unterstützt beide.

Manifest-Format (`version: 1`):

```json
{
  "version": 1,
  "sounds": [
    { "id": "alert",  "label": "Alert",  "file": "alert.wav" },
    { "id": "bell",   "label": "Bell",   "file": "bell.wav" },
    { "id": "ding",   "label": "Ding",   "file": "ding.wav" },
    { "id": "notify", "label": "Notify", "file": "notify.wav" }
  ]
}
```

`manifest.json` wird einmalig beim App-Start vom `SoundLibraryService` über `HttpClient` geladen. Der Service composed `assets/sounds/` + `file` zur fertigen URL und exposed das Promise über `whenReady()`.

### 5.3 Integration in den Output-Stream

Konkreter Hook: [`mud-client.component.ts → transformMudOutput()`](u3_migrate/frontend/src/app/core/mud/components/mud-client/mud-client.component.ts). Dort läuft jedes `text`-Segment des MXP-Filters durch die Engine, bevor es in xterm geschrieben wird:

```ts
private transformMudOutput(data: string): string {
  const cleaned = this.promptManager.transformOutput(data);
  const segments = this.mxpFilter.processToSegments(cleaned);

  for (const seg of segments) {
    if (seg.type === 'text') {
      const result = this.triggerEngine.processChunk(seg.content);
      this.terminal.write(result.text);
      for (const s of result.sounds) {
        this.triggerSoundPlayer.play(s.soundId, s.volume);
      }
    } else {
      this.writeClickableSegment(seg);
    }
  }
  return '';
}
```

Clickable-Segmente werden bewusst **nicht** durch die Engine geschickt, damit der OSC-8-Wrapper unverändert bleibt.

**Schnittstelle der Engine**:

```ts
// Aufruf pro Chunk (ein MXP-Text-Segment, ggf. mehrere Zeilen)
triggerEngine.processChunk(text: string): TriggerResult;

interface TriggerResult {
  /** Der Originaltext mit ANSI-Highlight-Sequenzen an den Match-Positionen. */
  text: string;
  /** Sounds, die der Aufrufer parallel abspielen soll. */
  sounds: Array<{ soundId: string; volume?: number }>;
}
```

Die Highlight-Segmente werden direkt in der Engine in ANSI-Bytes umgewandelt — das Terminal bekommt einen fertigen String und muss nichts mehr wissen.

### 5.4 Rendering der Highlights

**Umgesetzt:** ANSI-Injection. Vor dem Schreiben an xterm.js wird der Match mit ANSI-Escape-Sequenzen umschlossen (`\x1b[1;38;2;<r>;<g>;<b>;48;2;<r>;<g>;<b>m…\x1b[0m`). Funktioniert nativ mit dem bestehenden xterm.js-Setup, ohne neue Decorations-API.

Implementiert in [`ansi-injector.ts`](u3_migrate/frontend/src/app/features/triggers/ansi-injector.ts):

- `stripAnsi(text)` entfernt CSI-Sequenzen, sodass die Engine gegen den sichtbaren Text matched.
- `injectHighlights(text, segments)` läuft das Originaltext byte für byte ab, lässt ANSI-Codes passieren und setzt SGR-Open/Close-Codes an den passenden **sichtbaren** Positionen. ANSI-Codes vom Server werden dabei **vor** der Highlight-Eröffnung emittiert, sodass der server-seitige Color-Kontext nicht vom Highlight-Wrapper unterbrochen wird.
- `dropOverlaps(segments)` resolviert Überschneidungen — der zuerst definierte Trigger gewinnt.

**Bekannte Einschränkung:** Nach `\x1b[0m` (Highlight-Ende) sind vorherige Server-SGR-Codes verloren. Eine spätere Version könnte den SGR-State tracken und restaurieren — siehe §11.

xterm.js Decorations API als sauberere Alternative steht in §11.

---

## 6. Matching-Verhalten

- Trigger werden in der Reihenfolge ihrer Definition geprüft. Mehrere Trigger können denselben Chunk matchen.
- **Pro Chunk** ein Pass je Trigger — keine Rekursion auf bereits modifiziertem Text.
- Bei überlappenden Highlight-Bereichen gewinnt der **zuerst definierte** Trigger; spätere Matches im selben Bereich werden verworfen (vermeidet kaputte ANSI-Sequenzen).
- Reihenfolge ist über die UI änderbar (↑/↓-Buttons; `TriggerService.reorder()` persistiert).
- Pattern wird beim Speichern validiert (`compileTrigger()`); ein Syntaxfehler wirft, der Service speichert nichts. In der Engine wird beim Laden ein invalides Pattern geloggt und der Trigger übersprungen.
- `g`-Flag wird beim Kompilieren immer gesetzt (Engine iteriert mit `regex.exec`). `y` (sticky) wird abgelehnt, weil es den Iterator bricht. Erlaubte Flags: `i m s u`.
- **Sicherheits-Limit**: max. 32 Matches je Trigger pro Chunk, max. 200 ms Gesamt-Matchzeit pro Chunk (Watchdog), um ReDoS-Pattern zu entschärfen. Zero-Width-Matches (z. B. `a?`) werden durch manuelles Vorrücken von `lastIndex` entschärft.
- **Bekannte Einschränkung:** Ein Match, der über zwei aufeinanderfolgende Server-Chunks geht, wird nicht erkannt. In der Praxis sendet UNItopia Output zeilenweise, sodass dies selten auftritt.

---

## 7. Sound-Wiedergabe

> **Abweichung vom Ursprungsentwurf:** Implementiert mit **`HTMLAudioElement`** statt Web Audio API. Begründung: der bestehende GMCP-`SoundService` nutzt dasselbe Pattern, der Code ist deutlich kürzer und reicht für unseren Use-Case (kurze Trigger-Sounds, kein simultanes Mischen mit eigenem Mixer). Volume-Mixing wird über `audio.volume` (Float 0–1) gelöst.

- **Master-Volume** aus `triggers.settings.v1` × **Trigger-Volume** = effektive Lautstärke. Beides via `clamp01()` auf [0, 1] geklemmt.
- **Cache**: pro fully-resolved URL ein `HTMLAudioElement` (wiederverwendet bei erneuten Plays).
- **Entprellung**: derselbe `soundId` wird pro 250 ms maximal einmal abgespielt (Schutz vor Spam).
- Autoplay-Policy: `audio.play()` wird beim ersten Aufruf vor User-Geste mit `NotAllowedError` abgelehnt. Wir schlucken den Fehler still mit `console.debug` — sobald der User auf die App klickt/tippt, funktionieren spätere Plays.

Spätere Umstellung auf Web Audio API ist denkbar (siehe §11), falls präziseres Mixing nötig wird.

---

## 8. UI

### 8.1 Trigger-Konfiguration (`TriggerConfigComponent`)

Als modeless Window über das vorhandene Window-System ([`features/windows/`](u3_migrate/frontend/src/app/features/windows/)), registriert unter ID `'trigger-config'`.

**Header:**
- Master-Toggle "Trigger aktiv".
- Master-Volume-Slider (🔊, 0–100 %).
- Export-/Import-Buttons (Trigger-Liste als JSON).
- "+ Neuer Trigger"-Button.

**Liste:**
- Pro Zeile: Toggle, Action-Symbol (🎨/🔊), Name, Pattern, Action-Kurzbeschreibung, ↑/▼ Reorder-Buttons, Bearbeiten, Löschen.
- Reorder-Buttons sind an Listengrenzen disabled.

**Editor (klappt unten auf):**
- Felder: Name, Pattern (mit Live-Compile-Validierung), Flags (`i m s u` erlaubt), Aktiv-Checkbox, Aktions-Typ (Radio: Highlight / Sound).
- Bei Highlight: Color-Picker FG / BG mit ×-Buttons zum Zurücksetzen, Bold-Checkbox.
- Bei Sound: Dropdown der verfügbaren Sounds (`optgroup` "Allgemein" + "Persönlich") + ▶-Vorhör-Button + Volume-Slider.
- **Test-Panel**: Textarea + Live-Vorschau, die jeden Match mit aktuellem Styling rendert (Highlight: Farb-Overlay; Sound: dashed outline). Match-Zähler oberhalb.
- Speichern ist disabled, solange das Pattern ungültig ist.

### 8.2 Sound-Library (`SoundLibraryComponent`)

Modeless Window, registriert unter ID `'sound-library'`.

- Tab "Allgemein" — schreibgeschützte Liste der Built-in-Sounds mit ▶-Button. Zählt im Tab-Header.
- Tab "Persönlich" — Liste der Personal Sounds mit:
  - ▶ Play, ✎ Umbenennen (via `window.prompt`), ✕ Löschen (mit Bestätigung; zeigt an, wie viele Trigger den Sound referenzieren).
  - Footer: "Sound importieren" → hidden `<input type="file" accept="…">`. Erlaubte MIME-Types: `audio/ogg`, `audio/mpeg`, `audio/mp3`, `audio/wav`, `audio/wave`, `audio/x-wav`.
- Verbrauchsanzeige (`X von 4 MB belegt`) im Footer des Personal-Tabs.
- Import-Fehler (zu groß, falscher MIME, Quota überschritten) erscheinen rot direkt unter dem Button.

### 8.3 Einstieg

Beide Window-Services (`TriggerConfigWindowService`, `SoundLibraryWindowService`) registrieren ihre Einträge automatisch im `FooterMenuService` als "Trigger…" und "Sounds…". Sichtbar im Footer-Gear-Menü.

---

## 9. Edge Cases & Entscheidungen

| Fall | Verhalten |
|---|---|
| RegEx-Flags | `g` wird beim Kompilieren immer gesetzt; `y` (sticky) wird abgelehnt. Erlaubte Flags: `i m s u`. |
| Mehrere Matches pro Chunk | Engine sammelt alle Matches bis zum Limit von 32 pro Trigger pro Chunk. |
| Sehr langer Chunk | Engine verarbeitet ihn, aber mit Watchdog (200 ms gesamt). |
| Zero-Width-Match (`a?`) | Engine rückt `lastIndex` manuell vor, kein Endlos-Loop. |
| Sound-ID nicht (mehr) auflösbar | `console.warn`, `play()` ist ein no-op — kein Crash. |
| Benutzer löscht einen Personal Sound, der referenziert ist | Bestätigungsdialog nennt Anzahl referenzierender Trigger; nach Löschen werden die Trigger beim nächsten Play ein no-op. |
| Local Storage voll | Service wirft eine Fehlermeldung, Import wird abgebrochen, keine Teildaten geschrieben. UI zeigt den Fehler rot an. |
| Inkognito-Modus | Local Storage funktioniert, ist aber sessions-gebunden. (Kein expliziter UI-Hinweis — Trigger und Sounds gehen beim Schließen des Tabs verloren.) |
| Multi-Tab | Trigger-Listen werden **nicht** automatisch synchronisiert. Bei Bedarf in späterer Phase via `storage`-Event. |
| Match über Chunk-Grenze | Wird nicht erkannt (siehe §6). |

---

## 10. Migrations-Phasen (alle abgeschlossen)

Jede Phase wurde einzeln umgesetzt, getestet und commit-bar übergeben, gemäß der Vorgabe aus [CLAUDE.md](CLAUDE.md).

### ✅ Phase T1 — Modelle & Persistenz
- `Trigger`/`Sound`-Types, `TriggerService` mit CRUD, Reorder und Local-Storage-Persistenz.
- 14 Unit-Tests.

### ✅ Phase T2 — Sound-Library + Player
- `SoundLibraryService` (Built-in via `manifest.json` + Personal aus Local Storage, mit Quota-Checks).
- `SoundPlayerService` (HTMLAudioElement, Master × Trigger Volume, 250 ms Entprellung).
- 4 generierte WAV-Sounds als Built-in-Assets.
- 19 Unit-Tests.

### ✅ Phase T3 — Engine & Terminal-Integration
- `TriggerEngineService` mit Regex-Matching, 200 ms-Watchdog, Match-Limit 32/Trigger, Compile-Cache.
- `ansi-injector.ts` mit `stripAnsi`, `injectHighlights`, `dropOverlaps`.
- Hook in [`mud-client.component.ts`](u3_migrate/frontend/src/app/core/mud/components/mud-client/mud-client.component.ts) — Trigger laufen **nach** MXP-Segmentierung.
- 26 Unit-Tests.

### ✅ Phase T4 — UI: Trigger-Konfiguration
- `TriggerConfigComponent` (Standalone, OnPush, Signal-State) als modeless Window.
- `TriggerConfigWindowService` mit Footer-Menü-Eintrag "Trigger…".
- Editor inkl. Live-Validierung, Sound-Vorhören, Match-Preview.
- 9 Unit-Tests.

### ✅ Phase T5 — UI: Sound-Library
- `SoundLibraryComponent` mit Tabs, Import, Rename, Delete.
- `SoundLibraryWindowService` mit Footer-Menü-Eintrag "Sounds…".
- Verbrauchsanzeige; Reference-Hinweis beim Löschen.
- 5 Unit-Tests.

### ✅ Phase T6 — Polish
- Master-Volume-Slider im Trigger-Window-Header.
- ↑/▼ Reorder-Buttons in der Trigger-Liste.
- Import/Export der Trigger-Liste als JSON.
- 6 zusätzliche Unit-Tests.

**Gesamtbilanz:** 79 Trigger-spezifische Tests; Bundle-Zuwachs ≈ 40 KB gegenüber Pre-Trigger-Stand.

---

## 11. Spätere Erweiterungen (out of scope)

- IndexedDB-Backend statt Local Storage für größere Sounds.
- Trigger-Aktionen: automatische Befehlsausgabe (`send`), Variable setzen, Counter.
- Trigger-Gruppen / Profile pro MUD.
- Synchronisation der Trigger-Liste server-seitig (an Benutzerkonto gebunden).
- **xterm.js Decorations API** statt ANSI-Injection (saubererer Ansatz, hält Server-SGR-State um den Highlight herum intakt — siehe Einschränkung in §5.4).
- **Web Audio API** statt `HTMLAudioElement`, falls präziseres Mixing nötig wird (siehe §7).
- Match über Chunk-Grenze hinweg via Line-Buffering (siehe §6).
- Drag-and-Drop-Reorder anstelle der ↑/▼-Buttons.

---

## 12. Entscheidungen (zur Historie)

1. **Trigger-Liste global oder pro MUD?** → **Global.** (Pro-MUD-Profile bleiben für eine spätere Phase, siehe §11.)
2. **Format für Built-in-Sounds?** → Ursprünglich `.ogg` geplant; in der Umsetzung **`.wav`** verwendet, weil sich Beep-Dateien programmatisch generieren lassen und das Feature damit sofort testbar wurde (siehe §5.2).
3. **Output-Hook: vor oder nach MXP?** → **Nach MXP-Verarbeitung** — im `text`-Segment des MXP-Filters (siehe §5.3). Clickable-Segmente bleiben unangetastet.
