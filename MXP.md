# MXP-Unterstützung für u3_migrate

Diese Datei dokumentiert den **MXP-Dialekt von UNItopia** (extrahiert aus
`mud/lib/i/player/mxp.c` und `mud/lib/sys/term.h`) und skizziert einen
Stufenplan, wie u3 ihn unterstützen kann.

> Status u3: **noch nicht implementiert.** Das Backend lehnt `WILL MXP`
> aktuell mit `DONT` ab (kein Handler vorhanden), MXP-Steuersequenzen würden
> ungefiltert im xterm-Output landen.

---

## 1. Was ist MXP?

MXP (Mud Extension Protocol) ist ein Mud-spezifisches XML-ähnliches
Markup, das **inline im Datenstrom** transportiert wird. Es erlaubt dem
Server u.a.:

- klickbare Ausgänge / Inventar-Items
- benannte Variablen (`ENTITY`s) für Statuswerte
- vom Server vorgegebene UI-Status-Anzeigen (`<stat>`)
- Sound-Push direkt im Output-Strom

Die Aktivierung passiert per Telnet-Option: **`TELOPT_MXP = 91`**. Sobald
der Server `WILL MXP` und der Client `DO MXP` vereinbart haben, dürfen
Steuersequenzen im Output erscheinen.

---

## 2. UNItopia-Wire-Format

UNItopia nutzt **nicht** rohe XML-Tags im Stream. Stattdessen werden
Tags durch numerisch kodierte ANSI-artige Sequenzen markiert, die vom
Server in echte XML-Tags **expandiert** werden bevor der Stream raus geht
(siehe `process_mxp` in `mxp.c`).

### 2.1 Mode-Switches

ANSI-CSI-Sequenzen, die den Parser-Zustand schalten:

| Sequenz   | Bedeutung                                    | Definiert in            |
|-----------|----------------------------------------------|-------------------------|
| `ESC[1z`  | **Line Secure Mode** — bis Zeilenende MXP    | `VT_MXP_LINE_SECURE_MODE` |
| `ESC[4z`  | **Temp Secure Mode** — gilt für nächstes Tag | `VT_MXP_TEMP_SECURE_MODE` |
| `ESC[7z`  | **Locked Mode** — kein MXP, alles Text       | `VT_MXP_LOCK_LOCKED_MODE` |

Im **Locked Mode** sind `<` und `&` normaler Text. In **Secure**-Modi
folgen XML-artige Tags.

### 2.2 Numerisch kodierte Tag-Marker

Inline im Stream erscheinen `ESC[!<num>s` (open) und `ESC[!<num>t` (close).
Der Server-internen Pre-Processor (`process_mxp`) ersetzt sie durch
echte XML-Tags. Für u3 sind diese Marker **nicht direkt sichtbar**, weil
der MUD-Server sie auf der Server-Seite expandiert. Der Client sieht
also bereits die XML-Tags.

Kodierung (relevant nur, wenn ein Client den rohen Stream auswerten
würde — bei UNItopia macht das Pre-Processing der Server):

| Code | Tag-Name      | Bedeutung                       |
|------|---------------|---------------------------------|
| 1    | `rshort`      | Raum-Shortname (FLAG=RoomName)  |
| 2    | `rlong`       | Raum-Beschreibung (FLAG=RoomDesc) |
| 3    | `rexit`       | Ausgang (FLAG=RoomExit)         |
| 4    | `rexpire`     | Expire-Marker für „room"-Domain |
| 11   | `ircontent`   | Gegenstand im Raum              |
| 12   | `lrcontent`   | Lebewesen im Raum               |
| 13   | `iinventory`  | Gegenstand im Spieler           |

### 2.3 Initial-Push beim Login

Direkt nach `init_mxp()` schickt der Server **eine** lange Zeile:

