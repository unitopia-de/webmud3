# Screenreader Test-Checkliste für WebMUD3

## Übersicht

Diese Testliste überprüft die Barrierefreiheit der Terminal-Eingabe für Screenreader-Nutzer. Alle Tests sollten mit aktiviertem Screenreader (z.B. NVDA, JAWS oder VoiceOver) durchgeführt werden.

---

## Vorbereitung

1. Öffne die WebMUD3-Anwendung im Browser
2. Stelle sicher, dass dein Screenreader aktiv ist
3. Fokus sollte automatisch im Terminal-Eingabefeld sein

Hinweis: Die Tests lassen sich direkt im Login Screen durchführen.

---

## Test 1: Einzelne Zeichen eingeben und hören

### Ziel

Überprüfen, dass jedes getippte Zeichen einzeln vorgelesen wird.

### Schritte

1. Tippe langsam die Buchstaben: `h` `e` `l` `l` `o`
2. Achte darauf, dass nach jedem Tastendruck der Buchstabe vorgelesen wird

### Erwartetes Ergebnis

- Nach jedem Buchstaben sollte der Screenreader den Buchstaben ansagen
- Beispiel: "h", "e", "l", "l", "o"
- Kein doppeltes Vorlesen (nicht "h h" oder ähnliches)

### Notizen:

```


```

---

## Test 2: Wörter nach Leerzeichen hören

### Ziel

Überprüfen, dass nach einem Leerzeichen das komplette getippte Wort vorgelesen wird.

### Schritte

1. Tippe: `hallo` (ohne Enter)
2. Tippe ein Leerzeichen
3. Achte darauf, ob das Wort "hallo" komplett vorgelesen wird

### Erwartetes Ergebnis

- Während des Tippens: einzelne Buchstaben werden angesagt ("h", "a", "l", "l", "o")
- Nach dem Leerzeichen: das komplette Wort wird nochmal angesagt ("hallo")
- Zusätzlich sollte "Leerzeichen" angesagt werden

### Notizen:

```


```

---

## Test 3: Mehrere Wörter mit Leerzeichen

### Ziel

Überprüfen, dass bei mehreren Wörtern jedes Wort nach dem Leerzeichen vorgelesen wird.

### Schritte

1. Tippe: `schau` (Leerzeichen) `nach` (Leerzeichen) `norden`
2. Achte auf die Ansagen nach jedem Leerzeichen

### Erwartetes Ergebnis

- Nach dem ersten Leerzeichen: "schau" wird vorgelesen
- Nach dem zweiten Leerzeichen: "nach" wird vorgelesen
- "norden" wird erst vorgelesen, wenn du Enter drückst oder ein weiteres Leerzeichen tippst

### Notizen:

```


```

---

## Test 4: Vollständige Eingabe nach Enter hören

### Ziel

Überprüfen, dass die komplette Eingabezeile nach dem Absenden (Enter) nochmal vorgelesen wird.

### Schritte

1. Tippe: `betrachte mich`
2. Drücke Enter
3. Achte darauf, ob die komplette Eingabe vorgelesen wird

### Erwartetes Ergebnis

- Während des Tippens: einzelne Zeichen und Wörter werden wie erwartet angesagt
- Nach Enter: die komplette Eingabe "schau dich um" wird nochmal vorgelesen
- Danach sollte die Serverantwort kommen (z.B. Charakterbeschreibung)

### Notizen:

```


```

---

## Test 5: Backspace - gelöschte Zeichen hören

### Ziel

Überprüfen, dass gelöschte Zeichen (via Backspace) vorgelesen werden.

### Schritte

1. Tippe: `tiss`
2. Drücke Backspace einmal (um das zweite 's' zu löschen)
3. Achte darauf, ob der gelöschte Buchstabe angesagt wird

### Erwartetes Ergebnis

- Der Screenreader sollte "s" ansagen (der gelöschte Buchstabe)
- Nach dem Löschen kannst du weiterschreiben: `ch` → sollte "tisch" ergeben

### Notizen:

```


```

---

## Test 6: Leerzeichen löschen mit Backspace

### Ziel

Überprüfen, dass gelöschte Leerzeichen als "Leerzeichen" angesagt werden.

### Schritte

1. Tippe: `hallo` (Leerzeichen) `welt`
2. Drücke Backspace viermal (um "welt" zu löschen)
3. Drücke Backspace nochmal (um das Leerzeichen zu löschen)

### Erwartetes Ergebnis

- Beim Löschen von "w", "e", "l", "t": jeweiliger Buchstabe wird angesagt
- Beim Löschen des Leerzeichen: "Leerzeichen" wird angesagt

### Notizen:

```


```

---

## Test 7: Eingabe navigieren und vorlesen lassen

### Ziel

Überprüfen, dass die aktuelle Eingabe jederzeit vorgelesen werden kann, ohne sie abzuschicken.

### Schritte

1. Tippe: `betrachte mich`
2. **Ohne Enter zu drücken**: Nutze die Screenreader-Funktion "Aktuelle Zeile vorlesen"
   - NVDA: NVDA+L
   - JAWS: Insert+Pfeil oben
   - VoiceOver: VO+A (aktuelle Zeile)
3. Alternativ: Nutze die Screenreader-Navigation, um zur Eingabezeile zu navigieren

