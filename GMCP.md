# GMCP support of WebMud3 (u3_migrate)

References:
- UNItopia client plugins wiki: https://github.com/unitopia-de/client-plugins/wiki/GMCP
- UNItopia server-side implementation: `c:/_M/mud/lib/i/player/gmcp.c` (authoritative for what the MUD actually sends and accepts)
- u1_master inventory: `Analysis_u1.md`

This document tracks GMCP support in `u3_migrate`, cross-checked against the
LPC `gmcp.c` of UNItopia and the legacy `u1_master` implementation.

## Status legend

- ✅ Implemented in u3_migrate, matches MUD behaviour
- ⚠️ Implemented but limited, partially wrong, or signal routed without consumer
- ❌ Open / not yet migrated
- 🐛 Currently buggy / does not match what the MUD actually sends or expects
- — Not present at all (neither in u1 nor in u3, not yet announced by UNItopia)

## Reference points in u3 code

- Incoming routing: [`features/gmcp/signals/mud-signal.service.ts`](frontend/src/app/features/gmcp/signals/mud-signal.service.ts)
- Outgoing API: [`features/gmcp/gmcp.service.ts`](frontend/src/app/features/gmcp/gmcp.service.ts) (`send()`)
- Module registry: [`features/gmcp/modules/`](frontend/src/app/features/gmcp/modules/) and [`features/editor/files-gmcp.module.ts`](frontend/src/app/features/editor/files-gmcp.module.ts)

---

## Module registrations announced via `Core.Supports.Set`

The MUD reads `Core.Supports.Set` / `Add` / `Remove` and only sends messages
for modules the client has announced (see `gmcp.c:179-209`). The MUD also
calls `init_gmcp_package(name)` once when a new package becomes active, which
triggers an initial state push (see `gmcp.c:91-136`).

| Module       | Version | u1_master | u3_migrate | MUD initial push on register | Notes |
|--------------|---------|-----------|------------|------------------------------|-------|
| `Char`       | 1       | ✅ | ✅ | sends `Char.Name` | |
| `Char.Items` | 1       | ✅ | ✅ | sends `Char.Items.List` | |
| `Files`      | 1       | ✅ | ✅ | sends `Files.DirectoryList` for current path **only if wizard** | wizard check happens server-side |
| `Sound`      | 1       | ✅ | ✅ | sends `Sound.Url` | base URL cached by `SoundService`, `Sound.Event` plays via `<audio>` |
| `Numpad`     | 1       | ✅ | ❌ | sends `Numpad.SendLevel` for every saved prefix | bindings live server-side per character |
| `Playermap`  | 1       | ✅ (UNItopia) | ✅ | sends `Playermap.Info` | UNItopia-specific, not in original spec |
| `Room`       | 1       | ✅ | ❌ | no init push, but enables `Room.Info` on env changes | |
| `Comm`       | 1       | ✅ | ❌ | no init push | |
| `Input`      | 1       | ✅ | ✅ | no init push, replies to `Input.Complete` requests | Tab on a non-empty input buffer triggers `Input.Complete`; replies are wired via `InputCompletionService` |

> u3 currently announces `Char`, `Char.Items`, `Files`, `Sound`, `Playermap`,
> and `Input`. The other modules listed above are **not** sent by UNItopia
> until they are announced — the server explicitly drops outgoing messages
> for unregistered packages (`gmcp.c:74`).
>
> **Registration policy:** announce a module only when its consumer is being
> built. Pre-announcing modules without a consumer pulls server pushes (and,
> for some modules, init pushes) into the client where nothing handles them
> — wasted bandwidth and confusing logs. Each feature in "Open work" below
> therefore includes its module registration as part of the same step,
> following the [`CharItemsGmcpModule`](frontend/src/app/features/gmcp/modules/char-items-gmcp.module.ts)
> pattern (a thin `Injectable` that side-effect-registers itself when the
> consuming service injects it).

---

## Module Core

### MUD → Client