```text
ESC[1z<!ELEMENT rlong      ''                        FLAG=RoomDesc>
       <!ELEMENT rshort     ''                        FLAG=RoomName>
       <!ELEMENT rexit      '<send expire="room">'    FLAG=RoomExit>
       <!ELEMENT rexpire    '<expire name="room">'>
       <!ELEMENT ircontent  '<send href="betrachte &id;|fuehle &id;|horche &id;|rieche &id;|nimm &id;" expire="room">' ATT='id'>
       <!ELEMENT lrcontent  '<send href="betrachte &id;|mustere &id;|begruesse &id;|sage zu &id; Hallo!">' ATT='id'>
       <!ELEMENT iinventory '<send href="betrachte &id;|lege &id; hin|fuehre &id;|ziehe &id; an">' ATT='id'>
       <stat ap max=maxap caption="AP:">
       <stat zp max=maxzp caption="LP:">
       <sound Off U="https://www.unitopia.de/sound">
ESC[7z
```

Der Client lernt daraus:

- **`<!ELEMENT>`-Definitionen** — wie ein Tag wie `<rexit west>` zu einer
  klickbaren Aktion expandiert wird (hier: `<send expire="room">west</send>`)
- **`<stat>`-Elemente** — UI-Statusbar mit Wert-Bindungen an ENTITYs
- **`<sound Off U=...>`** — Default-Sound-URL und initial muted

### 2.4 Vitals-Push (ENTITYs)

Bei jeder Vitals-Änderung (`update_points_display()`) sendet der Server:

```text
ESC[4z<!ENTITY ap    "100" DESC="Ausdauerpunkte"          PUBLISH>
ESC[4z<!ENTITY maxap "200" DESC="maximale Ausdauerpunkte" PUBLISH>
ESC[4z<!ENTITY zp    "150" DESC="Lebenspunkte"            PUBLISH>
ESC[4z<!ENTITY maxzp "200" DESC="maximale Lebenspunkte"   PUBLISH>
```

`ESC[4z` macht jeweils nur dieses Tag MXP-aktiv. Die `ENTITY`-Werte
fließen automatisch in die `<stat>`-Statusbar.

### 2.5 Inline im Output

Während des Spiels erscheinen Tags wie:

```text
Du siehst hier folgende Ausgänge: <rexit>norden</rexit>, <rexit>osten</rexit>.
Hier liegt: <ircontent id="schwert">ein Schwert</ircontent>.
```

(Tatsächlich sendet der Server numerisch kodiert, das Pre-Processing
expandiert vor dem Versand.)

### 2.6 Sound-Inline-Push

Wenn eine Server-Nachricht ein `MSG_SOUND`-Attribut hat, wird sie als

```text
ESC[4z<sound "kampf/treffer.mp3">Du triffst den Goblin!
```

eingebettet. Der Client soll die Datei (relativ zur Sound-URL aus
`<sound Off U="…">`) abspielen.

### 2.7 Workaround für Nicht-Mudlet-Clients

UNItopia's MXP-Code prüft den TTYPE-Wert des Clients:

```c
if (!strstr(client[1][0], "mudlet"))
    needs_mxp_workaround = 1;
```

Bei aktivem Workaround hängt der Server **nach jedem MXP-Tag** ein
zusätzliches `ESC[7z` an, um sicher zurück in den Locked Mode zu kommen.
u3 meldet sich als „webmud3" — der Workaround wird also **immer aktiv
sein**. Das ist für uns gutartig: jede MXP-Sequenz ist garantiert
korrekt geklammert.

---

## 3. Überschneidungen mit GMCP

UNItopia bietet **GMCP und MXP parallel** an, mit erheblichem Overlap.
u3 hat GMCP bereits umgesetzt (`Char.Vitals`, `Sound`, in Vorbereitung
`Room.Info`). Die folgende Tabelle zeigt, wo MXP redundant wäre und wo
es **echten Mehrwert** bringt:

