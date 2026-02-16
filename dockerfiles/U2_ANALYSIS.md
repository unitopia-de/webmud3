# WebMud3 – Vollständige Projektanalyse

## 1. Projektübersicht

**WebMud3** ist ein moderner, webbasierter MUD-Client (Multi-User Dungeon) der dritten Generation, entwickelt als Open-Source-Projekt für [UNItopia](https://www.unitopia.de). Das Projekt verbindet ein **Node.js-Backend** mit einem **Angular-Frontend** und kommuniziert über **Socket.IO** (WebSockets). Das Backend stellt eine Telnet-Verbindung zum MUD-Server her und fungiert als Proxy zwischen dem Web-Frontend und dem MUD.

- **Repository:** `https://github.com/unitopia-de/webmud3`
- **Lizenz:** GPL-3.0
- **Version:** 1.0.0-alpha
- **Node.js:** ~22.20.0
- **Autoren:** Myonara, Felag (mit Kontakten @mystiker und @myonara)

---

## 2. Architektur

### 2.1 Monorepo-Struktur (npm Workspaces)

Das Projekt ist als **npm Workspaces Monorepo** organisiert mit drei Paketen:

```
webmud3/
├── package.json              # Root – orchestriert Workspaces
├── shared/                   # @webmud3/shared – gemeinsame Typen & Interfaces
│   └── src/
│       ├── config/           # ServerConfig Interface
│       ├── sockets/          # Socket.IO Event-Typen (Client↔Server)
│       └── index.ts          # Barrel-Export
├── backend/                  # @webmud3/backend – Express + Socket.IO + Telnet
│   └── src/
│       ├── main.ts           # Entry Point
│       ├── core/             # Middleware, Environment, Routing, Sockets
│       ├── features/         # Telnet Feature (Client, Handler, Negotiation)
│       └── shared/           # Backend-interne Utilities (Logger, HTTP)
├── frontend/                 # @webmud3/frontend – Angular SPA
│   └── src/
│       ├── app/
│       │   ├── core/         # MudClientComponent, MudService
│       │   ├── features/     # Terminal, Sockets, ServerConfig
│       │   └── shared/       # OutputHistory, Types, Utils
│       ├── environments/     # Dev/Prod Konfiguration
│       └── assets/           # Icons (PWA-fähig)
├── dockerfiles/              # Docker Compose Konfigurationen
├── .github/workflows/        # CI/CD (GitHub Actions)
└── .vscode/                  # IDE-Konfiguration
```

### 2.2 Datenfluss

```
┌──────────┐   Socket.IO    ┌──────────┐    Telnet     ┌──────────┐
│ Frontend │ ◄──(WS)──────► │ Backend  │ ◄──(TCP)────► │ MUD      │
│ (Angular)│                 │ (Express)│                │ Server   │
│ xterm.js │                 │ Node.js  │                │ (UNItopia│
└──────────┘                 └──────────┘                └──────────┘
```

1. **Frontend → Backend:** User-Input via `mudInput`, Verbindungssteuerung via `mudConnect`/`mudDisconnect`, Viewport-Updates via `mudViewportSize`
2. **Backend → Frontend:** MUD-Output via `mudOutput`/`mudOutputBatch`, Status-Events (`mudConnected`, `mudDisconnected`, `setEchoMode`, `setLinemode`, `requestTimingMark`)
3. **Backend ↔ MUD:** Telnet-Verbindung mit vollständiger Telnet-Option-Negotiation

### 2.3 Technologie-Stack

| Schicht       | Technologie                          | Version         |
|---------------|--------------------------------------|-----------------|
| Frontend      | Angular                              | ~20.3.4         |
| Terminal      | @xterm/xterm                         | ~5.5.0          |
| Frontend-Test | Jest (@angular-builders/jest)         | ~30.2.0         |
| Styling       | SCSS, normalize.css                  | -               |
| Transport     | Socket.IO Client                     | ~4.8.1          |
| Backend       | Express                              | ~5.1.0          |
| WebSockets    | Socket.IO Server                     | ~4.8.1          |
| Telnet        | telnet-stream                        | ~1.1.0          |
| Logging       | Winston                              | ~3.18.3         |
| Backend-Test  | Jest (ts-jest)                       | ~30.2.0         |
| TypeScript    | TypeScript                           | ~5.9.3          |
| Runtime       | Node.js                              | ~22.20.0        |
| Containerisierung | Docker (multi-stage)            | -               |
| CI/CD         | GitHub Actions                       | -               |
| Deployment    | Azure Web App                        | -               |
| Linting       | ESLint + @angular-eslint             | ~8.57/~9.37     |
| Formatting    | Prettier + EditorConfig              | ~3.6.2          |

---

## 3. Backend-Analyse

### 3.1 Entry Point (`main.ts`)

Der Server wird als **Express-Applikation** initialisiert mit folgender Middleware-Pipeline:

1. **CORS** – Permissiv in Dev, restriktiv in Prod (Allow-List basiert)
2. **Body-Parser** – JSON-Parsing für REST-Endpoints
3. **Static Files** – Serve des kompilierten Frontends aus `wwwroot/`
4. **Socket.IO** – WebSocket-Verbindungen über den `SocketManager`
5. **Config Endpoint** – REST `/api/config` liefert Socket-Namespace
6. **Info Endpoint** – Nur in Development: Debug-Informationen über `/api/info`
7. **Routes** – Catch-All für SPA: `manifest.webmanifest` und Fallback auf `index.html`

### 3.2 Environment (Singleton)

Die `Environment`-Klasse implementiert das **Singleton-Pattern** und liest einmalig alle Umgebungsvariablen via `dotenv`:

| Variable                | Pflicht | Default      | Beschreibung                          |
|-------------------------|---------|--------------|---------------------------------------|
| `HOST`                  | Nein    | `0.0.0.0`   | Listen-Adresse                        |
| `PORT`                  | Nein    | `5000`       | Listen-Port                           |
| `TELNET_HOST`           | Ja      | –            | MUD-Server IP                         |
| `TELNET_PORT`           | Ja      | –            | MUD-Server Port                       |
| `TELNET_TLS`            | Nein    | `false`      | TLS für Telnet                        |
| `SOCKET_ROOT`           | Ja      | –            | Socket.IO Pfad                        |
| `SOCKET_PING_INTERVAL`  | Nein    | `25000`      | Socket.IO Ping-Intervall (ms)         |
| `SOCKET_PING_TIMEOUT`   | Nein    | `20000`      | Socket.IO Ping-Timeout (ms)           |
| `SOCKET_TIMEOUT`        | Nein    | `900000`     | Disconnect-Timeout (15 Min)           |
| `TELNET_KEEPALIVE_DELAY`| Nein    | `30000`      | TCP-KeepAlive für Telnet-Socket (ms)  |
| `ENVIRONMENT`           | Nein    | `production` | `development`/`production`            |
| `NAME`                  | Nein    | `webmud3b`   | Client-Name (TTYPE)                   |
| `CORS_ALLOWED_ORIGINS`  | Nein    | `[]`         | Komma-separierte Origin-Liste         |
| `LOG_LEVEL`             | Nein    | `debug`      | Winston Log-Level                     |

### 3.3 Socket-Manager

Der `SocketManager` erweitert `Server` von Socket.IO und verwaltet:

- **Session-Token-basierte Reconnection**: Clients senden ein `sessionToken` beim Handshake. Das Backend hält die Telnet-Verbindung offen, auch wenn das Frontend disconnected. Bei Reconnect werden gepufferte Ausgaben nachgesendet.
- **Output-Buffering**: Ein `OutputLineBuffer` (Ringbuffer, max 10MB) speichert alle Telnet-Daten. Bei Reconnect wird das gesamte Buffer als `mudOutputBatch` gesendet.
- **Connection-Timer**: Nach Frontend-Disconnect läuft ein Timer (Default: 15 Min). Erst wenn dieser abläuft, wird die Telnet-Verbindung geschlossen.
- **Telnet-Option-State-Forwarding**: Echo-Mode und Linemode werden an den Client propagiert.
- **Transport-Modi**: Unterstützt sowohl `websocket` als auch `polling` (Fallback).
- **Konfigurierbare Ping-Intervalle**: `pingInterval` und `pingTimeout` sind über Umgebungsvariablen steuerbar, um Idle-Disconnects hinter Proxies/Firewalls zu vermeiden.

### 3.4 Telnet-Client

Die `TelnetClient`-Klasse (erweitert `EventEmitter`) implementiert das vollständige Telnet-Protokoll:

- **Option-Handler-Registry**: Map von `TelnetOptions` → `TelnetOptionHandler`
- **Unterstützte Optionen**: CHARSET, ECHO, NAWS, SGA, LINEMODE, TTYPE, STATUS, MSSP, EOR
- **EOR-Buffering**: Wenn End-of-Record ausgehandelt ist, werden Daten gepuffert bis EOR empfangen wird
- **Negotiation-Tracking**: Vollständiges Tracking aller DO/DONT/WILL/WONT und Subnegotiations
- **State-Change-Events**: Option-Handler können State-Changes emittieren (z.B. Echo-Toggle)
- **TCP-KeepAlive**: Konfigurierbar über `TELNET_KEEPALIVE_DELAY` (Default: 30s) – verhindert Idle-Disconnects durch Intermediaries (Firewalls, Load Balancer)
- **Error-Handling**: Fehler auf dem Raw-TCP-Socket werden abgefangen und geloggt, statt den Prozess zum Absturz zu bringen

### 3.5 Telnet-Option-Handler

Jeder Handler implementiert das `TelnetOptionHandler`-Interface:

- `negotiate()` – Initiale Verhandlung
- `handleDo()/handleDont()` – Antwort auf Server-Requests
- `handleWill()/handleWont()` – Antwort auf Server-Offers
- `handleSub()` – Subnegotiation-Verarbeitung
- `getState()` / `onStateChange()` – Optionaler State-Tracking

---

## 4. Frontend-Analyse

### 4.1 Angular-Architektur

Das Frontend ist eine **Standalone-Component-basierte** Angular-Anwendung (kein NgModules):

- **AppComponent** – Root-Komponente, hostet `MudClientComponent`
- **MudClientComponent** – Hauptkomponente mit xterm.js Terminal
- **MudService** – Facade-Service für Socket-Kommunikation
- **SocketsService** – Direkter Socket.IO-Client-Wrapper
- **ServerConfigService** – Lädt Backend-Konfiguration via REST

### 4.2 Terminal-Subsystem (Feature: Terminal)

Das Terminal-Feature ist in mehrere spezialisierte Klassen aufgeteilt:

| Klasse                     | Verantwortung                                                    |
|----------------------------|------------------------------------------------------------------|
| `MudInputController`       | Lokaler Editing-Buffer (LINEMODE), Cursor-Management             |
| `MudPromptManager`         | Prompt-Tracking, Hide/Restore bei Server-Output                  |
| `MudSocketAdapter`         | WebSocket-Kompatibilitätsschicht für xterm AttachAddon            |
| `MudScreenReaderAnnouncer` | ARIA-Live-Region, Structured Output, Echo-Suppression, Stop/Clear |

### 4.3 xterm.js Integration

- **Terminal-Rendering**: xterm.js mit JetBrainsMono-Font
- **Responsive Font-Sizing**: Breakpoint-basiert (8.5px–16px je nach Viewport-Breite)
- **Addons**: FitAddon, ClipboardAddon, AttachAddon (via MudSocketAdapter)
- **Bell**: Synthetisierter Beep via Web Audio API (800Hz, Debounce 100ms)
- **WCAG AAA Kontrast**: `minimumContrastRatio: 7` – xterm.js passt alle Farben automatisch an, um einen ausreichenden Kontrast zwischen Text und Hintergrund zu gewährleisten. Dies kann das originale Farbschema verändern, erfüllt aber die WCAG AAA-Anforderungen.

### 4.4 Barrierefreiheit (Accessibility)

Das Projekt legt besonderen Wert auf Screenreader-Kompatibilität:

- **MudScreenReaderAnnouncer**: Custom ARIA-Live-Region statt xterm's eingebautem `screenReaderMode`
- **Structured-Output-Announcements**: Ausgaben werden als einzelne `TextNode`-Elemente an die Live-Region angehängt (statt `textContent`-Ersetzung), was eine zuverlässigere Screenreader-Verarbeitung ermöglicht.
- **Echo-Suppression**: Wenn der Benutzer einen Befehl sendet, wird die vom MUD zurückgesendete Echo-Zeile erkannt und nicht nochmal als Announcement vorgelesen. Vergleich erfolgt über normalisierte Strings (`normalizeForComparison`).
- **`stopAnnouncements()`**: Methode zum sofortigen Abbrechen aller laufenden Announcements und Leeren des Backlogs (z.B. bei Session-Neustart).
- **History-Region**: `role="log"` für navigierbaren Ausgabe-Verlauf
- **Input-Region**: `role="status"` für Echtzeit-Eingabe-Feedback
- **Helper-Textarea**: xterm's Textarea wird mit Prompt+Buffer aktualisiert
- **Screenreader-Test-Checkliste**: 13 detaillierte Tests in `SCREENREADER_TESTS.md`

### 4.5 Reconnection & Session-Persistence

- **Session-Token**: UUID in `localStorage`, überlebt Page-Reloads
- **Force-New-Session**: Nach fehlgeschlagenem Reconnect wird automatisch ein neues Session-Token generiert, um tote Backend-Sessions nicht wiederzuverwenden (`forceNewSession`-Flag).
- **Output-History**: Strukturierter Store in `localStorage` (max 30MB)
- **Sequence-Gating**: Jede Server-Ausgabe hat eine Sequence-Nummer. Duplicate werden verworfen
- **Input-Queue**: Eingaben während Disconnect werden gepuffert und nach Reconnect geflusht
- **Transport-Fallback**: Socket.IO-Client nutzt `websocket` mit `polling`-Fallback

### 4.6 Environment-Konfiguration

- **Development**: `backendUrl` = `http://localhost:5000`
- **Production**: `backendUrl` = `window.location.href` (Backend hostet Frontend)
- **File-Replacement**: Angular CLI ersetzt `environment.ts` mit `environment.prod.ts` im Prod-Build

---

## 5. Shared-Paket

Das `@webmud3/shared`-Paket enthält die Vertragstypen zwischen Frontend und Backend:

- **`ClientToServerEvents`**: `mudConnect`, `mudDisconnect`, `mudInput`, `mudViewportSize`
- **`ServerToClientEvents`**: `mudOutput`, `mudOutputBatch`, `mudConnected`, `mudDisconnected`, `setEchoMode`, `setLinemode`, `requestTimingMark`
- **`LinemodeState`**: Vollständiger Linemode-Status (edit, trapsig, softTab, literalEcho, forwardMask)
- **`ServerConfig`**: Socket-Namespace-Konfiguration

---

## 6. Build & Deployment

### 6.1 Build-Pipeline

```
npm run build
  ├── shared: tsc → shared/dist/
  ├── frontend: ng build → frontend/dist/frontend/browser/
  ├── backend: tsc → backend/dist/
  └── postbuild: cpy frontend/dist → backend/dist/wwwroot/
```

In **Production** (`npm run build:prod`):
- Frontend wird mit `--configuration=production` gebaut (Optimierung, Hashing, Tree-Shaking)
- Frontend-Bundle wird in Backend's `wwwroot/` integriert
- Backend serviert das Frontend als statische Dateien

### 6.2 Docker

Multi-Stage Dockerfile (vollständig überarbeitet):
1. **Builder** (`node:22.20.0-alpine`): Layer-Caching optimiert – `package.json`-Dateien werden zuerst kopiert, dann `npm ci`, dann Quellcode. Build aller Workspaces via `npm run build:prod`.
2. **Shared-Workaround**: `@webmud3/shared` wird nach `backend/dist/node_modules/@webmud3/shared` kopiert (kein npm-Registry). Anschließend `npm install --omit=dev` innerhalb von `backend/dist/`.
3. **Runtime** (`node:22.20.0-alpine`): Nur kompiliertes Backend + Production-Dependencies. Default-Env-Variablen gesetzt (`NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=5000`, etc.).

#### Docker-Compose für lokale Entwicklung

Neues `dockerfiles/wm3_local_dev.yml` und `dockerfiles/unitopia_dev.dockerfile`:
- Lokaler Docker-Build (`myonara/webmud3:develop`) spiegelt die Produktions-Dockerfile-Struktur
- Docker Compose konfiguriert Umgebungsvariablen, Ressourcen-Limits (0.1 CPU, 50 MB RAM), Restart-Policies und Port-Mapping

### 6.3 CI/CD (GitHub Actions)

- **Build & Test** (`build_and_test.yml`): Auf PRs gegen `develop` – `npm ci`, `npm run build`, `npm run test`
- **Deploy to Azure** (`deploy_to_azure.yml`): Auf Push zu `master` – Build, Shared kopieren, Azure Web App Deploy

---

## 7. Testing

- **Backend**: Jest mit ts-jest, CJS-Modus (tsconfig.jest.json), `import.meta` mock via ts-jest-mock-import-meta
- **Frontend**: Jest über @angular-builders/jest
- **Vorhandene Tests**: Environment-Tests, Buffer-Tests im Backend; Input-Controller- und Prompt-Manager-Specs im Frontend

---

## 8. Konfigurationsdateien

| Datei               | Zweck                                       |
|---------------------|---------------------------------------------|
| `.editorconfig`     | Einheitliche Formatierung (UTF-8, 2 Spaces) |
| `.gitignore`        | Standard Node.js ignores + dist/, .env      |
| `.dockerignore`     | Identisch mit .gitignore                    |
| `tsconfig.json`     | Pro Workspace individuell konfiguriert       |
| `.vscode/settings`  | Auto-Fix, Format-on-Save, Import-Style      |
| `.vscode/launch`    | Debug-Konfigurationen für Frontend+Backend   |

---

## 9. Offene Punkte / TODOs im Code

- GMCP-Support noch nicht implementiert (geplant laut Roadmap)
- MXP-Support in Arbeit (Milestone)
- Cookie-Session-Middleware auskommentiert (`useCookieSession`)
- Auth-Routes auskommentiert (`auth-routes`)
- `sendGmcp()` im Frontend wirft `Error('Method not implemented.')`
- Timing-Mark-Handling als Round-Trip mit speziellem TODO markiert
- Status-Request nach TTYPE-Negotiation als Workaround markiert
- Doppeltes Emitting von Option-States bei Reconnect (TODO im Code)
- **Offener Feature-Branch** `feat/frontend-logger`: Zentralisiertes Logging-System für das Frontend mit konfigurierbaren Log-Leveln (noch nicht in `develop` gemerged)

---

## 10. Versions-Geschichte

Das Projekt hat eine lange Entwicklungsgeschichte (v0.0.2 – v0.5.0 → v1.0.0-alpha):
- Ursprünglich Angular 2+ mit Express
- Mehrfache Angular-Migrationen (6 → 7 → 8 → 9 → 12 → 13 → 14 → 20)
- Schrittweise Protokoll-Implementierung (ANSI → Telnet Options → GMCP-Ansätze)
- Docker-Integration über mehrere Iterationen verfeinert
- Jüngste große Änderung: Komplette Neufassung des Telnet-Clients mit vollem Option-Negotiation-Support

### 10.1 Jüngste Änderungen (seit PR #165)

Die folgenden Merged PRs und Commits sind die neusten Änderungen auf `develop`:

| PR / Bereich | Beschreibung |
|---|---|
| **PR #170 fix/reconnection** | Session-Token-Reset bei Reconnect-Failure, `forceNewSession`-Mechanismus, Transport-Fallback auf `polling` |
| **PR #172 feat/cancelable-screenreader** | Announcement-Queue und Stop-Funktionalität, strukturiertes Output (TextNode-basiert statt `textContent`-Ersetzung), Echo-Suppression für User-Input, Live-Region umgestellt auf `aria-live="polite"` + `aria-relevant="additions text"` + `aria-atomic="false"` |
| **PR #162 feat/web-colors** | WCAG AAA-konforme Terminalfarben via `minimumContrastRatio: 7`, Entfernung des hardcodierten Themes |
| **PR #173 fix/docker-local-test** | Dockerfile komplett überarbeitet (Layer-Caching, Multi-Stage optimiert), neues `unitopia_dev.dockerfile` und `wm3_local_dev.yml` für lokale Docker-Entwicklung |
| **Keepalive-Konfiguration** | Neue Umgebungsvariablen `SOCKET_PING_INTERVAL`, `SOCKET_PING_TIMEOUT`, `TELNET_KEEPALIVE_DELAY` für stabilere Verbindungen hinter Proxies |
| **Telnet Error-Handling** | Expliziter `error`-Handler auf dem Raw-TCP-Socket, verhindert unhandled exceptions und Prozessabstürze |
| **Socket-Cleanup** | Entfernung ungenutzter Socket-Konfigurationseigenschaften, Dokumentation für Session-Discarding |