| Message        | u1 | u3 | MUD payload (`gmcp.c`) | Notes |
|----------------|----|----|------------------------|-------|
| `Core.Hello`   | ✅ | ✅ | `{ name: MUD_NAME }` | u3 also accepts a `version` field for forward-compat |
| `Core.Ping`    | ✅ | ✅ | (no payload) | echoed back from `core.ping` request |
| `Core.Goodbye` | ⚠️ | ⚠️ | bare string (the goodbye message) | u3 maps to `Core.Goodbye` MudSignal but ignores the message text — not yet shown to the user |

### Client → MUD

| Message                | u1 | u3 | MUD reaction | Notes |
|------------------------|----|----|--------------|-------|
| `Core.Hello`           | ✅ | ✅ | stores fields via `set_webmud3_info(key, val)` for every key (`real_ip`, `client`, `version`, …) | u3 sends `{ client, version }`; backend appends `real_ip` |
| `Core.Supports.Set`    | ✅ | ✅ | replaces module list, then calls `init_gmcp_package` for new ones | sent once when GMCP becomes active |
| `Core.Supports.Add`    | ❌ | ✅ | adds modules incrementally, calls `init_gmcp_package` | u3 emits this when a module registers after activation |
| `Core.Supports.Remove` | ❌ | ✅ | removes packages | u3 emits on `unregisterModule()` |
| `Core.Ping`            | ✅ | ✅ | answers with `Core.Ping` | manual ping button still TODO |

---

## Module Char

### MUD → Client

| Message            | u1 | u3 | MUD payload | Notes |
|--------------------|----|----|-------------|-------|
| `Char.Name`        | ✅ | ✅ | `{ name, fullname, gender, wizard }` | `wizard` is `wizp()` (truthy for wizards). Used in u3 to gate the directory window |
| `Char.StatusVars`  | ✅ | ❌ | `{ race: "Rasse", guild: "Gilde", rank: "Gildenrang" }` (hardcoded labels in `gmcp.c:412-418`) | only sent when `process_gmcp(...,"Char","StatusVars")` is invoked — there is no obvious caller in the LPC, so this may never actually fire on UNItopia today |
| `Char.Status`      | ✅ | ✅ | `{ race, guild, rank }` | u3 keeps the raw payload only |
| `Char.Vitals`      | ✅ | ✅ | `{ hp, maxhp, sp, maxsp, string }` (e.g. `"100 AP(150) und 50 KP(100)."`) | u3 extracts the pre-formatted `string` field; raw numbers carried through |
| `Char.Stats`       | ✅ | ✅ | `{ str, int, con, dex }` | u3 keeps raw payload |

### Client → MUD

| Message       | u1 | u3 | MUD reaction | Notes |
|---------------|----|----|--------------|-------|
| `Char.Login`  | ❌ (UNItopia) | ❌ | not implemented server-side | blocked on UNItopia |

---

## Module Char.Items — Inventory

The MUD sends only entries with `location: "inv"` and prefilters items by
visibility (wizards see invisible items too). Each item is `{ name, category }`.

### MUD → Client

| Message              | u1 | u3 | MUD payload | Notes |
|----------------------|----|----|-------------|-------|
| `Char.Items.List`    | ✅ | ✅ | `{ location: "inv", items: [{name, category}, …] }` | u3 normalizes various wrapper shapes |
| `Char.Items.Add`     | ✅ | ✅ | `{ location: "inv", item: {name, category} }` | |
| `Char.Items.Remove`  | ✅ | ✅ | `{ location: "inv", item: {name, category} }` | |

### Client → MUD

| Message       | u1 | u3 | MUD reaction | Notes |
|---------------|----|----|--------------|-------|
| `Char.Items.Inv` | ✅ | ✅ | re-sends `Char.Items.List` | |

---

## Module Sound

### MUD → Client

| Message       | u1 | u3 | MUD payload | Notes |
|---------------|----|----|-------------|-------|
| `Sound.Url`   | ✅ | ✅ | `{ url: GMCP_SOUND_URL }` (sent on register) | mapped to `Sound.Url` MudSignal; cached by `SoundService` as base URL |
| `Sound.Event` | ✅ | ✅ | `{ file: <name> }` (implicit in MSG_SOUND wrappers) | mapped to `Sound.Event` MudSignal; `SoundService` resolves `base + file` and plays via `<audio>` |