| Feature                       | Via GMCP (u3)                 | Via MXP                          | Status  |
|-------------------------------|-------------------------------|----------------------------------|---------|
| Aktuelle LP/AP                | `Char.Vitals` ✅              | ENTITY `ap`/`zp`/…              | Doppelt |
| Statusbar mit Max-Werten      | `Char.Vitals` ✅              | `<stat>` + ENTITYs              | Doppelt |
| Sound-Server-URL              | `Sound.Url` ✅                | `<sound Off U="…">`              | Doppelt |
| Sound-Event abspielen         | `Sound.Event` ✅              | `<sound "file">` inline          | Doppelt |
| Raumname / -beschreibung      | `Room.Info` (geplant)         | `<rshort>` / `<rlong>` inline   | Doppelt |
| Raumausgänge (Daten)          | `Room.Info.exits` (geplant)   | `<rexit>` inline                 | Doppelt |
| **Inline klickbare Items**    | ❌ nicht möglich              | `<ircontent>`, `<lrcontent>`    | **Nur MXP** |
| **Inline klickbare Inventar-Items** | ❌ nicht möglich        | `<iinventory>`                   | **Nur MXP** |
| **Klick-Auswahl-Menüs (`href="a\|b\|c"`)** | ❌ nicht möglich   | `<send href="…">…</send>`        | **Nur MXP** |

