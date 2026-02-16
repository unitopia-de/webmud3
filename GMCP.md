# GMCP support of WebMud3 (to be synchronized with project)

* UNItopia support: https://github.com/unitopia-de/client-plugins/wiki/GMCP

In UNItopia there is now more modules and messages supported, here now following the status:

### Module Core, MUD => Client
- [x]  Core.Ping: Fully Implemented with visual toggle + latency measurement.
- [x]  Core.Goodbye (Parameter "goodbye-message"): Implemented. Resets GMCP state, closes windows.

### Module Core, Client => MUD
- [x]  Core.Hello: Implemented, e.g. { client: 'WebMud3', version: '0.7.0' }
- [x]  Core.Supports.Set/Add/Remove: Automatic Set on GMCP start, Add/Remove for dynamic modules.
- [x]  Core.Ping implemented: request ping back from server.

### Module Char: MUD => Client
- [x]  Char.Name  { "name": "Leo", "fullname": "Leo, der Goetterbote", "gender": "maennlich" }
- [x]  Char.StatusVars { "race": "Rasse", "guild": "Gilde", "rank": "Gildenrang" }
- [x]  Char.Status { "race": "Mensch", "guild": "Bardengilde", "rank": "Bannsaenger" }
- [x]  Char.Vitals { "hp": 100, "maxhp": 150, "sp": "120", "maxsp": 120, "string": "AP:100/150 ZP:120/120" }
- [x]  Char.Stats { "str": 85, "int": 100, "con": 80, "dex": 98 }

### Module Char: Client => MUD
- [ ]  Char.Login to be implemented in UNItopia first.

### Modul Char.Items MUD => Client (Inventory)
- [x]  Char.Items.List { "location": "inv", "items": [ { "name": "Ein Gummigoettchen", "category": "Nahrung" } ] }
- [x]  Char.Items.Add { "location": "inv", "item": { "name": "Ein Gummigoettchen", "category": "Nahrung" } }
- [x]  Char.Items.Remove { "location": "inv", "item": { "name": "Ein Gummigoettchen", "category": "Nahrung" } }

### Modul Char.Items: Client => MUD (Inventory)
- [ ]  Char.Items.Inv  TODO: request on partial refresh...

### Module Sound: MUD => Client
- [x]  Sound.Url: Base URL for sound files
- [x]  Sound.Event: Play sound file via HTML5 Audio API

### Module Files: MUD => Client
- [x]  Files.URL: Open file in editor
- [x]  Files.DirectoryList: Show directory listing

### Module Files: Client => MUD
- [x]  Files.OpenFile: Open or save a file
- [x]  Files.ChDir: Change directory
- [x]  Files.fileSaved: Notify save complete

### Module Input: MUD => Client
- [x]  Input.CompleteText: Single completion result
- [x]  Input.CompleteChoice: Multiple choice completion
- [x]  Input.CompleteNone: No completion available

### Module Input: Client => MUD
- [x]  Input.Complete: Request tab-completion for current word

### Modul Comm: MUD => Client
- [x]  Comm.Say / Comm.Soul / Comm.Tell: Received and published on observable stream

### Modul Room: MUD => Client
- [x]  Room.Info: Room name, domain, exits. Updates browser title.

### Modul Numpad MUD => Client
- [x] Numpad.SendLevel { "prefix":"", "keys": { 'Numpad7': "nordwesten", ... }}

### Modul Numpad Client => MUD
- [x] Numpad.Update { "prefix":"", "key":"Numpad7", "value": "nordwesten" }
- [x] Numpad.GetAll
- [ ] Numpad.GetLevel { "prefix":"" }

### Module Status:
- [x] Core (Hello, Supports.Set, Ping, Goodbye)
- [x] Char (Name, StatusVars, Status, Vitals, Stats)
- [x] Char.Items (List, Add, Remove)
- [x] Sound (Url, Event)
- [x] Files (URL, DirectoryList, OpenFile, ChDir, fileSaved)
- [x] Input (Complete, CompleteText, CompleteChoice, CompleteNone)
- [x] Comm (Say, Soul, Tell)
- [x] Room (Info)
- [x] Numpad (SendLevel, Update, GetAll)