> Browser autoplay policy: the first `play()` call before any user gesture is
> rejected by the browser; subsequent calls succeed once the user has typed
> in the terminal. The service silently logs the rejection and moves on.

---

## Module Files — Editor & Directory Browser

### MUD → Client

| Message               | u1 | u3 | MUD payload (`gmcp.c:739-751`) | Notes |
|-----------------------|----|----|--------------------------------|-------|
| `Files.URL`           | ✅ | ✅ | `{ url, newfile, writeacl, saveactive, temporary, filesize, title, file, path, filename, filetype }` | u3 maps `url → lasturl` and auto-opens an editor window |
| `Files.CurrentPath`   | — | ❌ | `{ path }` (sent after `gmcp_chdir_dir`) | **Newly visible in `gmcp.c`** — u3 has no consumer, but the directory window currently does fine without it (MUD also sends a fresh `DirectoryList`) |
| `Files.DirectoryList` | ✅ | ✅ | `{ path, entries: [{name, size, filedate, filetime, isdir}, …] }` | parent `../` is included server-side as the first entry |

### Client → MUD

| Message               | u1 | u3 | MUD reaction (`gmcp.c:264-302`) | Notes |
|-----------------------|----|----|---------------------------------|-------|
| `Files.OpenFile`      | ✅ | ✅ | `gmcp_send_files_url(file, title, flag)` — answers with `Files.URL` | `flag: 1` requests a writable URL (for save) |
| `Files.ChDir`         | ✅ | ✅ | `cd(dir)` then `gmcp_send_dir(...)` → `Files.DirectoryList` | `..` is resolved server-side via the player's normal `cd` |
| `Files.fileSaved`     | ✅ | ✅ | `gmcp_edit_saved(file)` — closes the temp file and applies the buffer | |
| `Files.fileCanceled`  | ✅ | ✅ | `gmcp_edit_drop_tempfile(file)` | sent on user cancel and from `EditorComponent.ngOnDestroy` (e.g. X button, disconnect) — idempotent and skipped after a successful save |

> Suggested cleanup: remove the `Files.Directory` alias in
> `mud-signal.service.ts:122` — UNItopia only ever sends `Files.DirectoryList`,
> the alias was speculative.

---

## Module Input — Command completion

The MUD answers a single `input.complete <string>` request with **one of three
distinct messages**, depending on the result (`gmcp.c:248-258`):

| Message                | u1 | u3 | MUD payload | Notes |
|------------------------|----|----|-------------|-------|
| `Input.CompleteText`   | ✅ | ⚠️ | bare string with the completion | routed to `Input.CompleteText` MudSignal — no UI consumer yet |
| `Input.CompleteChoice` | ✅ | ⚠️ | array of strings | only delivered to wizards (`query_wiz_level()` check in LPC) — no UI consumer yet |
| `Input.CompleteNone`   | ✅ | ⚠️ | (no payload) | routed but no UI reaction |

### Client → MUD

| Message          | u1 | u3 | MUD reaction | Notes |
|------------------|----|----|--------------|-------|
| `Input.Complete` | ✅ | ❌ | runs `complete_command()` and answers as above | not yet sent — there is no Tab-complete UI in the terminal |

---

## Module Numpad

The MUD persists numpad bindings in the player save (`mapping numpad`) and
sends one `Numpad.SendLevel` per stored prefix on register.

### MUD → Client

| Message            | u1 | u3 | MUD payload | Notes |
|--------------------|----|----|-------------|-------|
| `Numpad.SendLevel` | ✅ | ⚠️ | `{ prefix, keys: { Numpad7: "norden", … } }` | u3 routes the signal but `NumpadService` reads from `localStorage` only — server bindings are ignored |