**Fazit:** MXP lohnt sich nur, wenn ihr **Inline-Klickbarkeit** wollt
(„klick auf Goblin → Auswahl `betrachte | mustere | begruesse | sage zu …
Hallo!`"). Für reine Datenanzeigen ist GMCP eindeutig überlegen
(typsicher, getrennte Channels, keine Stream-Pollution).

---

## 4. Feature-Liste für u3

Was der Client umsetzen müsste, damit MXP nutzbar ist:

### Pflicht (sonst frisst der xterm Müll)

1. **TELOPT_MXP-Negotiation** im Backend (analog zu `handle-eor-option.ts`).
   Aktuell antwortet u3 mit `DONT` → der MUD aktiviert MXP nicht. Wenn
   ein User MXP serverseitig aktiviert hat **und** wir hier `DO`
   zurückgeben, schickt der Server Steuersequenzen, die sonst sichtbar
   bleiben würden.
2. **Mode-Switch-Stripper** für `ESC[1z`, `ESC[4z`, `ESC[7z` aus dem
   Datenstrom. Pflicht, sobald `DO MXP` gesagt wurde.
3. **Tag-Stripper** für die XML-artigen Tags (`<rshort>`, `<rexit>`,
   `<!ELEMENT>`, `<!ENTITY>`, `<stat>`, `<sound>`, `<send>`, `<expire>`).
   Sonst sieht der User die rohen Tags im Terminal.

### Kür (echter MXP-Nutzen)

4. **`<!ELEMENT>`-Tabelle** im Client — speichert Definitionen aus dem
   Init-Push und nutzt sie zum Expandieren von Custom-Tags.
5. **`<!ENTITY>`-Map** — Werte aus den ENTITY-Pushes verfügbar machen,
   ggf. als Observable. Wird von `<stat>` und `&entity;`-Referenzen
   konsumiert.
6. **`<stat>`-Renderer** — eine zusätzliche oder alternative Statusbar.
   Mehrwert ggü. `Char.Vitals` ist gering (Server-definierter Caption
   und Max-Wert-Binding).
7. **`<rexit>...</rexit>`-Klickbarkeit** — Klick auf einen Ausgang
   im Output schickt den Inhalt als Befehl. Im xterm via Link-Provider
   oder Overlay.
8. **`<ircontent id="…">`/`<lrcontent>`/`<iinventory>` mit Auswahl-Menü**
   — Klick öffnet einen Kontextmenü mit den `|`-getrennten Befehlen aus
   `<send href="…">`.
9. **`<expire name="room">`-Handling** — alle Tags der Domain `room`
   werden inaktiv (verlieren ihre Klickbarkeit), z.B. nach
   Bewegung in einen anderen Raum.
10. **`<sound>`-Inline** — alternativ zu `Sound.Event`.

---

## 5. Stufenplan

### Stufe 0 — Status-Quo dokumentieren *(diese Datei)*
✅ erledigt.

### Stufe 1 — Stream sauber halten ✅ *erledigt*

- Backend: [handle-mxp-option.ts](backend/src/features/telnet/utils/handle-mxp-option.ts)
  akzeptiert `WILL` mit `DO`, ohne Sub-Negotiation.
- Frontend: [MxpStreamFilter](frontend/src/app/features/terminal/mxp-stream-filter.ts)
  entfernt Mode-Switches und Tags aus dem Datenstrom, *bevor* xterm sie
  sieht. Stateful: Mode/Tag-State spannt über Chunk-Grenzen.
- Verdrahtung in [MudClientComponent.transformMudOutput](frontend/src/app/core/mud/components/mud-client/mud-client.component.ts).

### Stufe 2 — `<!ENTITY>` + `<stat>` ✅ *erledigt*

- [MxpEntityService](frontend/src/app/features/terminal/mxp-entity.service.ts)
  hält die ENTITY-Map reaktiv (`entities$`), aktualisiert per
  `set(name, value)`, geleert bei Disconnect.
- [MxpStatService](frontend/src/app/features/terminal/mxp-stat.service.ts)
  hält die `<stat>`-Definitionen (`stats$`), updated per `upsert(stat)`,
  geleert bei Disconnect.
- Generischer Tag-Parser in [mxp-tag.ts](frontend/src/app/features/terminal/mxp-tag.ts)
  extrahiert Name + Attribute aus dem rohen Tag-String.
- [MxpStreamFilter](frontend/src/app/features/terminal/mxp-stream-filter.ts)
  bekam einen `onTag`-Callback im Konstruktor, der jedes komplette Tag
  emittiert (auch über Chunk-Grenzen hinweg) — die Bytes werden
  weiterhin aus dem Stream entfernt.
- [MxpTagRouter](frontend/src/app/features/terminal/mxp-tag-router.ts)
  leitet `<!ENTITY>`-Tags an den `MxpEntityService` und `<stat>`-Tags
  an den `MxpStatService`.
- Char-Footer zeigt rechts neben den Char-Vitals **MXP-Status-Pillen**
  (kleine Pillen mit `caption`, aktuellem Wert und Max-Wert), die
  automatisch erscheinen, sobald der Server eine `<stat>`-Definition
  pusht. Bleibt unsichtbar, solange keine Stats da sind.
- Reset-Hook in [MudClientComponent](frontend/src/app/core/mud/components/mud-client/mud-client.component.ts):
  bei jedem Disconnect werden Filter-Buffer, ENTITY-Map und
  STAT-Definitionen geleert; der Server schickt sie beim Reconnect
  ohnehin neu.

**Begründung optional:** GMCP `Char.Vitals` macht das schon. Stufe 2
lohnt sich, wenn ihr Server-definierte Captions / weitere ENTITYs
(z.B. Mana, Erfahrung) ohne extra GMCP-Erweiterung sehen wollt.

### Stufe 3 — Inline-Klickbarkeit ✅ *erledigt*

- [MxpStreamFilter](frontend/src/app/features/terminal/mxp-stream-filter.ts)
  wurde um `processToSegments(chunk)` erweitert: liefert eine Liste aus
  `text`- und `clickable`-Segmenten. Klickbar sind `rexit`, `send`,
  `ircontent`, `lrcontent`, `iinventory`. Inhalt zwischen Open- und
  Close-Tag (inkl. ANSI-Colors) wird als Click-Content gesammelt;
  MXP-Mode-Switches darin werden weiterhin gestrippt.
- [MxpElementService](frontend/src/app/features/terminal/mxp-element.service.ts)
  speichert die `<!ELEMENT>`-Definitionen aus dem Init-Push und exposed
  eine `resolve(tag, attrs)`-Methode, die `&id;`-Referenzen durch die
  Source-Tag-Attribute substituiert und `<send href="…" expire="…">`
  zurückgibt.
- [MxpClickableService](frontend/src/app/features/terminal/mxp-clickable.service.ts)
  hält die Klick-Regionen pro xterm-Buffer-Marker (Position folgt dem
  Scroll automatisch), kennt `expireDomain(name)` für `<expire>`-Tags.
- [MxpTagRouter](frontend/src/app/features/terminal/mxp-tag-router.ts)
  routet zusätzlich `<!ELEMENT>` und `<expire name=…>` an die neuen
  Services.
- [MudClientComponent](frontend/src/app/core/mud/components/mud-client/mud-client.component.ts):
  - Stream-Pipeline auf segmentierte Verarbeitung umgestellt
    (`transformMudOutput` schreibt selbst in `terminal.write` und
    suppresst AttachAddon's eigenen Write).
  - Pro klickbarem Segment werden `IMarker` + Spalten-Range gespeichert,
    inkl. abgeleiteter Click-Action: `rexit` → Inhalt als Befehl,
    `send`/`ircontent`/… → ELEMENT-Lookup mit Pipe-Split (mehrere
    Optionen werden für Stufe 3 als „erste Option" gewertet).
  - `installMxpLinkProvider()` registriert einen xterm-`LinkProvider`,
    der pro Hover die Treffer aus `MxpClickableService` zurückgibt.
  - `activateClickRegion(action)` schickt den Befehl per
    `MudService.sendMessage`.
  - Disconnect-Reset leert auch die neuen Stores.

### Stufe 4 — Auswahl-Menüs *(mittel, ~1 Tag)*

- Bei `<send href="cmd1|cmd2|cmd3">` öffnet ein Klick statt direkt zu
  senden ein **Popup-Menü** mit den drei Optionen.
- Tastatur-Variante: Doppelklick = erste Option, Rechtsklick = Menü?
  (UX-Entscheidung)

### Stufe 5 — `<sound>` + restliche Tags *(klein)*

- `<sound>`-Inline mit dem bestehenden `SoundService` verdrahten.
- `<sound Off U="…">` als alternative Quelle für die Base-URL.
- Kontrollierter Switch: bei aktivem GMCP-`Sound` MXP-Sound ignorieren,
  damit Sounds nicht doppelt gespielt werden.

### Stufe 6 — Tests + Edge-Cases

- Mode-Switch zwischen Chunks (Secure-Mode öffnet in Chunk N, schließt
  in Chunk N+1).
- Tag, das über eine Chunk-Grenze gesplittet wird.
- Workaround-Modus permanent an (jedes Tag ist einzeln gewickelt) —
  Parser muss damit klarkommen.
- Verschachtelung: `<lrcontent id="goblin">der <rexit>kleine</rexit>
  Goblin</lrcontent>` (theoretisch möglich, gibt's das praktisch?).

---

## 6. Empfehlung

**Erledigt:** Stufen 1, 2 und 3.

- **Stufe 1**: Stream wird sauber konsumiert (keine MXP-Bytes im xterm).
- **Stufe 2**: ENTITY-Werte und `<stat>`-Definitionen reaktiv im Footer.
- **Stufe 3**: Inline-klickbare Tags via xterm-LinkProvider. Klick auf
  `<rexit>nord</rexit>` schickt `nord`; Klick auf `<ircontent id="goblin">`
  schickt den ersten Befehl der `<!ELEMENT>`-Template-Liste (z.B.
  `betrachte goblin`). `<expire name="room">` deaktiviert Klickbereiche
  beim Raumwechsel.

**Nächster Schritt:** Stufe 4 — Auswahl-Menü statt automatischer Wahl
des ersten Befehls. Direkter Build-on auf Stufe 3.

**Niedrige Priorität:** Stufe 5 (`<sound>`-Inline). Macht nur Sinn,
falls GMCP-Sound abgeschaltet werden soll.

**Nicht empfohlen:** MXP für Datenanzeige *anstelle von* GMCP. Das
würde uns einen halbgaren XML-Parser einhandeln, wo wir bereits
typsichere Strukturen aus GMCP haben.
