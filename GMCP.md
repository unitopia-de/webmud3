# GMCP support of Webmud3

* UNItopia support: https://github.com/unitopia-de/client-plugins/wiki/GMCP

In UNItopia there is now more modules and messages supported, here now following the status:

### by module/message
#### CORE
- [x]  Core.Ping
    - [x]  Client=>MUD: Ping request from webmud3 menu to MUD
    - [x]  MUD=>Client: Response from MUD to client.
- [ ]  Core.Goodbye (Parameter "goodbye-message")
    - [x]  MUD=>Client: Logoff process in progress.
    - [ ]  Webmud3 Client-Implementation missing for correct resource handling
- [x]  Core.Hello
    - [x]  MUD=>Client: Core.Hello { "name": "UNItopia" }
    - [x]  Client=>MUD:  Core.Hello { "client": "WebMud3","version":"v0.6" }
- [x]  Core.Supports
    - [ ]  MUD=>Client: Core.Supports.List ???
    - [x]  Client=>MUD: Core.Supports.Set \[ "Char 1","Sound 1" \]
    - [x]  Client=>MUD: Core.Supports.Add \[ "Char 1","Sound 1" \]
    - [x]  Client=>MUD: Core.Supports.Remove \[ "Char 1","Sound 1" \]
#### Char (Chacter)
- [ ]  MUD=>Client: Char.Name  { "name": "Leo", "fullname": "Leo, der Goetterbote", "gender": "maennlich" }
    - [x]  Sent by UNItopia once at logon (and on changes?)
    - [ ]  Not shown/processed yet in WebMud3
- [ ]  MUD=>Client: Char.StatusVars { "race": "Rasse", "guild": "Gilde", "rank": "Gildenrang" }
    - [x]  Sent by UNItopia once at logon, defines naming conventoion for status
    - [ ]  Not shown/processed yet in WebMud3
- [ ]  MUD=>Client: Char.Status { "race": "Mensch", "guild": "Bardengilde", "rank": "Bannsaenger" }
    - [x]  Sent by UNItopia on logon and on changes shows current Status of characer.
    - [ ]  Not shown/processed yet in WebMud3
- [ ]  (?) MUD=>Client: Char.VitalsVars sent once on logon define shown vitals
- [ ]  MUD=>Client: Char.Vitals { "hp": 100, "maxhp": 150, "sp": "120", "maxsp": 120, "string": "AP:100/150 ZP:120/120" }
    - [x]  Sent by UNItopia on changes shows current vital values of characer.
    - [ ]  Not shown/processed yet in WebMud3
- [ ]  (?) MUD=>Client: Char.StatsVars sent once on logon define shown Stats
- [ ]  MUD=>Client: Char.Stats { "str": 85, "int": 100, "con": 80, "dex": 98 }
    - [x]  Sent by UNItopia on changes shows current vital values of characer.
    - [ ]  Not shown/processed yet in WebMud3
- [x]  Client=MUD: Core.BrowserInfo (from webmud3-backend to Mud)
- [ ]  Client=>MUD: Char.Login
    - Concept: From a characterdashboard get jwt-Token from backend/dbus
    - Concept: user charactername plus token to sent via gmcp prior to logon.
    - [ ]  Char.Login and getLoginToken to be implemented in UNItopia first.

#### Char.Items (Inventory of Character) V1 (imlemtend on unitopia side!)
- [ ]  MUD=>Client: Char.Items.List { "location": "inv", "items": [ { "name": "Ein Gummigoettchen", "category": "Nahrung" } ] }
- [ ]  MUD=>Client: Char.Items.Add { "location": "inv", "item": { "name": "Ein Gummigoettchen", "category": "Nahrung" } }
- [ ]  MUD=>Client: Char.Items.Remove { "location": "inv", "item": { "name": "Ein Gummigoettchen", "category": "Nahrung" } }
- [ ]  Client=>MUD: Char.Items.Inv  request on partial refresh...
#### Char.Items (Inventory of Character) V2 (under design)
- [ ]  MUD=>Client: Char.Items.List { "location": "inv", "items": [ { "name": "Ein Gummigoettchen", "category": "Nahrung" } ] }
- [ ]  MUD=>Client: Char.Items.Add { "location": "inv", "item": { "name": "Ein Gummigoettchen", "category": "Nahrung" } }
- [ ]  MUD=>Client: Char.Items.Remove { "location": "inv", "item": { "name": "Ein Gummigoettchen", "category": "Nahrung" } }
- [ ]  Client=>MUD: Char.Items.Inv  TODO: request on partial refresh or sub container...
#### Modul Numpad 
- [x]  MUD=>Client: Numpad.SendLevel { "prefix":"", "keys": { 'Numpad7': "nordwesten", ... }}
- [x]  Client=>MUD: Numpad.Update( "prefix":"", "key":"Numpad7", "value": "nordwesten" } => numpad_update
- [x]  Client=>MUD: Numpad.GetAll => numpad_send_all
- [x]  Client=>MUD: Numpad.GetLevel { "prefix":"" } => numpad_send_level
#### Modul Sound
- [x]  MUD=>Client: Sound.Url (base url to get alls ounds relative to this url for this mud)
- [x]  MUD=>Client: Sound.Event (file:soundpath)
#### Module Input
- [x]  Client=>MuD: Input.complete request input completion with proposal string
- [x]  MUD=>Client: Input.CompleteText return full text
- [x]  MUD=>Client: Input.CompleteChoice return choice if wiz level
- [x]  MUD=>Client: Input.CompleteNone return no result
#### Module Files
- [x]  MUD=>Client: Files.DirectoryList (init and on any change dir)
- [x]  Client=>MUD: Files.ChDir change dir by client/click
- [x]  Client=>MUD: Files.OpenFile open file for reading or editing
- [x]  Mud=>Client: Files.url
- [x]  Mud=>Client: Files.currentpath
- [x]  Client=>MUD: Files.FileSaved  => gmcp_edit_saved
- [x]  Client=>MUD: Files.FileCanceled  => gmcp_edit_drop_tempfile
- [x]  gmcp_get_jwt/get_jwt(string filepath)
- [x]  gmxp_send_files_url, gmcp_start_edit, uses_gmcp_edit
#### Module Room
- [x]  MUD=>Client Room.Info(name,domain,exits)
### Modul Comm 
- [x]  MUD=>Client: Comm.Say (player (source),text:msg)
- [x]  MUD=>Client: Comm.Soul (player (source),text:msg)
- [x]  MUD=>Client: Comm.Tell (player (source),text:msg)