### Erwartetes Ergebnis

- Der Screenreader sollte den Prompt (falls vorhanden, z.B. "> ") plus deine Eingabe vorlesen
- Beispiel: "> betrachte mich"
- Du solltest die Eingabe vollständig hören können, ohne Enter zu drücken

### Notizen:

```


```

---

## Test 8: Prompt wird mitgelesen

### Vorbereitung

Um den Prompt überhaupt zu sehen (ist standardmäßig bei allen neuen Charakteren aktiviert), kann man
`einst client prompt an` zum aktivieren, bzw. `einst client prompt aus` zum deaktivieren nutzen.

Der Prompt ist ein Zeichen, was anzeigt, dass man "hier" etwas eingeben kann. In Unitopia ist das das > Zeichen.

### Ziel

Überprüfen, dass der Server-Prompt ">" in der Eingabezeile sichtbar/hörbar ist.

### Schritte

1. Warte, bis der Server einen neuen Prompt sendet (nach jeder Aktion)
2. Tippe einen Buchstaben, z.B. `l`
3. Nutze die Screenreader-Funktion "Aktuelle Zeile vorlesen"

### Erwartetes Ergebnis

- Der Screenreader sollte den Prompt UND deine Eingabe vorlesen
- Beispiel: "> l" oder "HP:100> l"
- Der Prompt sollte ANSI-Farbcodes nicht enthalten (nur der reine Text)

### Hinweise

Der Prompt ist für blinde Spieler eher unnötig und nervig, dennoch ist er Teil eines komplexen Systemes und sollte dementsprechend
ebenfalls funktionieren, wenn aktiviert.

### Notizen:

```


```

---

## Test 9: Serverausgabe wird vorgelesen

### Ziel

Überprüfen, dass Server-Nachrichten (z.B. Raumbeschreibungen, Kämpfe) vorgelesen werden.

### Schritte

1. Tippe einen Befehl, z.B. `schau`
2. Drücke Enter
3. Achte darauf, ob die Serverantwort vorgelesen wird

### Erwartetes Ergebnis

- Die Serverantwort sollte automatisch vorgelesen werden
- Die Ansage sollte ANSI-Farbcodes nicht enthalten (nur reiner Text), daher es sollten keine merkwürdigen Zeichen, wie [ zu hören sein
- Nach der Serverausgabe sollte direkt weitere Eingaben möglich sein.

### Notizen:

```


```

---

## Test 10: Schnelles Tippen

### Ziel

Überprüfen, dass auch bei schnellem Tippen alle Zeichen korrekt vorgelesen werden.

### Schritte

1. Tippe so schnell wie möglich: `untersuche alles hier`
2. Achte darauf, ob alle Zeichen vorgelesen werden

### Erwartetes Ergebnis

- Alle Zeichen sollten vorgelesen werden (evtl. leicht verzögert)
- Kein Buchstabe sollte "verschluckt" werden
- Nach Leerzeichen sollten Wörter vorgelesen werden

### Notizen:

```


```

---

## Test 11: History/Verlauf navigieren

### Ziel

Überprüfen, dass alte Server-Ausgaben über die Screenreader-Navigation erreichbar sind.

### Schritte

1. Führe mehrere Befehle aus (z.B. `schau`, `inventar`, `wer`)
2. Nutze die Screenreader-Navigation, um durch die vergangenen Ausgaben zu scrollen
3. Versuche, eine alte Nachricht nochmal vorlesen zu lassen

### Erwartetes Ergebnis

- Du solltest mit dem Screenreader durch alte Nachrichten navigieren können
- Alte Nachrichten sollten in einem History-Bereich verfügbar sein
- Jede Nachricht sollte einzeln lesbar sein

### Notizen:

```


```

---

## Test 12: Mehrfaches Enter auf leerer Zeile

### Ziel

Überprüfen, dass leere Eingaben korrekt behandelt werden.

### Schritte

1. Drücke Enter ohne etwas zu tippen
2. Achte auf Screenreader-Feedback

### Erwartetes Ergebnis

- Der Screenreader sollte nicht endlos wiederholen
- Evtl. eine kurze Ansage oder gar keine Ansage
- Die Anwendung sollte nicht abstürzen oder hängen bleiben

### Notizen:

```


```

---

## Test 13: Sonderzeichen eingeben

### Ziel

Überprüfen, dass Sonderzeichen korrekt vorgelesen werden.

### Schritte

1. Tippe Sonderzeichen wie: `!` `?` `.` `,` `:` `;`
2. Achte darauf, wie sie angesagt werden

### Erwartetes Ergebnis

- Jedes Sonderzeichen sollte korrekt benannt werden
- Beispiel: "Ausrufezeichen", "Fragezeichen", "Punkt", etc.
- Keine seltsamen ANSI-Codes oder Steuerzeichen

### Notizen:

```


```

---

## Zusätzliche Hinweise für Tester

- **Browser-Empfehlung**: Chrome oder Firefox mit aktiviertem Screenreader
- **Screenreader-Einstellungen**: Stelle sicher, dass "Getippte Zeichen ansagen" aktiviert ist
- **Fokus**: Der Fokus sollte immer im Terminal bleiben, damit Eingaben funktionieren
- **Verbindung**: Bei Verbindungsabbruch bitte neu verbinden und Tests wiederholen
