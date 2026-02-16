# U3 – Standanalyse V2 des migrierten Zielstandes (`u3_webmud3_target`)

## 1. Überblick

`u3_webmud3_target` enthält den **vollständig migrierten Zielstand** von WebMud3, basierend auf dem `migrate/p4-gmcp`-Branch. Es handelt sich um den `develop`-Stand (≈PR #165), auf den 25 Migrations-Commits aufgesetzt wurden. Die Migration umfasst:

- **GMCP-Protokoll-Support** (Backend + Frontend, vollständig)
- **Multi-MUD-Konfiguration** (Backend + Frontend mit Routing)
- **Fenstersystem** (Frontend, Modeless Windows)
- **GMCP-Module** (Core, Sound, Char/Statusbar, Char/Inventar, Files/Editor/DirList, Input, Numpad, Comm, Room)
- **Menü-System** (Eigenentwicklung, Catppuccin Mocha, Keyboard-Navigation, ARIA)
- **Farbeinstellungen** (Invertierung, B/W, Monochrom, lokale Echo-Farbe, xterm-Theme)
- **Multi-Deployment** (Environment-Files, Docker Compose Varianten)

**Aktueller Branch:** `migrate/p4-gmcp` (HEAD: `5f85380`)

---

## 2. Migrations-Commits (25 Commits auf `develop`)

### Phase 0–1: Basis + Core GMCP (Commits 1–15 + 16)

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
| 16 | `1a3639b` | Bug-Fixes, Core.Hello, Core.Supports.Set, Core.Ping, Core.Goodbye |

### Phase 2: Menü + Farbeinstellungen (Commit 17)

| # | Hash | Beschreibung |
|---|------|-------------|
| 17 | `50be7ec` | Menü-System (MenuBar, Dropdown, Service) + ColorSettingsService + ColorSettingsComponent |

### Phase 3: GMCP Feature Module (Commits 18–22)

| # | Hash | Beschreibung |
|---|------|-------------|
| 18 | `e0635bf` | Input-Completion (InputGmcpHandler, Tab-Handling im MudInputController) |
| 19 | `50ebf4f` | Numpad/Keypad (NumpadGmcpHandler, KeypadComponent, KeypadData-Modell) |
| 20 | `cb7b91e` | Comm-Modul (CommGmcpHandler: Say, Soul, Tell) |
| 21 | `18a5bfa` | Room.Info (RoomGmcpHandler: Raum-Name, Domain, Exits, Browser-Titel) |
| 22 | `8c3ef90` | Editor-Suche (ACE ext-searchbox, Keyboard-Event-Propagation) |

### Phase 4: Multi-MUD Frontend + Deployment (Commits 23–25)

| # | Hash | Beschreibung |
|---|------|-------------|
| 23 | `c9a8285` | Multi-MUD-Selector (MudConfigService Frontend, MudSelectorComponent, Angular Router, mudId-Passing) |
| 24 | `fb66676` | Environment-Files (prod.uni, prod.sb) + Docker Compose Varianten auf u3-Env-Vars migriert |
| 25 | `5f85380` | Migrationspläne und Analyse-Dokumente archiviert |

---

## 3. Geänderte / Neue Dateien (132 Dateien, +14.251 / −211 Zeilen)

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
| `backend/src/features/telnet/telnet-client.ts` | Erweitert | GMCP-Handler, Error-Handling, Happy-Eyeballs-Fix |
| `backend/src/core/config/mud-config.service.ts` | **NEU** | Multi-MUD-Konfiguration (Singleton, JSON-File, Lookup) |
| `backend/src/core/config/mud-config.service.spec.ts` | **NEU** | 248 Zeilen Tests |
| `backend/src/core/middleware/use-mud-config-endpoint.ts` | **NEU** | REST `/api/mud-config` Endpoint |
| `backend/src/core/sockets/socket-manager.ts` | Erweitert | GMCP-Forwarding, Core.BrowserInfo-Enrichment, CORS |
| `backend/src/core/sockets/extract-real-ip.spec.ts` | **NEU** | Tests für Real-IP-Extraktion |
| `backend/src/core/environment/environment.ts` | Erweitert | `mudConfigPath`, Telnet-Host/Port als Fallback |
| `backend/src/main.ts` | Erweitert | MudConfigService-Init, useMudConfigEndpoint |

### 3.3 Frontend — GMCP-Kern

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `features/gmcp/gmcp.service.ts` | **NEU** | Zentraler GMCP-Service: Registry, Routing, Observable, Send, Core.Hello, Core.Supports.Set |
| `features/gmcp/gmcp-module-handler.ts` | **NEU** | Strategy-Interface für GMCP-Module |
| `features/gmcp/gmcp-event.ts` | **NEU** | Event-Typ für Observable-Stream |
| `features/gmcp/gmcp-bootstrap.service.ts` | **NEU** | APP_INITIALIZER: Registriert alle 8 GMCP-Handler |

### 3.4 Frontend — GMCP Core

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `features/gmcp-core/core-gmcp-handler.ts` | **NEU** | Core.Ping (Latenz-Messung, Toggle), Core.Goodbye (Cleanup, GMCP-Reset) |
| `features/gmcp-core/core-gmcp-handler.spec.ts` | **NEU** | 109 Zeilen Tests |

### 3.5 Frontend — GMCP Sound

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `features/gmcp-sound/sound-gmcp-handler.ts` | **NEU** | HTML5 Audio API, Base-URL + Event-Playback, Toggle-Menü |
| `features/gmcp-sound/sound-gmcp-handler.spec.ts` | **NEU** | 168 Zeilen Tests |

### 3.6 Frontend — GMCP Char

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `features/gmcp-char/char-gmcp-handler.ts` | **NEU** | Char.Name/StatusVars/Status/Vitals/Stats/Items.* Handler |
| `features/gmcp-char/char-gmcp-handler.spec.ts` | **NEU** | 339 Zeilen Tests |
| `features/gmcp-char/character-data.ts` | **NEU** | Typen + Parsing (Vitals, Stats) |
| `features/gmcp-char/character-data.spec.ts` | **NEU** | 150 Zeilen Tests |
| `features/gmcp-char/char-statusbar.component.ts` | **NEU** | Statusleiste: HP/SP, Stats, Status (ARIA) |
| `features/gmcp-char/inventory-data.ts` | **NEU** | Kategorisierte Inventarverwaltung |
| `features/gmcp-char/inventory-data.spec.ts` | **NEU** | 131 Zeilen Tests |
| `features/gmcp-char/inventory.component.ts` | **NEU** | Inventar-Fenster (Modeless Window) |

### 3.7 Frontend — GMCP Files

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `features/gmcp-files/files-gmcp-handler.ts` | **NEU** | Files.URL, DirectoryList, OpenFile/ChDir, Save-Workflow (Bug-Fix: `completeSave`) |
| `features/gmcp-files/files.service.ts` | **NEU** | HTTP Load/Save, FileInfo-Registry |
| `features/gmcp-files/dirlist.component.ts` | **NEU** | Verzeichnis-Browser (reagiert auf `DataChanged`) |
| `features/gmcp-files/editor.component.ts` | **NEU** | ACE-Editor + `ext-searchbox` + Keyboard-Propagation-Fix |
| `features/gmcp-files/file-types.ts` | **NEU** | Typen: FileInfo, FileEntry, Payloads |

### 3.8 Frontend — GMCP Input

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `features/gmcp-input/input-gmcp-handler.ts` | **NEU** | Tab-Completion: CompleteText, CompleteChoice, CompleteNone |
| `features/gmcp-input/input-gmcp-handler.spec.ts` | **NEU** | 73 Zeilen Tests |

### 3.9 Frontend — GMCP Numpad

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `features/gmcp-numpad/numpad-gmcp-handler.ts` | **NEU** | Numpad.SendLevel Handler, Keypad-Fenster |
| `features/gmcp-numpad/numpad-gmcp-handler.spec.ts` | **NEU** | 105 Zeilen Tests |
| `features/gmcp-numpad/keypad-data.ts` | **NEU** | Typisiertes Keypad-Datenmodell mit Modifier-Support |
| `features/gmcp-numpad/keypad.component.ts` | **NEU** | 3×3 Keypad-Grid-Widget |

### 3.10 Frontend — GMCP Comm

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `features/gmcp-comm/comm-gmcp-handler.ts` | **NEU** | Say/Soul/Tell als Observable-Stream |
| `features/gmcp-comm/comm-gmcp-handler.spec.ts` | **NEU** | 59 Zeilen Tests |

### 3.11 Frontend — GMCP Room

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `features/gmcp-room/room-gmcp-handler.ts` | **NEU** | Room.Info: Name, Domain, Exits, Browser-Titel-Update |
| `features/gmcp-room/room-gmcp-handler.spec.ts` | **NEU** | 70 Zeilen Tests |

### 3.12 Frontend — Menü-System

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `features/menu/menu-item.ts` | **NEU** | MenuItem-Interface (hierarchisch, ARIA-Attribute) |
| `features/menu/menu.service.ts` | **NEU** | Reaktiver Menü-Baum, dynamische Registrierung |
| `features/menu/menu.service.spec.ts` | **NEU** | 131 Zeilen Tests |
| `features/menu/menu-bar.component.ts` | **NEU** | Horizontale Menüleiste (Keyboard-Navigation, ARIA `menubar`) |
| `features/menu/menu-bar.component.scss` | **NEU** | Catppuccin Mocha Styling |
| `features/menu/menu-dropdown.component.ts` | **NEU** | Dropdown mit Submenü-Support |
| `features/menu/menu-dropdown.component.scss` | **NEU** | Styling |
| `features/menu/menu-bootstrap.service.ts` | **NEU** | Menü-Initialisierung: Ansicht, GMCP, Fenster |

### 3.13 Frontend — Farbeinstellungen

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `features/settings/color-settings.service.ts` | **NEU** | Farbpräferenzen, localStorage-Persistenz, xterm-Theme-Generator |
| `features/settings/color-settings.service.spec.ts` | **NEU** | 117 Zeilen Tests |
| `features/settings/color-settings.component.ts` | **NEU** | Modeless Dialog: Invertierung, B/W, Monochrom, Echo-Farbe |
| `features/settings/color-settings.component.scss` | **NEU** | Catppuccin Mocha Styling |

### 3.14 Frontend — Multi-MUD

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `features/mud-config/mud-config.service.ts` | **NEU** | Frontend MudConfigService: lädt `/api/mud-config`, Multi-MUD-Erkennung |
| `features/mud-config/mud-config.service.spec.ts` | **NEU** | 175 Zeilen Tests |
| `features/mud-config/mud-selector.component.ts` | **NEU** | Landing-Page mit MUD-Karten (ARIA, Keyboard) |
| `features/mud-config/mud-client-shell.component.ts` | **NEU** | Route-Shell: liest `:mudId`, reicht an MudClientComponent |

### 3.15 Frontend — Fenstersystem

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `features/windows/window-config.ts` | **NEU** | `WindowConfig`, `WindowEvent`, `WindowAction` (inkl. `DataChanged`) |
| `features/windows/window.service.ts` | **NEU** | Registry, Z-Index, Parent-Child, Event-Bus |
| `features/windows/window.component.ts` | **NEU** | Draggable + Resizable Window |
| `features/windows/window-container.component.ts` | **NEU** | Content-Routing inkl. `ColorSettingsComponent`, `KeypadComponent` |

### 3.16 Frontend — Routing + Integration

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `app/app.routes.ts` | **NEU** | Dynamische Routes: Multi-MUD → Selector + `:mudId`; Single-MUD → direkt Client |
| `app/app.component.ts` | Geändert | `<router-outlet>` statt statischem MudClient |
| `app/app.component.html` | Geändert | MenuBar + RouterOutlet |
| `main.ts` | Erweitert | Router, MudConfigService, MenuBootstrapService als Initializer |
| `features/sockets/sockets.service.ts` | Erweitert | `connectToMud(viewport, mudId?)`, GMCP-Send-Function |
| `core/mud/services/mud.service.ts` | Erweitert | `connect(viewport, mudId?)` |
| `core/mud/components/mud-client/mud-client.component.ts` | Erweitert | `@Input() mudId`, Tab-Completion, Live-Theme, GMCP-Bindings |
| `features/terminal/mud-input.controller.ts` | Erweitert | Tab-Key-Handler, `replaceCurrentWord()`, `setTabCompleteHandler()` |

### 3.17 Deployment

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `angular.json` | Erweitert | Build-Configs: `production-unitopia`, `production-seifenblase` |
| `environments/environment.prod.uni.ts` | **NEU** | UNItopia-Produktion (origin-basiert) |
| `environments/environment.prod.sb.ts` | **NEU** | Seifenblase-Produktion (origin-basiert) |
| `dockerfiles/w3_docker_compose.yml` | Migriert | u3-Env-Vars: `MUD_CONFIG_PATH`, `SOCKET_ROOT`, `CORS_ALLOWED_ORIGINS` |
| `dockerfiles/w3_docker_compose_sb.yml` | Migriert | Seifenblase-spezifisch |
| `dockerfiles/w3_docker_compose_local.yml` | Migriert | Lokal mit `host.docker.internal` |
| `dockerfiles/w3_docker_compose_test.yml` | Migriert | UNItopia Test |
| `dockerfiles/w3_docker_compose_test_neu.yml` | Migriert | UNItopia Test (tagged image) |
| `dockerfiles/w3_docker_compose_secret.yml` | Migriert | TLS-Secrets |
| `dockerfiles/w3_docker_compose_with_apache.yml` | Migriert | Apache Reverse Proxy |
| `dockerfiles/README.md` | Neugeschrieben | Env-Var-Referenz, Build-Befehle, Deployment-Übersicht |

---

## 4. Architektur

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
  │ 8 Handler: Core, Char, Sound, Files, Input, Numpad, Comm, Room
  ▼
UI Components (via BehaviorSubject / WindowService / Observable)
```

### 4.2 GMCP Handshake-Sequenz

```
1. Backend: TelnetClient verhandelt GMCP-Option (IAC DO/WILL)
2. Backend: Emittiert 'gmcpStart' mit GmcpSupport-Config
3. Frontend: GmcpService.handleGmcpStart()
   a. Sendet Core.Hello { client: 'WebMud3', version: '0.7.0' }
   b. Sendet Core.Supports.Set mit allen unterstützten Modulen + Versionen
   c. Aktiviert alle registrierten Handler
4. MUD antwortet mit Core.Hello und beginnt GMCP-Nachrichten zu senden
```

### 4.3 GMCP Module Registry

```
GmcpBootstrapService (APP_INITIALIZER)
  │
  ├── CoreGmcpHandler     → Core.Ping, Core.Goodbye
  ├── CharGmcpHandler      → Char.Name/StatusVars/Status/Vitals/Stats/Items.*
  ├── SoundGmcpHandler     → Sound.Url, Sound.Event
  ├── FilesGmcpHandler     → Files.URL, Files.DirectoryList
  ├── InputGmcpHandler     → Input.CompleteText/Choice/None
  ├── NumpadGmcpHandler    → Numpad.SendLevel
  ├── CommGmcpHandler      → Comm.Say/Soul/Tell
  └── RoomGmcpHandler      → Room.Info
```

### 4.4 Multi-MUD-Routing

```
App Bootstrap
  │
  ├── MudConfigService.load() → GET /api/mud-config
  │     │
  │     ├── isMultiMud = true  →  Routes: "/" = MudSelectorComponent
  │     │                                  "/:mudId" = MudClientShellComponent
  │     │
  │     └── isMultiMud = false →  Routes: "/" = MudClientShellComponent (kein Selector)
  │
  ▼
MudClientShellComponent
  │ Liest :mudId aus ActivatedRoute
  │ Übergibt an MudClientComponent via @Input()
  ▼
MudClientComponent → MudService → SocketsService
  │ socket.emit('mudConnect', viewport, sessionToken, mudId)
  ▼
Backend: SocketManager.resolveConnectionParams(mudId)
  │ Priority: mudId → MudConfigService → Fallback TELNET_HOST/PORT
```

### 4.5 Menü-System

```
MenuBootstrapService (APP_INITIALIZER)
  │
  ├── "Ansicht" → Farbeinstellungen…, Ping senden
  ├── "GMCP"    → Dynamisch aus Handler-Beiträgen (z.B. Sound Toggle)
  └── "Fenster" → Alle schließen, + dynamische Fensterliste
  │
  ▼
MenuBarComponent → MenuDropdownComponent (Standalone, ARIA menubar/menu)
  │ Keyboard: Arrow-Keys, Enter, Escape
  │ Styling: Catppuccin Mocha
```

### 4.6 Fenstersystem

```
WindowService (Registry, Z-Index, Events)
  │
  ▼
WindowContainerComponent (Fixed Overlay, @for + @switch)
  │
  ├── @case 'DirlistComponent'         → DirListComponent
  ├── @case 'EditorComponent'          → EditorComponent
  ├── @case 'InventoryComponent'       → InventoryComponent
  ├── @case 'ColorSettingsComponent'   → ColorSettingsComponent
  └── @case 'KeypadComponent'          → KeypadComponent
```

---

## 5. Umgebungsvariablen (Backend)

| Variable | Pflicht | Default | Beschreibung |
|----------|---------|---------|-------------|
| `HOST` | Nein | `0.0.0.0` | IP-Adresse des Backends |
| `PORT` | Nein | `5000` | Port des Backends |
| `TELNET_HOST` | Ja* | `localhost` | MUD-Server Hostname |
| `TELNET_PORT` | Ja* | `23` | MUD-Server Port |
| `TELNET_TLS` | Nein | `false` | TLS für Telnet |
| `SOCKET_ROOT` | Ja | `/socket.io` | Socket.IO Pfad |
| `SOCKET_TIMEOUT` | Nein | `900000` | Session-Timeout (ms) |
| `MUD_CONFIG_PATH` | Nein | – | Pfad zur `mud_config.json` für Multi-MUD |
| `CORS_ALLOWED_ORIGINS` | Nein | – | Komma-separierte Origins |
| `LOG_LEVEL` | Nein | `debug` | Winston Log-Level |
| `ENVIRONMENT` | Nein | `production` | `production` oder `development` |
| `NAME` | Nein | `webmud3b` | Client-Name für MUD |

*Pflicht nur wenn `MUD_CONFIG_PATH` nicht gesetzt ist.

---

## 6. Angular Build-Konfigurationen

| Konfiguration | Environment-File | Zweck |
|--------------|-----------------|-------|
| `(default)` | `environment.ts` | Lokale Entwicklung (`localhost:5000`) |
| `production` | `environment.prod.ts` | Generisch (`window.location.href`) |
| `production-unitopia` | `environment.prod.uni.ts` | UNItopia (`window.location.origin`) |
| `production-seifenblase` | `environment.prod.sb.ts` | Seifenblase (`window.location.origin`) |

---

## 7. Socket.IO Events

| Event | Richtung | Parameter | Beschreibung |
|-------|----------|-----------|-------------|
| `mudConnect` | Client → Server | `viewport`, `token`, `mudId?` | MUD-Verbindung herstellen (mit optionalem mudId) |
| `mudGmcpOutgoing` | Client → Server | `module`, `message`, `data` | GMCP an MUD senden |
| `mudGmcpIncoming` | Server → Client | `module`, `message`, `data` | GMCP vom MUD empfangen |
| `mudGmcpStart` | Server → Client | `gmcpSupport: GmcpSupport` | GMCP ausgehandelt |

---

## 8. REST-Endpoints

| Endpoint | Methode | Beschreibung |
|----------|---------|-------------|
| `/api/config` | GET | Socket-Namespace-Konfiguration |
| `/api/mud-config` | GET | MUD-Liste und Routes (Multi-MUD-Auswahl) |

---

## 9. Test-Abdeckung

| Feature | Spec-Datei | Zeilen | Phase |
|---------|-----------|--------|-------|
| GMCP-Handler (Backend) | `handle-gmcp-option.spec.ts` | 225 | Basis |
| MudConfigService (Backend) | `mud-config.service.spec.ts` | 248 | Basis |
| extractRealIp | `extract-real-ip.spec.ts` | 82 | Basis |
| WindowService | `window.service.spec.ts` | 229 | Basis |
| SoundGmcpHandler | `sound-gmcp-handler.spec.ts` | 168 | Basis |
| CharGmcpHandler | `char-gmcp-handler.spec.ts` | 339 | Basis |
| CharacterData | `character-data.spec.ts` | 150 | Basis |
| InventoryData | `inventory-data.spec.ts` | 131 | Basis |
| FilesService | `files.service.spec.ts` | 158 | Basis |
| FileTypes | `file-types.spec.ts` | 22 | Basis |
| MudInputController | `mud-input.controller.spec.ts` | 103 | Basis |
| MudPromptManager | `mud-prompt.manager.spec.ts` | 714 | Basis |
| MudScreenReaderAnnouncer | `mud-screenreader.spec.ts` | 173 | Basis |
| CoreGmcpHandler | `core-gmcp-handler.spec.ts` | 109 | Phase 1 |
| MenuService | `menu.service.spec.ts` | 131 | Phase 2 |
| ColorSettingsService | `color-settings.service.spec.ts` | 117 | Phase 2 |
| InputGmcpHandler | `input-gmcp-handler.spec.ts` | 73 | Phase 3 |
| NumpadGmcpHandler | `numpad-gmcp-handler.spec.ts` | 105 | Phase 3 |
| CommGmcpHandler | `comm-gmcp-handler.spec.ts` | 59 | Phase 3 |
| RoomGmcpHandler | `room-gmcp-handler.spec.ts` | 70 | Phase 3 |
| MudConfigService (Frontend) | `mud-config.service.spec.ts` | 175 | Phase 4 |

**Gesamt: ~3.581 Test-Zeilen (18 Spec-Dateien)**

---

## 10. Design Patterns

| Pattern | Verwendung |
|---------|-----------|
| **Strategy** | `GmcpModuleHandler`-Interface — 8 austauschbare Handler |
| **Registry/Service-Locator** | `GmcpService.moduleRegistry` — dynamische Modul-Registrierung |
| **Observer/Observable** | `gmcpEvent$`, `gmcpStart$`, `characterData$`, `inventory$`, `windows$`, `settings$`, `menuItems$`, `completionResult$`, `roomInfo$`, `commMessage$` |
| **Singleton** | `MudConfigService.getInstance()` (Backend), `Environment.getInstance()` |
| **Event Bus** | `WindowService.incomingEvents$` / `outgoingEvents$` |
| **Factory** | `handleGmcpOption()`, `buildAppRoutes()` |
| **Adapter** | `MudSocketAdapter`, GMCP-Send-Function-Injection |
| **Parent-Child** | `WindowConfig.parentWindowId` — DirList → Editor-Fenster |
| **Shell/Wrapper** | `MudClientShellComponent` — Route-Parameter → Component-Input |

---

## 11. GMCP Implementierungsstatus

### Vollständig implementiert (✅)

| Modul | Nachrichten | Richtung |
|-------|-----------|----------|
| Core | Hello, Supports.Set/Add/Remove, Ping, Goodbye | Bidirektional |
| Char | Name, StatusVars, Status, Vitals, Stats | MUD → Client |
| Char.Items | List, Add, Remove | MUD → Client |
| Sound | Url, Event | MUD → Client |
| Files | URL, DirectoryList | MUD → Client |
| Files | OpenFile, ChDir, fileSaved | Client → MUD |
| Input | Complete | Client → MUD |
| Input | CompleteText, CompleteChoice, CompleteNone | MUD → Client |
| Numpad | SendLevel | MUD → Client |
| Numpad | Update, GetAll | Client → MUD |
| Comm | Say, Soul, Tell | MUD → Client |
| Room | Info | MUD → Client |

### Nicht implementiert / Offen

| Modul | Nachricht | Anmerkung |
|-------|----------|-----------|
| Char | Login | Serverseitig noch nicht verfügbar |
| Char.Items | Inv (Request) | Client → MUD Inventar-Anfrage |
| Numpad | GetLevel | Level-spezifische Abfrage |

---

## 12. Bekannte Probleme und offene Punkte

### 12.1 Fehlend gegenüber `develop` (HEAD)

| Feature | develop PR/Branch | Status | Aufwand |
|---------|------------------|--------|---------|
| Reconnect-Fix (`forceNew`, Transport-Fallback) | PR #170 / `origin/fix/reconnection` | **Portierbar** | Niedrig |
| WCAG AAA Web-Colors (`minimumContrastRatio: 7`) | PR #162 / `origin/feat/web-colors` | **Trivial** (1 Zeile) | Minimal |
| Cancelable Screenreader (Echo-Suppression, Queue) | PR #172 / `origin/feat/cancelable-screenreader` | **Manuell portierbar** | Mittel-Hoch |
| Docker Local Test Setup | PR #173 / `origin/docker-tests` | **Entfällt** (u3 hat eigenes Setup) | – |

**Hinweis:** Diese PRs wurden gegen die alte u1-Architektur geschrieben. Cherry-Pick ist nicht möglich; die Konzepte müssen manuell portiert werden.

### 12.2 Offene TODOs im Code

- **Completion-Overlay**: `mud-client.component.ts` hat `TODO: Show completion overlay` für `CompleteChoice`-Ergebnisse (aktuell Console-Log)
- **Char.Items.Inv**: Client→MUD Request-Nachricht nicht implementiert
- **Numpad.GetLevel**: Level-spezifische Abfrage nicht implementiert
- **MUD-Wechsel im Menü**: Kein Menü-Eintrag für Navigation zwischen MUDs

### 12.3 Gelöste Probleme (seit V1 der Analyse)

- ✅ `GMCP.md` Dokumentation aktualisiert (war: alles als `[ ]` markiert)
- ✅ `Core.Goodbye` implementiert (war: fehlte)
- ✅ `Core.Hello` + `Core.Supports.Set` Handshake implementiert (war: fehlte)
- ✅ `Core.Ping` mit Latenz-Messung und Toggle (war: fehlte)
- ✅ `FilesGmcpHandler.completeSave()` Bug gefixt (war: toter Code)
- ✅ `WindowAction.DataChanged` statt Missbrauch von `Resize` (war: Bug)
- ✅ Menü-System implementiert (war: fehlte)
- ✅ Farbeinstellungen implementiert (war: fehlte)
- ✅ Input-Completion implementiert (war: fehlte)
- ✅ Numpad/Keypad implementiert (war: fehlte)
- ✅ Comm-Modul implementiert (war: fehlte)
- ✅ Room.Info implementiert (war: fehlte)
- ✅ Editor-Suche funktioniert via ACE (war: fehlte)
- ✅ Multi-MUD Frontend UI mit Angular Router (war: fehlte)
- ✅ Multi-Deployment Docker Compose migriert (war: veraltet)

---

## 13. Zusammenfassung: Migrations-Reifegrad

| Bereich | Reifegrad | Anmerkung |
|---------|-----------|-----------|
| **GMCP Backend (Negotiation + Forwarding)** | ✅ Fertig | Vollständig mit Tests, Error-Handling |
| **Multi-MUD Backend** | ✅ Fertig | MudConfigService, REST-API, Fallback |
| **GMCP Frontend (Core Service)** | ✅ Fertig | Strategy Pattern, 8 Handler, Bootstrap |
| **GMCP Core (Hello/Supports/Ping/Goodbye)** | ✅ Fertig | Automatischer Handshake, Latenz-Messung |
| **GMCP Sound** | ✅ Fertig | HTML5 Audio, Toggle |
| **GMCP Char (Statusleiste + Inventar)** | ✅ Fertig | HP/SP/Stats, Kategorien, ARIA |
| **GMCP Files (DirList + Editor)** | ✅ Fertig | Save-Workflow-Bug behoben, Suche via Ctrl+F |
| **GMCP Input (Tab-Completion)** | ✅ Fertig | CompleteText/Choice/None |
| **GMCP Numpad (Keypad-Widget)** | ✅ Fertig | 3×3 Grid, Modifier, MUD-synchron |
| **GMCP Comm (Chat)** | ✅ Fertig | Observable-Stream (minimal) |
| **GMCP Room (Info)** | ✅ Fertig | Browser-Titel-Update |
| **Menü-System** | ✅ Fertig | Eigenentwicklung, 3-Level, ARIA, Keyboard |
| **Farbeinstellungen** | ✅ Fertig | Invertierung, B/W, Monochrom, xterm-Theme |
| **Fenstersystem** | ✅ Fertig | Drag, Resize, Parent-Child, 5 Fenstertypen |
| **Multi-MUD Frontend** | ✅ Fertig | Selector, Router, mudId-Passing |
| **Multi-Deployment** | ✅ Fertig | 4 Environments, 7 Docker Compose, README |
| **develop-PRs (#170, #162, #172)** | ⚠️ Portierbar | Manuell, nicht cherry-pickbar |
| **Auth/RPC (Phase 5)** | ❌ Gestrichen | Experimentell, nicht priorisiert |
| **GMCP.md Dokumentation** | ✅ Aktuell | Alle Module korrekt markiert |

---

## 14. Vergleich V1 → V2

| Metrik | V1 (be4f4cf) | V2 (5f85380) | Delta |
|--------|-------------|-------------|-------|
| Migrations-Commits | 15 | 25 | +10 |
| Geänderte/Neue Dateien | 62 | 132 | +70 |
| Code-Zeilen (netto) | +6.660 | +14.251 | +7.591 |
| GMCP-Handler (Frontend) | 3 | 8 | +5 |
| Test-Spec-Dateien | 10 | 18 | +8 |
| Test-Zeilen (gesamt) | ~1.752 | ~3.581 | +1.829 |
| Offene "Fehlt"-Einträge | 12 | 3 | −9 |
| Fenstertypen | 3 | 5 | +2 |
| UI-Eigenentwicklungen | 0 | 2 (Menü, Farbdialog) | +2 |
| Angular Routes | 0 | 2 (Selector, Client) | +2 |
| Docker Compose (migriert) | 0 | 7 | +7 |
| Environment-Files | 2 | 4 | +2 |
