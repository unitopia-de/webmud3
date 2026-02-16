# U3 – Standanalyse des teilweise migrierten Zielstandes (`u3_webmud3_target`)

## 1. Überblick

`u3_webmud3_target` enthält den **Migrations-Zielstand** von WebMud3, basierend auf dem `migrate/p3-gmcp`-Branch. Es handelt sich um den `develop`-Stand (≈PR #165), auf den 15 zusätzliche Migrations-Commits aufgesetzt wurden. Die Migration umfasst primär:

- **GMCP-Protokoll-Support** (Backend + Frontend)
- **Multi-MUD-Konfiguration** (Backend)
- **Fenstersystem** (Frontend, Modeless Windows)
- **GMCP-Module** (Sound, Char/Statusbar, Char/Inventar, Files/Editor/DirList)

**Aktueller Branch:** `migrate/p3-gmcp` (HEAD: `be4f4cf`)

---

## 2. Migrations-Commits (15 Commits auf `develop`)

| # | Hash | Beschreibung |
|---|------|-------------|
| 1 | `4d2cd3d` | Cursor-Rules für Backend, Frontend, Shared, Telnet, Docker, Coding-Conventions |
| 2 | `0290999` | GMCP-Option im Backend aktivieren (TelnetClient + Handler) |
| 3 | `a42ce6e` | Shared-Typen für GMCP (`GmcpSupport`, `MudConfig`, `MudFamilyConfig`, `MudConfigFile`) |
| 4 | `c0ad99a` | GMCP im Frontend (GmcpService, GmcpModuleHandler, GmcpEvent, GmcpBootstrapService) |
| 5 | `4a0da9a` | Optionale Multi-MUD-Konfiguration (MudConfigService, Environment, REST-Endpoint) |
| 6 | `835dd2d` | Fenstersystem (WindowService, WindowComponent, WindowContainerComponent) |
| 7 | `0224506` | DirList-Komponente + ACE-Editor-Komponente (FilesGmcpHandler, FilesService) |
| 8 | `cefdb33` | GMCP Sound-Modul (SoundGmcpHandler) |
| 9 | `bd42f59` | GMCP Core.BrowserInfo mit Real-IP-Injektion (extractRealIp) |
| 10 | `4aa393b` | Char-Statusleiste als Statusbar-Komponente (CharStatusBarComponent) |
| 11 | `2095efb` | GMCP Inventar (InventoryData, InventoryComponent, Char.Items.*) |
| 12 | `c9bdd50` | Error-Handling Backend + CORS-Konfiguration im SocketManager |
| 13 | `b045060` | Build-Error-Fixes |
| 14 | `e01974a` | Error- und Close-Handling im TelnetClient überarbeitet |
| 15 | `be4f4cf` | Happy-Eyeballs / localhost-DNS-Workaround |

---

## 3. Geänderte / Neue Dateien (62 Dateien, +6660 / −26 Zeilen)

### 3.1 Shared (`@webmud3/shared`)

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `shared/src/gmcp/gmcp-types.ts` | **NEU** | `GmcpModuleConfig`, `GmcpSupport`, `MudFamilyConfig`, `MudConfig`, `MudConfigFile` |
| `shared/src/index.ts` | Erweitert | Re-Exports für GMCP-Typen |
| `shared/src/sockets/server-to-client-events.ts` | Erweitert | `mudGmcpIncoming`, `mudGmcpStart` |
| `shared/src/sockets/client-to-server-events.ts` | Erweitert | `mudGmcpOutgoing`, `mudConnect` mit optionalem `mudId` |

### 3.2 Backend

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `backend/src/features/telnet/utils/handle-gmcp-option.ts` | **NEU** | GMCP-Option-Handler: Negotiation, Parsing, Send/Receive |
| `backend/src/features/telnet/utils/handle-gmcp-option.spec.ts` | **NEU** | 225 Zeilen Tests für GMCP-Handler |
| `backend/src/features/telnet/telnet-client.ts` | Erweitert | GMCP-Handler registriert, Events `gmcpIncoming`/`gmcpStart`, `sendGmcp()`, Error-Handling, Happy-Eyeballs-Fix |
| `backend/src/core/config/mud-config.service.ts` | **NEU** | Multi-MUD-Konfiguration (Singleton, JSON-File, Lookup, GMCP-Support-Auflösung) |
| `backend/src/core/config/mud-config.service.spec.ts` | **NEU** | 248 Zeilen Tests für MudConfigService |
| `backend/src/core/middleware/use-mud-config-endpoint.ts` | **NEU** | REST `/api/mud-config` Endpoint |
| `backend/src/core/middleware/use-sockets.ts` | Erweitert | Übergibt MudConfigService an SocketManager |
| `backend/src/core/sockets/socket-manager.ts` | Erweitert | GMCP-Forwarding, `mudGmcpOutgoing`-Handler, `Core.BrowserInfo`-Enrichment, `resolveConnectionParams()`, CORS |
| `backend/src/core/sockets/extract-real-ip.spec.ts` | **NEU** | Tests für Real-IP-Extraktion |
| `backend/src/core/environment/environment.ts` | Erweitert | `mudConfigPath` (`MUD_CONFIG_PATH`), `TELNET_HOST`/`PORT` als Fallback-Defaults |
| `backend/src/main.ts` | Erweitert | MudConfigService-Init, `useMudConfigEndpoint`, globale Error-Handler |

### 3.3 Frontend

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| **GMCP-Kern** | | |
| `features/gmcp/gmcp.service.ts` | **NEU** | Zentraler GMCP-Service: Modul-Registry, Routing, Observable-Stream, Send-Delegation |
| `features/gmcp/gmcp-module-handler.ts` | **NEU** | Strategy-Interface für GMCP-Module |
| `features/gmcp/gmcp-event.ts` | **NEU** | Event-Typ für Observable-Stream |
| `features/gmcp/gmcp-bootstrap.service.ts` | **NEU** | APP_INITIALIZER: Registriert Char, Sound, Files Handler |
| **Fenstersystem** | | |
| `features/windows/window-config.ts` | **NEU** | `WindowConfig`, `WindowEvent`, `WindowAction` Enum |
| `features/windows/window.service.ts` | **NEU** | Registry, Z-Index, Parent-Child, Event-Bus |
| `features/windows/window.service.spec.ts` | **NEU** | 229 Zeilen Tests |
| `features/windows/window.component.ts` | **NEU** | Draggable + Resizable Window (Pointer Events) |
| `features/windows/window.component.scss` | **NEU** | Catppuccin Mocha Styling |
| `features/windows/window-container.component.ts` | **NEU** | Fixed-Position Overlay, Content-Routing via `@switch` |
| `features/windows/index.ts` | **NEU** | Barrel-Export |
| **GMCP Sound** | | |
| `features/gmcp-sound/sound-gmcp-handler.ts` | **NEU** | HTML5 Audio API, Base-URL + Event-Playback, Toggle-Menü |
| `features/gmcp-sound/sound-gmcp-handler.spec.ts` | **NEU** | 168 Zeilen Tests |
| `features/gmcp-sound/index.ts` | **NEU** | Barrel-Export |
| **GMCP Char** | | |
| `features/gmcp-char/char-gmcp-handler.ts` | **NEU** | Char.Name/StatusVars/Status/Vitals/Stats/Items.* Handler |
| `features/gmcp-char/char-gmcp-handler.spec.ts` | **NEU** | 339 Zeilen Tests |
| `features/gmcp-char/character-data.ts` | **NEU** | Typen + Parsing (Vitals, Stats) |
| `features/gmcp-char/character-data.spec.ts` | **NEU** | 150 Zeilen Tests |
| `features/gmcp-char/char-statusbar.component.ts` | **NEU** | Statusleiste: HP/SP, Stats, Status (ARIA: `role="status"`) |
| `features/gmcp-char/inventory-data.ts` | **NEU** | Kategorisierte Inventarverwaltung |
| `features/gmcp-char/inventory-data.spec.ts` | **NEU** | 131 Zeilen Tests |
| `features/gmcp-char/inventory.component.ts` | **NEU** | Inventar-Fenster (Modeless Window) |
| `features/gmcp-char/index.ts` | **NEU** | Barrel-Export |
| **GMCP Files** | | |
| `features/gmcp-files/files-gmcp-handler.ts` | **NEU** | Files.URL, Files.DirectoryList, OpenFile/ChDir, Save-Workflow |
| `features/gmcp-files/files.service.ts` | **NEU** | HTTP Load/Save, FileInfo-Registry |
| `features/gmcp-files/files.service.spec.ts` | **NEU** | 158 Zeilen Tests |
| `features/gmcp-files/file-types.ts` | **NEU** | FileInfo, FileEntry, FilesUrlPayload, FilesDirectoryListPayload |
| `features/gmcp-files/file-types.spec.ts` | **NEU** | 22 Zeilen Tests |
| `features/gmcp-files/dirlist.component.ts` | **NEU** | Verzeichnis-Browser (Tabelle, Klick → Open/ChDir) |
| `features/gmcp-files/editor.component.ts` | **NEU** | ACE-Editor: Syntax-Highlighting, Theme, Toolbar, Dirty-Check |
| `features/gmcp-files/index.ts` | **NEU** | Barrel-Export |
| **Integration** | | |
| `app/app.component.ts` | Erweitert | Importiert `CharStatusBarComponent`, `WindowContainerComponent` |
| `app/app.component.html` | Erweitert | `<app-char-statusbar>`, `<app-window-container>` |
| `main.ts` | Erweitert | `GmcpBootstrapService` als APP_INITIALIZER |
| `features/sockets/sockets.service.ts` | Erweitert | `mudGmcpIncoming`/`mudGmcpStart` Handler, GMCP-Send-Funktion, `sendGmcp()` |

---

## 4. Architektur der neuen Features

### 4.1 GMCP-Datenfluss (End-to-End)

```
MUD Server
  │ Telnet Subnegotiation (IAC SB GMCP ... IAC SE)
  ▼
TelnetClient.handleSub() → GmcpNegotiator.handleSub()
  │ Parses "Module.Message {json}"
  │ Emits 'gmcpIncoming' event
  ▼
SocketManager (event handler)
  │ Forwards via Socket.IO: socket.emit('mudGmcpIncoming', module, message, data)
  ▼
SocketsService (frontend)
  │ Calls gmcpService.handleIncoming(module, message, data)
  ▼
GmcpService
  │ 1. Emits on gmcpEvent$ (for any subscriber)
  │ 2. Routes to moduleRegistry.get(module).handleMessage(message, data)
  ▼
GmcpModuleHandler (Strategy Pattern)
  │ e.g. CharGmcpHandler, SoundGmcpHandler, FilesGmcpHandler
  ▼
UI Components (via BehaviorSubject / WindowService)
```

### 4.2 GMCP Outgoing (Frontend → MUD)

```
Component / Handler
  │ gmcpService.sendOutgoing(module, message, data)
  ▼
GmcpService
  │ sendFunction(module, message, data)  (set by SocketsService)
  ▼
SocketsService
  │ socket.emit('mudGmcpOutgoing', module, message, data)
  ▼
SocketManager (Backend)
  │ [Optional: Core.BrowserInfo Enrichment mit real_ip]
  │ telnetClient.sendGmcp(module, message, data)
  ▼
GmcpNegotiator.sendGmcp()
  │ socket.writeSub(TELOPT_GMCP, buffer)
  ▼
MUD Server
```

### 4.3 Multi-MUD-Konfiguration

```
MUD_CONFIG_PATH env var → mud_config.json
  │
  ▼
MudConfigService (Singleton)
  ├── mudfamilies: { unitopia: { GMCP: true, GMCP_Support: {...} } }
  ├── muds: { unitopia-prod: { host, port, ssl, mudfamily } }
  └── routes: { "/unitopia": "unitopia-prod" }
  │
  ▼
SocketManager.resolveConnectionParams(mudId)
  │ Priority: mudId → MudConfigService → Fallback TELNET_HOST/PORT
  │
  ▼
REST /api/mud-config → Frontend MUD-Auswahl (noch nicht implementiert)
```

### 4.4 Fenstersystem

```
WindowService (Registry, Z-Index, Events)
  │
  ▼
WindowContainerComponent (Fixed Overlay, @for + @switch)
  │
  ├── WindowComponent (Draggable/Resizable Shell)
  │     │
  │     ├── @case 'DirlistComponent' → DirListComponent
  │     ├── @case 'EditorComponent'  → EditorComponent
  │     └── @case 'InventoryComponent' → InventoryComponent
  │
  └── Pointer Events: Container = none, Windows = auto
```

### 4.5 Char-Statusleiste

```
Char.Name/Vitals/Stats/Status (GMCP)
  │
  ▼
CharGmcpHandler → characterData$ (BehaviorSubject)
  │
  ▼
CharStatusBarComponent (app.component.html)
  │ Layout: [Name] HP: x/y | SP: x/y | STR INT CON DEX | Status
  │ Nur sichtbar wenn characterData$ !== null
  │ flex: 0 0 auto → verdrängt Terminal von unten
  │ Catppuccin Mocha, monospace, responsive
  └── ARIA: role="status", aria-live="polite"
```

---

## 5. Neue Umgebungsvariablen

| Variable | Pflicht | Default | Beschreibung |
|----------|---------|---------|-------------|
| `MUD_CONFIG_PATH` | Nein | – | Pfad zur `mud_config.json` für Multi-MUD-Support |

Bestehende Änderungen:
- `TELNET_HOST` und `TELNET_PORT` sind nicht mehr `required` — sie dienen als Fallback wenn `MUD_CONFIG_PATH` nicht gesetzt ist (Default: `localhost:23`)

---

## 6. Neue Socket.IO Events

| Event | Richtung | Parameter | Beschreibung |
|-------|----------|-----------|-------------|
| `mudGmcpIncoming` | Server → Client | `module`, `message`, `data` | GMCP-Nachricht vom MUD weiterleiten |
| `mudGmcpStart` | Server → Client | `gmcpSupport: GmcpSupport` | GMCP erfolgreich ausgehandelt, Support-Config mitgesendet |
| `mudGmcpOutgoing` | Client → Server | `module`, `message`, `data` | GMCP-Nachricht ans MUD senden |
| `mudConnect` | Client → Server | `viewport`, `token`, `mudId?` | Erweitert um optionalen `mudId`-Parameter |

---

## 7. Neue REST-Endpoints

| Endpoint | Methode | Beschreibung |
|----------|---------|-------------|
| `/api/mud-config` | GET | Liefert MUD-Liste und Routes für Frontend (Multi-MUD-Auswahl) |

---

## 8. Test-Abdeckung der neuen Features

| Feature | Spec-Datei | Zeilen | Beschreibung |
|---------|-----------|--------|-------------|
| GMCP-Handler (Backend) | `handle-gmcp-option.spec.ts` | 225 | Negotiation, Parsing, Send/Receive |
| MudConfigService | `mud-config.service.spec.ts` | 248 | Laden, Lookup, Fallback, GMCP-Support |
| extractRealIp | `extract-real-ip.spec.ts` | 82 | x-forwarded-for, direct connection |
| SoundGmcpHandler | `sound-gmcp-handler.spec.ts` | 168 | URL, Events, Toggle, Dispose |
| CharGmcpHandler | `char-gmcp-handler.spec.ts` | 339 | Name, Vitals, Stats, Items, Wizard |
| CharacterData | `character-data.spec.ts` | 150 | parseVitals, parseStats, formatStatus |
| InventoryData | `inventory-data.spec.ts` | 131 | Add/Remove/Init, Kategorien |
| FilesService | `files.service.spec.ts` | 158 | processFileUrl, load/save, dirty |
| FileTypes | `file-types.spec.ts` | 22 | Typ-Definitionen |
| WindowService | `window.service.spec.ts` | 229 | Open/Close/Focus/Children, Events |

**Gesamt: ~1.752 Test-Zeilen für neue Features**

---

## 9. Design Patterns

| Pattern | Verwendung |
|---------|-----------|
| **Strategy** | `GmcpModuleHandler`-Interface — jedes GMCP-Modul kapselt sein Verhalten |
| **Registry/Service-Locator** | `GmcpService.moduleRegistry` — dynamische Modul-Registrierung |
| **Observer/Observable** | `gmcpEvent$`, `gmcpStart$`, `characterData$`, `inventory$`, `windows$` |
| **Singleton** | `MudConfigService.getInstance()`, `Environment.getInstance()` |
| **Event Bus** | `WindowService.incomingEvents$` / `outgoingEvents$` |
| **Factory** | `handleGmcpOption()`, `handleSoundOption()` etc. |
| **Adapter** | `MudSocketAdapter` (bestehend), GMCP-Send-Function-Injection |
| **Parent-Child** | `WindowConfig.parentWindowId` — DirList als Parent für Editor-Fenster |

---

## 10. Bekannte Probleme und offene Punkte

### 10.1 Fehlend gegenüber `develop` (HEAD)

Der Migrations-Branch basiert auf `develop` bis PR #165. Folgende neuere Features aus `develop` fehlen:

| Feature | develop PRs | Status in u3 |
|---------|------------|-------------|
| Cancelable Screenreader (Structured Output, Echo-Suppression) | PR #172 | **Fehlt** |
| WCAG AAA Web-Colors (`minimumContrastRatio: 7`) | PR #162 | **Fehlt** |
| Docker Local Test Setup (neues Dockerfile) | PR #173 | **Fehlt** |
| Reconnect Fix (`forceNewSession`, Transport-Fallback) | PR #170 | **Fehlt** |
| Socket Keepalive (`SOCKET_PING_INTERVAL`, `SOCKET_PING_TIMEOUT`, `TELNET_KEEPALIVE_DELAY`) | Commits | **Fehlt** |
| Socket Transport `polling` Fallback | PR #170 | **Fehlt** — u3 nutzt nur `websocket` |

### 10.2 Offene TODOs im Code

- `GMCP.md` zeigt alle `Char.*`-Messages als `[ ]` (nicht implementiert) — aber der Code implementiert sie bereits. Die Dokumentation ist **veraltet**.
- `Core.Supports.Set/Add/Remove` wird funktional genutzt (Sound-Toggle, Wizard-Module), aber es fehlt eine **konfigurierbares UI** für den Benutzer.
- `Core.Goodbye` ist nicht implementiert (keine Ressourcen-Freigabe bei Goodbye-Message).
- `Char.Login` ist nicht implementiert (serverseitig auch noch nicht verfügbar).
- `Numpad`-Modul wird per `Core.Supports.Add` aktiviert bei Wizard-Login, aber es gibt **keinen Handler** im Frontend.
- `Input`-Modul wird ebenfalls bei Wizard-Login aktiviert, **kein Handler** vorhanden.
- `Comm`-Modul (Chat) hat **keinen Handler**.
- `FilesGmcpHandler.saveFile()` enthält einen `completeSave()`-Aufruf, der **nicht direkt verbunden** ist — der Save-Workflow nutzt stattdessen den Re-Open-via-`handleFilesUrl()`-Mechanismus, was die `completeSave()`-Methode effektiv zu totem Code macht (wird über `handleFilesUrl` → `alreadyLoaded`-Branch angestoßen, aber `await this.saveFile(fileInfo.file)` ruft nicht `completeSave` auf, sondern sendet nur GMCP).
- `WindowService.updateData()` missbraucht `WindowAction.Resize` als "data changed"-Signal — sollte ein eigenes Event bekommen.
- CORS-Config im SocketManager fehlt Ping-Intervall-Konfiguration (aus neueren develop-Commits).
- `SocketsService` im Frontend hat noch **keinen `forceNewSession`-Mechanismus** (aus PR #170).

### 10.3 Abweichungen vom ursprünglichen Migrationsplan

- **Char-Statusleiste**: Im Code als Commit-Message markiert als "deviation from migplan" — wurde direkt als feste Statusleiste implementiert statt als Modeless Window.
- **ace-builds** als neue Dependency im Frontend (`package.json`) — kein Lazy-Loading des Pakets selbst (nur dynamischer `import()`).
- **Multi-MUD-Frontend-UI** (MUD-Auswahl-Screen): Backend-API (`/api/mud-config`) existiert, aber im Frontend gibt es **keine Auswahlkomponente**. Die `mudId` wird nirgends übergeben.

### 10.4 Build-Zustand

- Letzte Commits (`c9bdd50`, `b045060`) haben Build-Errors behoben.
- TypeScript-Casts für `AggregateError` und `ErrnoException` wurden über `unknown`-Zwischencasts gelöst.
- Die Cursor-Rules in `.cursor/rules/` sind umfangreich dokumentiert und aktuell zum Code-Stand.

---

## 11. Zusammenfassung: Migrations-Reifegrad

| Bereich | Reifegrad | Anmerkung |
|---------|-----------|-----------|
| **GMCP Backend (Negotiation)** | ✅ Fertig | Vollständig mit Tests, Error-Handling |
| **GMCP Backend (Forwarding)** | ✅ Fertig | Socket.IO Events, Core.BrowserInfo Enrichment |
| **Multi-MUD Backend** | ✅ Fertig | MudConfigService, REST-API, Fallback |
| **GMCP Frontend (Core)** | ✅ Fertig | GmcpService, Strategy Pattern, Bootstrap |
| **GMCP Sound** | ✅ Fertig | HTML5 Audio, Toggle, Tests |
| **GMCP Char (Statusleiste)** | ✅ Fertig | HP/SP/Stats/Status, ARIA, responsive |
| **GMCP Char (Inventar)** | ✅ Fertig | Kategorisiert, Modeless Window, Tests |
| **GMCP Files (DirList + Editor)** | ⚠️ Weitgehend fertig | Save-Workflow komplex, toter Code |
| **Fenstersystem** | ✅ Fertig | Drag, Resize, Parent-Child, Events, Tests |
| **Multi-MUD Frontend** | ❌ Offen | Backend-API vorhanden, keine UI |
| **GMCP Numpad/Input/Comm** | ❌ Offen | Module werden aktiviert, aber kein Handler |
| **Rebase auf develop HEAD** | ❌ Offen | 4 PRs aus develop fehlen (#170, #172, #162, #173) |
| **GMCP.md Dokumentation** | ❌ Veraltet | Zeigt alles als nicht implementiert |
