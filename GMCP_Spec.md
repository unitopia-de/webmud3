# GMCP-Specification

## Introduction
This specification is for Webmud3 Implementation and the first mud specific version will be UNItopia.

We will crosscheck with the [Mudlet Standards](https://wiki.mudlet.org/w/Standards:MUD_Client_Media_Protocol).


## Overview of the GMCP (201) Sub-negotiation Protocol (from Mudlet Standards)
To recap, the GMCP protocol is a bidirectional telnet sub-negotiation protocol (See RFC 854) which fulfills the following conditions:

* GMCP is separated into several ‘namespaces’, which may be enabled or disabled by the client at any time. The ‘Core’ namespace is always enabled and may not be disabled. Namespaces should consist of case-insensitive alphabetical characters and stop characters (. - ASCII 46/0x2E), representable as \[A-Za-z.\].
* GMCP messages consist of the namespace and a command (case insensitive alpha characters) delineated by a stop character, and optionally a space character and JSON-encoded payload.
* GMCP messages may be sent by both the client or server at any time with no warning.

## Modules

### `Core`-Module (always present)
The Core Module is always active and may not be deactivated. The implementation counter part in UNItopia is located in the `/i/player/gmcp.c`.

#### `Core.Supports` Submodule (Client=>MUD)
The Supports-Submodule of the module Core registers or unregisters modules from the client at the server.

##### `Core.Supports.Set` and `Core.Supports.Add` (Client=>MUD)
* Set set all modules, deactivating the previous modules, if applicable
* Add is adding some modules
* The payload is a String Array in json
* Each String consists of the module name (e.g. Sound) and a version specific to the mud(Server).
* Please note, that an newly added module can send an initialisation message after activation via Set or Add.

##### `Core.Supports.Remove` (Client=>MUD)
* Removes packages from the active modules
* Payload is an array of Strings each for one module name without version

#### `Core.Browserinfo` (Webmud3-Backend => MUD Server)
The browserinfo is sent at the beginning of a new connection. The payload is json Object with the following informations:
* real_ip (determined by the backend and only accepted, if webmud3 is running on the same server as the mud)
Following infos are kept within the player:
* browser,brower_version
* os, os_version
* useragent
* ismobile,istablet,isdesktop
* client, version, clientID, clientType

#### `Core.Hello` (MUD => Client => MUD)
* After initialisation of gmcp, the mud is sending Core.Hello `{"name":MUD_NAME}`.
* the Mud Name can be used together with the char.name in the title of the webmud3 tab.
* The response from the client is currently ignored by the UNItopia mudlib.

#### `Core.Ping` (Client => MUD => Client)
* If the server is receiving a Core.Ping signal (no payload) the server responses with a Core.Ping (without payload also). The frontend might measure the round trip time.

#### `Core.GoodBye` (MUD=>Client)
* before ending the connection a Core.Goodbye is sent.

### The Module `Input 1` (UNItopia)
* The client is sending (when e.g. TAB is pressed at the end of a partial input) An `input.complete <string>`.
* The Mud is answering either with `Input.CompleteText <string>` when one string is found
* or an `Input.CompleteChoice <string *>` if 2 ore more Possibilites are found and the player is a wizard
* or an `Input.CompleteNone` if nothing unique is found.

### The Module `Char 1`
* init: send Char.Name
#### Message `Char.Name` `{"name":?,"fullname":?,"gender":?,"wizard":?}`
* name and mudname can be used as title of the webmud3

#### Submodule `Char.Items`
##### During Initialisation 
* The initial items list is sent `Char.Items.List`
* and two controlers are setup to signal `Char.Items.Add` or `Char.Items.Remove`.

##### Message `Char.Items.List` (Client=>Mud) 
* requests another `Char.Items.List` from the Server.

##### Message `Char.Items.List` (Mud=>Client) 
* payload:
```
([
    "location": "inv",
    "items": map(obs, (:
      ([
         "name": $1->query_short(this_object()),
         "category": object_category($1)
      ]) 
    :))
])
```

##### Messages `Char.Items.Add` or `Char.Items.Remove` (MUD=>Client)
* have the payload:
```
([
    "location": "inv",
    "item": ([
      "name": ob->query_short(this_object()),
      "category": object_category(ob)
    ])
])
```

#### Message `Char.Statusvars` `{"race": "Rasse", "guild": "Gilde", "rank": "Gildenrang"}`
#### Message `Char.Status` `{"race":?,"guild":?,"rank":?})`
#### Messages `Char.Stats` and `Char.Vitals`
* Used in the statusbar
```
        process_gmcp(([
            "hp":       my_hp,
            "maxhp":    my_maxhp,
            "sp":       my_sp,
            "maxsp":    my_maxsp,
            "string":   hpsp_str,
            ]),"Char","Vitals");

    string lstr = PRINT_STAT(this_object()->query_stat(STAT_STR,1));
    string lint = PRINT_STAT(this_object()->query_stat(STAT_INT,1));
    string lcon = PRINT_STAT(this_object()->query_stat(STAT_CON,1));
    string ldex = PRINT_STAT(this_object()->query_stat(STAT_DEX,1));
    string lneu = lstr+"/"+lint+"/"+lcon+"/"+ldex;
    if (lneu != lstats) {
        lstats = lneu;
        process_gmcp(([
            "str": lstr,
            "int": lint,
            "con": lcon,
            "dex": ldex,
            ]),"Char","Stats");
    }
```

### The Module `Sound 1` (UNItopia)

#### During Initialisation: `Sound.Url` (MUD=>Client)
* Once the Sound module is activated, the MUD is sending the base url for all soundfiles.

#### `Sound.Event` (MUD=>Client)
* on a sound event the Message Sound.Event is sent with the payroll of an json object with the `{ file: filename }`.
* The client can load from the url and the filename the soundfile

### The module `Comm 1` (MUD => Client)
#### Comm.Say, Comm.Tell, Comm.Soul
```
([
    "player": verursacher || "-",
    "text":msg,
])
```

### The module `Room 1`
#### `Room.Info`
```
    send_gmcp("Room", "Info", ([
        "name":   env->query_short(),
        "domain": get_displayed_domain(env),
        "exits":  env->query_command_list(EXIT_VISIBLE),
    ]));

```

### The module `numpad 1` (UNItopia)
#### During Initialisation => numpad_sned_all => numpad_send_level()
#### Numpad.SendLevel (MUD=> Client) `{prefix:"",{key1:value1,...}}`
#### Numpad.getall (Client => MUD) => numpad_send_all
#### Numpad.getlevel (Client => MUD) => numpad_send_level
#### numpad.update (Client=> MUD) => numpad_update

### The module `Files 1` (UNItopia)
#### `Files.Openfile \{file:?,title:?,flag:?\}` (Client=>MUD)
#### `Files.FileCanceled {"file":path}` (Client=>MUD)
#### `Files.FileSaved {"file":path}` (Client=>MUD)
#### `Files.ChDir {"dir":path}` (Client=>MUD)
#### `Files.Currentpath \{path:dirpath\}` (MUD=>CLient)
#### `Files.DirectoryList`
```
#define MY_LIST_GMCP_DIR_CONTENT_HEADER ({"path","entries"})
#define MY_LIST_GMCP_DIR_CONTENT_ENTRIES ({"name","size",\
                                           "filedate","filetime","isdir"})
```
#### `Files.URL` (MUD=>Client)
```
    string url = lower_case(GMCP_FILES_BASE_URL) + gmcp_get_jwt(file);
    send_gmcp("Files", "URL", ([
        "url": url,
        "newfile": flag_newfile,
        "writeacl": flag_write_access,
        "saveactive": (flag&1)?1:0,
        "temporary":(strstr(file,"/var/spool/edit/"+TPRN+"_")==0),
        "filesize": fsize,
        "title":title||"",
        "file":file,
        "path":filedir[0],
        "filename":filedir[1],
        "filetype":filedir[2],
    ]));
```

### The module `playermap 1` (UNItopia-Kokosinsel)
#### Init: notify_move plus player_map_info(0,0)
#### `PlayerMap.Info { data:? }` according to playermap text matrix

## Excerpt from UNItopias /i/player/telnet_neg.c
```
private void start_gmcp(int command, int option)
{
    if (command != DO)
        return;

    this_object()->init_gmcp();
}

private void sb_gmcp(int command, int option, int* optargs)
{
    this_object()->receive_gmcp(to_text(optargs, "UTF-8//IGNORE"));
}
#if __EFUN_DEFINED__(json_serialize)
  set_callback(TELOPT_GMCP,     DONT,       WILL,       #'start_gmcp, #'sb_gmcp);
#endif

```

## Requests
```
Der verwirrte Felag redet zu dir: Naja als ultra Zusammenfassung geht das
        schon, aber bissl genauer wäre schon super. Ich frage mich da halt
        zum Beispiel direkt, ob Core.Hello so vollständig ist. Ist das
        alles, was vom Mud geschickt wird? Nur der Name? Und wir wollen nur
        den Client und die Version schicken? Und was ist mit Core.Supports
        von der MUD Seite her? Gibts da was, wenn nein, was sollte es
        liefern und in welchem Format? Ist das die Liste, die ich pro
        Client erhalte, oder sehe ich da generell alles, was das MUD kann?
        Warum ist es nötig "Char 1" anzugeben? Das wären so Fragen, die man
        vorher klären sollte.
```