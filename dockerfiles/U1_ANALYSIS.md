# WebMud3 Master (V0.6.2) – Vollständige Projektanalyse

## 1. Projektübersicht

**WebMud3** ist ein webbasierter MUD-Client (Multi-User Dungeon) der dritten Generation, entwickelt als Open-Source-Projekt für [UNItopia](https://www.unitopia.de) und [Seifenblase](https://seifenblase.de). Das Projekt besteht aus einem **Node.js/Express-Backend**, einem **Angular-Frontend** und einem separaten **mdconn**-Microservice für Inter-Prozess-Kommunikation zum MUD-Server.

- **Repository:** `https://github.com/unitopia-de/webmud3` (Branch: `master`)
- **Lizenz:** GPL-3.0 (LICENSE) / MIT (Backend package.json)
- **Version:** 0.6.2
- **Node.js:** 20.19.4 (Docker), Angular ~20.3.4
- **Autor:** Myonara

---

## 2. Architektur

### 2.1 Projektstruktur (Separate Pakete)

Im Gegensatz zum `develop`-Branch (npm Workspaces Monorepo) sind Backend und Frontend hier **getrennte npm-Pakete** ohne gemeinsames Shared-Paket:

```
webmud3-master/
├── backend/                  # Node.js Express + Socket.IO + Telnet
│   ├── server.js             # Entry Point (Plain JS)
│   ├── mudSocket.js          # Telnet-Protokoll-Klasse
│   ├── config/               # Env-spezifische Konfiguration
│   ├── mudrpc/               # RPC-Client für MUD-Kommunikation
│   ├── ngxlogger/            # Custom Logging-Modul
│   ├── cleanup.js            # Graceful Shutdown Handler
│   └── package.json
├── frontend/                 # Angular SPA (NgModule-basiert)
│   ├── src/app/
│   │   ├── gmcp/             # GMCP-Protokoll-Service
│   │   ├── menu/             # Dynamisches Menüsystem
│   │   ├── modeless/         # Nicht-modale Fenster (Editor, DirList, Keypad…)
│   │   ├── mud/              # MUD-Client-Kernlogik (ANSI, Signals, Files)
│   │   ├── mudconfig/        # MUD-spezifische Konfiguration (UNItopia-Service)
│   │   ├── nonportal/        # Landingpages je MUD (UNItopia, Orbit, Seifenblase…)
│   │   ├── settings/         # Farbeinstellungen, Editor-Suche
│   │   ├── shared/           # Services (Sockets, ServerConfig, Window, KeypadData)
│   │   └── widgets/          # Inventar-Anzeige
│   ├── src/environments/     # Dev/Prod/UNItopia/Seifenblase-Configs
│   └── src/mud_config.json   # MUD-Liste & GMCP-Familien-Konfiguration
├── mdconn/                   # RPC-Microservice (Unix-Socket zu MUD-Server)
├── dockerfiles/              # Docker Compose Varianten
├── Dockerfile                # Multi-Stage Build
├── Jenkinsfile               # Jenkins CI-Pipeline
└── GMCP.md                   # GMCP-Implementierungsstatus
```

### 2.2 Datenfluss

```
┌──────────┐   Socket.IO    ┌──────────┐    Telnet     ┌──────────┐
│ Frontend │ ◄──(WS)──────► │ Backend  │ ◄──(TCP/TLS)► │ MUD      │
│ (Angular)│                 │ (Express)│                │ Server   │
│ PrimeNG  │                 │ Node.js  │                │(UNItopia)│
└──────────┘                 └──────────┘                └──────────┘
                                  │
                                  │  Unix Socket (RPC)
                                  ▼
                             ┌──────────┐
                             │ mdconn   │
                             │ (RPC     │
                             │  Bridge) │
                             └──────────┘
```

### 2.3 Technologie-Stack

| Schicht         | Technologie                       | Version          |
|-----------------|-----------------------------------|------------------|
| Frontend        | Angular (NgModule-basiert)        | ~20.3.4          |
| UI-Framework    | PrimeNG + PrimeFlex + PrimeIcons  | ~20.2.0          |
| Code-Editor     | Ace Editor (ace-builds)           | ~1.39.1          |
| Transport       | Socket.IO Client                  | ~4.8.1           |
| Cookie-Service  | ngx-cookie-service                | ~20.1.0          |
| Geräte-Erkennung| ngx-device-detector               | ~10.1.0          |
| Backend         | Express                           | ~4.21.2          |
| WebSockets      | Socket.IO Server                  | ~4.8.1           |
| Telnet          | telnet-stream                     | ~1.1.0           |
| Session         | cookie-session                    | ~2.1.0           |
| Backend-Sprache | JavaScript (Plain JS, kein TS)    | ES6+             |
| Frontend-Sprache| TypeScript                        | ~5.9.3           |
| Container       | Docker (multi-stage)              | -                |
| CI/CD           | Jenkinsfile + Docker Compose      | -                |
| Testing         | Karma + Jasmine (Frontend)        | -                |
| E2E             | Protractor                        | -                |

---

## 3. Feature-Katalog

### 3.1 Multi-MUD-Unterstützung

Das System unterstützt **mehrere MUD-Server gleichzeitig** über ein konfigurierbares MUD-Familien-System:

- **MUD-Familien** (`mudfamilies`): Gemeinsame Protokoll-Features pro MUD-Typ
  - `basistelnet`: ASCII, kein GMCP, kein MXP
  - `unitopia`: UTF-8, GMCP, MXP-Unterstützung
- **Konfigurierte MUDs**: UNItopia (SSL:992), Orbit (SSL:9988), Uni1993 (Port:1993), Seifenblase (Port:3333)
- **Dynamisches Routing**: Routen werden zur Laufzeit aus `mud_config.json` generiert (z.B. `/` → UNItopia, `/orbit` → Orbit)
- **MUD-Liste** vom Server abrufbar via `mud-list` Socket-Event

### 3.2 GMCP-Protokoll (Generic MUD Communication Protocol)

Umfangreiche GMCP-Implementierung mit folgenden Modulen:

| Modul            | Richtung      | Status  | Beschreibung                                    |
|------------------|---------------|---------|--------------------------------------------------|
| **Core.Hello**   | Bidirektional | ✅      | MUD/Client-Identifikation                        |
| **Core.Ping**    | Bidirektional | ✅      | Verbindungs-Keep-Alive mit visueller Anzeige     |
| **Core.Goodbye** | MUD→Client    | ⚠️ Teil | Logoff-Ankündigung (Resource-Handling fehlt)      |
| **Core.Supports**| Client→MUD    | ✅      | Set/Add/Remove von GMCP-Modulen                  |
| **Core.BrowserInfo** | Client→MUD| ✅      | Browser-/Geräte-Info an MUD                      |
| **Char.Name**    | MUD→Client    | ✅      | Charakter-Name, Titel-Update, Wizard-Erkennung   |
| **Char.StatusVars/Status** | MUD→Client | ⚠️ | Gilde/Rasse/Rang (empfangen, Anzeige begonnen)  |
| **Char.Vitals**  | MUD→Client    | ⚠️     | HP/SP (empfangen, Anzeige begonnen)              |
| **Char.Stats**   | MUD→Client    | ⚠️     | STR/INT/CON/DEX (empfangen, Anzeige begonnen)   |
| **Char.Items**   | MUD→Client    | ✅      | Inventar: List/Add/Remove                        |
| **Sound.Url/Event** | MUD→Client | ✅      | Audio-Wiedergabe über HTML5 Audio                |
| **Files.DirectoryList** | MUD→Client | ✅ | Verzeichnisanzeige im Fenster                   |
| **Files.OpenFile** | Client→MUD  | ✅      | Datei öffnen/bearbeiten                          |
| **Files.FileSaved** | Client→MUD | ✅      | Datei gespeichert (via HTTP PUT)                 |
| **Files.ChDir**  | Client→MUD    | ✅      | Verzeichniswechsel                               |
| **Input.Complete** | Bidirektional | ✅    | Tab-Completion (Text, Choice, None)              |
| **Numpad.SendLevel/Update/GetAll** | Bidi | ✅ | Numpad-Tastenbelegung vom MUD                 |
| **Room.Info**    | MUD→Client    | ✅      | Raum-Information (Name, Domain, Exits)           |
| **Comm.Say/Soul/Tell** | MUD→Client | ✅   | Kommunikationskanäle                             |

### 3.3 Sound-System

- **GMCP-basiertes Sound-Modul**: MUD sendet `Sound.Url` (Base-URL) und `Sound.Event` (Dateiname)
- **HTML5 Audio API**: Abspielen via `new Audio()`
- **Schaltbar**: Sound kann über GMCP-Menü an/aus geschaltet werden (Toggle via `Core.Supports.Add/Remove`)
- **Beep**: Synthetisierter 800Hz-Beep bei ANSI BEL-Zeichen (Code 7) via `AudioContext`

### 3.4 Datei-Browser & Code-Editor

Vollwertiger **In-Browser Code-Editor** für MUD-Wizards:

- **Verzeichnis-Browser** (`DirlistComponent`): Navigation durch MUD-Dateisystem via GMCP
- **Ace Editor** Integration mit:
  - **37 Themes** (Dracula, Monokai, Twilight, GitHub usw.)
  - **Syntax-Highlighting** für C/C++ (`.c`, `.h`, `.inc`) und Text
  - **Theme-Persistenz** via Cookie
  - **Suchen & Ersetzen** in eigenem Fenster (`EditorSearchComponent`)
  - **Speichern** (HTTP PUT) mit Zwischen- und Abschlussspeichern
  - **Schließen mit Warnung** bei ungespeicherten Änderungen (ConfirmationService)
  - **Read-Only-Toggle**: Umschaltbar zwischen Lese- und Schreibmodus
- **Datei-Lifecycle**: `OpenFile` → Load via HTTP GET → Edit → `FileSaved` via HTTP PUT → `FileCanceled`

### 3.5 ANSI-Farbverarbeitung

Vollständige ANSI-Escape-Sequenz-Verarbeitung (`AnsiService`):

- **Standard-Farben**: 8 Vordergrund + 8 Hintergrundfarben (Codes 30-37, 40-47)
- **256-Farben**: Support via `38;5;N` / `48;5;N`
- **RGB-Farben**: Support via `38;2;R;G;B` / `48;2;R;G;B`
- **Bright Colors**: Codes 90-97 / 100-107 gemappt auf Standardfarben
- **Text-Attribute**: Bold, Faint, Italic, Underline, Blink, Reverse, Concealed, Crossed-Out
- **Farbkollisionserkennung**: Automatische Invertierung wenn Vorder- = Hintergrundfarbe
- **Cursor-Befehle**: Save/Restore Position, Scroll, Clear Screen

### 3.6 Farbeinstellungen

Umfangreiche Farbanpassung (`ColorSettings`):

- **Farb-Invertierung**: Alle Farben invertieren
- **Schwarz auf Weiß**: Schwarz/Weiß-Tausch für helle Umgebungen
- **Farben aus**: Monochromer Modus
- **Local-Echo-Farbe**: Konfigurierbare Farbe für lokales Echo (#a8ff00 Standard)
- **Persistenz**: Farbeinstellungen als Base64-kodiertes JSON im Cookie

### 3.7 Numpad / Tastenbelegung

Konfigurierbares **Numpad-System** für MUD-Steuerung:

- **Modifier-Support**: Shift, Ctrl, Alt, Meta + Numpad/F-Tasten
- **Ebenen-System** (`OneKeypadData`): Verschiedene Tastenbelegungen pro Prefix/Kontext
- **MUD-synchronisiert**: MUD sendet Tastenbelegungen via `Numpad.SendLevel`
- **Benutzer-konfigurierbar**: Änderungen via `Numpad.Update` an MUD zurück
- **Visuelles Keypad** (`KeypadComponent`): Anklickbares Numpad-Widget
- **Konfigurationsdialog** (`KeypadConfigComponent`): PrimeNG DynamicDialog

### 3.8 Nicht-modale Fenster (Modeless Window System)

Eigenes **Fenstersystem** (`WindowService`) für schwebende Panels:

- **Fenstertypen**: Editor, Verzeichnis-Browser, Charakter-Statistiken, Keypad-Config
- **Draggable & Resizable** (`ResizableDraggableComponent`)
- **Z-Index-Management**: Automatische Schichtung, Fokus-Handling
- **Parent-Child-Beziehungen**: Fenster können Unterfenster verwalten
- **Event-System**: `inComingEvents` / `outGoingEvents` für Kommunikation
- **UUID-basierte IDs**: Jedes Fenster erhält eine UUIDv7
- **Aktionen**: Focus, Hide, Save, Cancel, SaveAndClose, WinError

### 3.9 Inventar-Anzeige

- **Kategorisiertes Inventar** (`InventoryList`): Items nach Kategorien gruppiert
- **Live-Updates**: Add/Remove/List via GMCP `Char.Items`
- **Eigene Komponente** (`InventoryComponent`): Darstellung als Widget

### 3.10 Charakter-Statistiken

- **CharStatComponent**: Anzeige von Charakter-Daten in eigenem Fenster
- **Live-Updates**: Name, Status, Vitals, Stats via GMCP
- **CharacterData-Klasse**: Strukturierte Speicherung aller Charakter-Infos

### 3.11 Menüsystem

Dynamisches **hierarchisches Menüsystem** (`MenuService`):

- **PrimeNG MenuBar**: Integration als MudMenu
- **3-Level-Hierarchie**: Hauptmenü → Untermenü → Sub-Untermenü
- **Dynamische Items**: Connect/Disconnect, Scroll-Lock, View-Settings, Numpad-Config
- **MUD-Liste im Menü**: Alle konfigurierten MUDs als Connect-Optionen
- **GMCP-Menü-Integration**: Module können eigene Menüpunkte registrieren (z.B. Sound Toggle)

### 3.12 Input-Handling

- **Eingabe-History**: ArrowUp/ArrowDown navigiert durch vorherige Eingaben
- **Passwort-Modus**: Input-Typ wechselt bei `NOECHO-START` zu Password
- **Tab-Completion**: Tab-Taste löst GMCP `Input.Complete` aus
- **Lokales Echo**: Eigene Eingaben werden lokal mit konfigurierbarer Farbe angezeigt
- **Word-Wrap**: Automatischer Zeilenumbruch bei langer Eingabe

### 3.13 Telnet-Protokoll (Backend)

`MudSocket` erweitert `TelnetSocket` und implementiert:

- **Vollständige Option-Tabelle**: Alle Standard-Telnet-Optionen (0-255) als Lookup-Map
- **DO/DONT/WILL/WONT-Handling**: Korrekte Verhandlung für:
  - `TTYPE` (Terminal Type): Antwortet mit "WebMud3a"
  - `NAWS` (Window Size): Leitet Frontend-Fenstergröße weiter
  - `ECHO`: Steuert Passwort-Modus im Frontend
  - `CHARSET`: Akzeptiert UTF-8
  - `GMCP`: Aktiviert GMCP-Support (wenn MUD-Familie es unterstützt)
  - `TM` (Timing Mark): Beantwortet mit WILL
- **State-Tracking**: Zustandsverfolgung für jede Telnet-Option
- **Debug-Events**: Alle Verhandlungen werden als `mud.debug` an Frontend gesendet

### 3.14 Authentifizierung (experimentell)

- **Auth-Routes** (`/api/auth`): Login/Logout/Loggedon REST-API
- **RPC-Client** (`mudrpc/`): Unix-Socket-Verbindung zum MUD für Passwort-Validierung
- **LDJ-Client**: Line-Delimited JSON-Protokoll für MUD-RPC
- **Cookie-Session**: Session-basierte Authentifizierung
- **GMCP Char.Login**: Geplante Login-Automatisierung über JWT-Token

### 3.15 Multi-Deployment-Support

Konfiguration für verschiedene Deployment-Szenarien:

- **Mehrere Environments**: `environment.ts`, `environment.prod.ts`, `environment.prod.sb.ts`, `environment.prod.uni.ts`
- **URL-basierte Backend-Erkennung**: `ServerConfigService` erkennt anhand von Origin/Path:
  - UNItopia Produktion (`/webmud3/`) → `/mysocket.io`
  - UNItopia Test (`/webmud3test/`) → `/mysocket-test.io`
  - Seifenblase (`/webmud3/`) → `/sbsocket.io`
  - Lokal → `/socket.io`
- **Docker-Varianten**: Zahlreiche Docker Compose Dateien für verschiedene Deployments
- **Secret-Config**: Docker-Secrets für Session-Keys und DB-Pfade

### 3.16 Browser-Info-Übermittlung

- **Geräte-Erkennung** via `ngx-device-detector`: Browser, OS, Version, Typ (Mobile/Tablet/Desktop)
- **Client-ID**: UUIDv7 pro Browser-Session
- **Übermittlung** an MUD via `Core.BrowserInfo` GMCP (Backend fügt `real_ip` hinzu)

### 3.17 Reconnection-Handling

- **Socket.IO Manager**: Automatische Reconnection (bis 10 Versuche)
- **Server-ID-Tracking**: Erkennung von Server-Neustarts
- **Socket-ID-Tracking**: Erkennung von Session-Wechseln
- **Status-Nachrichten**: "[Verbindungsabbruch durch Serverneustart]", "[Verbindung wiederhergestellt]"
- **Keep-Alive**: Periodische Keep-Alive-Pings via Socket

### 3.18 Logging

- **Backend**: Custom `ngxlogger`-Modul mit:
  - 8 Log-Level: TRACE, DEBUG, INFO, LOG, WARN, ERROR, FATAL, OFF
  - Stack-Trace-basierte Datei/Zeilen-Erkennung
  - IP-Adressen pro Log-Entry
  - Console-Level-Routing (debug/info/log/warn/error)
- **Frontend→Backend**: Log-Events via `ngx-log-producer` Socket-Event
- **IP-Tracking**: `x-forwarded-for` Header für korrekte Client-IP hinter Proxy

### 3.19 Graceful Shutdown

`cleanup.js` behandelt:
- `SIGINT` (Ctrl+C)
- `SIGTERM` (Docker Stop)
- `SIGUSR1/SIGUSR2` (Nodemon Restart)
- `uncaughtException`
- Sauberes Trennen aller MUD-Verbindungen vor Beendigung

---

## 4. Backend-Detail-Analyse

### 4.1 Server (`server.js`)

- **Sprache**: Plain JavaScript (ES6+), kein TypeScript
- **Konfiguration**: Dreistufig – `config.global.js` → `config.{env}.js` → Docker Secrets + MUD-Config
- **TLS-Support**: Optionales HTTPS für Backend-Server selbst
- **CORS**: Auskommentiert, aber vorbereitet mit Whitelist
- **Cookie-Session**: Aktiv mit Secret-Key aus Docker Secrets
- **Static Files**: Kompiliertes Angular-Frontend aus `dist/`
- **Ace-Editor-Assets**: Eigener Route-Handler für `/ace/*` → `node_modules/ace-builds/`
- **MUD-Config API**: `/config/mud_config.json` liefert MUD-Liste ans Frontend
- **Connection-Tracking**: `MudConnections{}` und `Socket2Mud{}` Maps

### 4.2 MudSocket (`mudSocket.js`)

- Erweitert `TelnetSocket` aus `telnet-stream`
- Umfangreiche Telnet-Option-Lookup-Tabelle (opt2num, opt2com, num2opt)
- Buffer-Utilities: `txtToBuffer`, `val16ToBuffer`, `sizeToBuffer`
- Debug-Forwarding: Alle Telnet-Events als `mud.debug` zum Frontend

### 4.3 MudRPC-System (`mudrpc/`)

- **LDJClient**: Line-Delimited JSON über TCP/Unix-Socket
- **MudRpc**: Request/Response-Protokoll mit ID-basiertem Caching
- **RpcClient**: Lazy-Connection mit Auto-Reconnect
- **AuthController**: REST-Login/Logout über RPC zum MUD
- **AuthRoutes**: Express-Router für `/api/auth/login` und `/api/auth/logout`

---

## 5. Frontend-Detail-Analyse

### 5.1 Angular-Architektur

- **NgModule-basiert** (nicht Standalone Components wie im `develop`-Branch)
- **Module**: AppModule, MudModule, NonportalModule, ModelessModule, MenuModule, GmcpModule, MudconfigModule, SettingsModule, WidgetsModule
- **PrimeNG-UI**: Nora-Theme, DynamicDialogs, Toast-Notifications, Menubar, ConfirmDialog
- **APP_INITIALIZER**: Lädt `mud_config.json` vor App-Start

### 5.2 Socket-Architektur (3-Schichten)

Mehrstufige Socket-Abstraktionsschicht:

1. **IoPlatform**: Top-Level – verwaltet Manager, ID-Lookups, GMCP-Routing
2. **IoManager**: Socket.IO Manager – Reconnection-Logik, Server-ID-Tracking
3. **IoSocket**: Socket-Instanz – MUD-Verbindungen, Keep-Alive, Event-Handling
4. **IoMud**: Einzelne MUD-Verbindung – GMCP, Signals, Data-Flow

### 5.3 Rendering (HTML-basiert)

Im Gegensatz zum `develop`-Branch **kein xterm.js**:
- **HTML-Span-Rendering**: MUD-Output wird als `AnsiData[]` Array verarbeitet
- **MudSpan-Komponente**: Rendert einzelne ANSI-Spans mit Farbe, Bold, Italic, Blink etc.
- **ScrollLock**: Optional auto-scrolling zum Ende
- **Responsive Sizing**: Berechnung der Terminal-Größe basierend auf Viewport

---

## 6. mdconn-Microservice

Experimenteller **RPC-Bridge-Service**:

- **Zweck**: Verbindung zum MUD-Server über Unix-Socket statt TCP
- **Protokoll**: Line-Delimited JSON (gleich wie `mudrpc/` im Backend)
- **Docker-integriert**: Eigenes Dockerfile, Docker Compose für IPC-Tests
- **Status**: Experimentell/Testphase (enthält Testnachrichten-Code)

---

## 7. Build & Deployment

### 7.1 Docker (Multi-Stage)

```dockerfile
Stage 1: ng-build-stage (node:20.19.4-alpine)
  → npm install + ng build --configuration production

Stage 2: webmud3 (node:20.19.4-alpine)
  → Backend + Angular dist → node server.js
```

### 7.2 Docker Compose Varianten

| Datei                           | Zweck                                    |
|---------------------------------|------------------------------------------|
| `w3_docker_compose_local.yml`   | Lokales Deployment                       |
| `w3_docker_compose_test.yml`    | Test-Umgebung                            |
| `w3_docker_compose.yml`         | Produktion                               |
| `w3_docker_compose_sb.yml`      | Seifenblase-Deployment                   |
| `w3_docker_compose_with_apache.yml` | Mit Apache Reverse-Proxy             |
| `w3_docker_compose_secret.yml`  | Secret-Management                        |
| `w3mdc_docker_compose.yml`      | mdconn-Service                           |
| `mdconn.dockerfile`             | mdconn Docker Image                      |

### 7.3 CI/CD

- **Jenkinsfile**: Git Clone → Docker Build → Image Push
- **Kein GitHub Actions** (im Gegensatz zum `develop`-Branch)

---

## 8. Vergleich mit develop-Branch (u2_webmud3_develop)

| Aspekt                | Master (u1)                      | Develop (u2)                         |
|-----------------------|----------------------------------|--------------------------------------|
| **Sprache Backend**   | Plain JavaScript (ES6)           | TypeScript                           |
| **Projekt-Struktur**  | Separate Packages                | npm Workspaces Monorepo              |
| **Shared-Paket**      | Keines                           | @webmud3/shared                      |
| **Angular-Stil**      | NgModules                        | Standalone Components                |
| **Terminal-Rendering** | HTML Spans (eigenes AnsiService) | xterm.js                            |
| **UI-Framework**      | PrimeNG (Nora Theme)             | Eigenes SCSS                         |
| **Code-Editor**       | Ace Editor (37 Themes)           | Kein Editor                          |
| **Fenster-System**    | Eigenes (Draggable/Resizable)    | Keines (Single-Page)                 |
| **GMCP-Support**      | Umfangreich (Sound, Files, Char) | Geplant/Stub                         |
| **Inventar**          | Implementiert                    | Nicht implementiert                  |
| **Sound**             | Implementiert (HTML5 Audio)      | Nicht implementiert                  |
| **Numpad**            | Implementiert + MUD-synchron     | Nicht implementiert                  |
| **Auth/RPC**          | Implementiert (experimentell)    | Auskommentiert                       |
| **Reconnection**      | Socket.IO Reconnect              | Session-Token + Buffer-Replay        |
| **Accessibility**     | Keine                            | Screen-Reader-Support                |
| **Logging**           | Custom ngxlogger                 | Winston                              |
| **Telnet-Client**     | JS (erweitert TelnetSocket)      | TS (eigene TelnetClient-Klasse)      |
| **CI/CD**             | Jenkinsfile                      | GitHub Actions                       |
| **Express**           | v4                               | v5                                   |

---

## 9. Offene Punkte / TODOs im Code

- `Core.Goodbye`: Resource-Handling bei Logoff fehlt
- `Char.StatusVars/Status/Vitals/Stats`: Empfangen, aber UI-Darstellung unvollständig (charStatsWindow mit `return;` am Anfang)
- `Char.Login`: JWT-Token-basiertes Auto-Login nur konzeptionell
- `Char.Items` V2: Unter Design (Sub-Container-Support)
- CORS: Komplett auskommentiert
- PWA: Deaktiviert (V0.6.2), Manifest-Route auskommentiert
- MXP: In MUD-Config als Feature-Flag vorhanden, aber nicht implementiert
- Playermap: GMCP-Modul registriert, aber keine Frontend-Darstellung
- `send2AllMuds`: TODO-Marker bei Disconnect-Broadcast
- Editor Undo/Redo: Kein explizites Tracking (nur Ace-internes Undo)
- `cancel01_start` / `cancel02_end` in FileInfo: Nur Stubs

---

## 10. Versionsgeschichte (Auszug der Features)

| Version | Wichtige Features                                                    |
|---------|----------------------------------------------------------------------|
| 0.0.2   | Konfigurierbare MUD-Liste                                           |
| 0.0.3   | ANSI-Farbunterstützung                                               |
| 0.0.5   | Telnet-Negotiation (Echo, TTYPE, NAWS), GMCP-Anfang                 |
| 0.0.6   | Sound-Modul (GMCP)                                                   |
| 0.0.7   | Portal-Rewrite, erstes Dockerfile                                    |
| 0.0.11  | CORS-Support                                                         |
| 0.0.13  | IE11/10/9 Polyfills                                                  |
| 0.0.15  | Farbkollisions-Fix, Input-Line-Kürzung                               |
| 0.0.18  | Menü (Connect, Disconnect, Invert, B/W), dynamische Fenstergrößen   |
| 0.0.24  | GMCP Ping/Goodbye, weitere GMCP-Module                              |
| 0.0.25  | Nicht-modale Fenster (Beginn)                                        |
| 0.0.26  | Sound an/aus schaltbar (GMCP-Menü)                                   |
| 0.0.37  | Verzeichnis-Browser & File-Editor                                    |
| 0.0.42  | Lokales Echo mit Farbwahl, BrowserInfo an MUD                        |
| 0.0.44  | ngx-logger Backend+Frontend                                          |
| 0.1.0   | Migration zu Angular 12                                              |
| 0.2.0   | Migration zu Angular 13                                              |
| 0.2.1   | Migration zu Angular 14, Numpad-Implementierung                      |
| 0.3.0   | Inventar-Anzeige                                                     |
| 0.5.0   | Konsolidierung auf ein Docker-Image                                  |
| 0.6.0   | Angular 19, PrimeNG-Update                                          |
| 0.6.2   | Log-Fixes, i18n entfernt                                             |


