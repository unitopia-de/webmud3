# GMCP support of WEbmud3 (to be snychronized with project)

In UNItopia there is now more modules and messages supported, here now following the status:
### Module Core, MUD => Client
- [x]  Core.Ping: Fully Implemented with a button for GMCP-Ping.
- [ ]  Core.Goodbye (Parameter "goodbye-message"): Partially Implemented. E.g. useful for recycle ressources.
### Module Core, Client => MUD
- [x]  Core.Hello: Implemented, e.g. { client: 'Webmud3', version: 'v0.0.24' }
- [ ]  Core.Supports.Set/Add/Remove: A flexible configuration is needed in the Webmud3, so that only modules are active, which are also shown.
- [x]  Core.Ping implemented: request ping back from server.
### Module Char: MUD => Client
- [ ]  Char.Name  { "name": "Leo", "fullname": "Leo, der Goetterbote", "gender": "maennlich" }
- [ ]  Char.StatusVars { "race": "Rasse", "guild": "Gilde", "rank": "Gildenrang" }
- [ ]  Char.Status { "race": "Mensch", "guild": "Bardengilde", "rank": "Bannsaenger" }
- [ ]  Char.Vitals { "hp": 100, "maxhp": 150, "sp": "120", "maxsp": 120, "string": "AP:100/150 ZP:120/120" }
- [ ]  Char.Stats { "str": 85, "int": 100, "con": 80, "dex": 98 }
### Module Char: Client => MUD
- [ ]  Char.Login to be implemented in UNItopia first.
### Modul Char.Items MUD => Client (Inventory)
- [ ]  Char.Items.List { "location": "inv", "items": [ { "name": "Ein Gummigoettchen", "category": "Nahrung" } ] }
- [ ]  Char.Items.Add { "location": "inv", "item": { "name": "Ein Gummigoettchen", "category": "Nahrung" } }
- [ ]  Char.Items.Remove { "location": "inv", "item": { "name": "Ein Gummigoettchen", "category": "Nahrung" } }
### Modul Char.Items: Client => MUD (Inventory)
- [ ]  Char.Items.Inv  TODO: request on partial refresh...
### Modul Comm

### Modul Numpad MUD => Client
- [ ] Numpad.SendLevel { "prefix":"", "keys": { 'Numpad7': "nordwesten", ... }}
### Modul Numpad Client => MUD
- [ ] Numpad.Update( "prefix":"", "key":"Numpad7", "value": "nordwesten" }
- [ ] Numpad.GetAll
- [ ] Numpad.GetLevel { "prefix":"" }

### Module Status:
- [ ] Core 90%
- [ ] Char
- [ ]  Char.Items