> The MUD **does not** push `Numpad.Update` (despite u3's mapping). Updates in
> the spec flow client → MUD only.

### Client → MUD

| Message            | u1 | u3 | MUD reaction | Notes |
|--------------------|----|----|--------------|-------|
| `Numpad.GetAll`    | ✅ | ❌ | re-sends every level via `numpad_send_all()` | |
| `Numpad.GetLevel`  | ✅ | ❌ | sends `Numpad.SendLevel` for the requested prefix | `{ prefix }` |
| `Numpad.Update`    | ✅ | ❌ | persists `numpad[prefix][key] = value` server-side | `{ prefix, key, value }` |

> The whole MUD-driven numpad workflow is open. Until it lands, bindings are
> only saved per-browser per-deployment, not per-character.

---

## Module Room

### MUD → Client

| Message     | u1 | u3 | MUD payload (`gmcp.c:686-690`) | Notes |
|-------------|----|----|--------------------------------|-------|
| `Room.Info` | ✅ | ⚠️ | `{ name, domain, exits }` | u3 routes the signal but no UI consumes it. `exits` is from `query_command_list(EXIT_VISIBLE)` |

---

## Module Comm — Communication channels

The MUD wraps all three subtypes the same way: `{ player, text }`. `player`
defaults to `"-"` for system messages.

| Message     | u1 | u3 | MUD payload | Notes |
|-------------|----|----|-------------|-------|
| `Comm.Say`  | ✅ | ⚠️ | `{ player, text }` | u3 forwards as `Comm.Message` with `channel: 'Say'`; payload not normalized — consumers see `data: { player, text }` |
| `Comm.Tell` | ✅ | ⚠️ | `{ player, text }` | same |
| `Comm.Soul` | ✅ | ⚠️ | `{ player, text }` | same |

---

## Module Playermap (UNItopia-specific)

Driven by an in-world object (`kokos # playermap`) that publishes the player's
current minimap state.

| Direction    | Message          | u1 | u3 | MUD payload | Notes |
|--------------|------------------|----|----|-------------|-------|
| MUD → Client | `Playermap.Info` | ✅ | ✅ | `{ data: <pmap-data> }` | UNItopia-specific. Sent on `init_gmcp_package("playermap")` and on every player movement. `data` may be a string (ASCII map), a `{map, pos, fill}` mapping, or `null` (no map for room). Rendered as a 25×25 viewport in the "Karte" window |

---

## Currently buggy / divergent behaviour

These are concrete mismatches discovered by reading `gmcp.c` against
`mud-signal.service.ts`:

1. **`Files.Directory` alias** — u3 accepts this as alias for `Files.DirectoryList`. UNItopia never sends it. Cosmetic only; can be removed.
2. **`Char.Items` location filter** — MUD only sends `location: "inv"` payloads. u3 currently accepts any location due to permissive normalization — works fine but worth being explicit if other locations ever appear.

---

## Open work, prioritized

Each feature below ships together with its own `XxxGmcpModule` (registers the
package via `Core.Supports.Set/Add`) — pre-announcing without a consumer is
explicitly avoided, see the registration-policy note in the section above.

### Medium priority

1. **Numpad full integration** + announce `Numpad 1` — consume `Numpad.SendLevel` server-side bindings, send `Numpad.Update` / `Numpad.GetAll` / `Numpad.GetLevel`. Replaces the current localStorage-only flow with per-character bindings persisted server-side.
2. **Comm channel UI** + announce `Comm 1` — display `Comm.Say` / `Comm.Tell` / `Comm.Soul` (`{ player, text }`) in dedicated channels.
3. **Room.Info consumer** + announce `Room 1` — surface room name / domain / exits as window content (or a status strip).
4. **`Char.StatusVars` consumer** — already covered by `Char` registration; pick up the labels (`{ race: "Rasse", … }`) and use them in the status display.

### Low priority

5. **Manual `Core.Ping` button** in the UI (was a debug feature in u1).
6. **`Core.Goodbye` parameter** consumer — graceful shutdown banner with the message text.
7. **`Files.CurrentPath`** consumer — useful as a sanity check / breadcrumb in the directory window.
8. **`Char.Login`** outgoing — blocked on UNItopia server-side support.
