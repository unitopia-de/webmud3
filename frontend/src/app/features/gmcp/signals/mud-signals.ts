/**
 * Typed signal definitions for GMCP-based events.
 *
 * Each signal type corresponds to a GMCP message or group of messages
 * from the MUD server, normalized into a structured format that
 * components can easily consume.
 */

// ---------------------------------------------------------------------------
// Character Signals
// ---------------------------------------------------------------------------

export type CharNameSignal = {
  type: 'Char.Name';
  /** Character name, e.g. "Myonara" */
  name: string;
  /** MUD name (server identifier), e.g. "UNItopia" */
  mudname?: string;
  /** "name@mudname" if mudname is known, otherwise just name */
  fullName: string;
  /** Whether the character is a wizard/immortal */
  wizard?: number;
};

export type CharStatusSignal = {
  type: 'Char.Status';
  /** Raw status data from the MUD */
  data: unknown;
};

export type CharVitalsSignal = {
  type: 'Char.Vitals';
  /** Pre-formatted vitals string from the MUD (if provided), e.g. "100/200 LP, 50/100 KP" */
  text?: string;
  /** Raw vitals data from the MUD (full payload for further processing) */
  data: unknown;
};

export type CharStatsSignal = {
  type: 'Char.Stats';
  /** Raw stats data from the MUD */
  data: unknown;
};

// ---------------------------------------------------------------------------
// Inventory Signals
// ---------------------------------------------------------------------------

export type InventoryEntry = {
  name: string;
  category: string;
};

export type CharItemsListSignal = {
  type: 'Char.Items.List';
  entries: InventoryEntry[];
};

export type CharItemsAddSignal = {
  type: 'Char.Items.Add';
  entry: InventoryEntry;
};

export type CharItemsRemoveSignal = {
  type: 'Char.Items.Remove';
  entry: InventoryEntry;
};

// ---------------------------------------------------------------------------
// Sound Signals
// ---------------------------------------------------------------------------

/**
 * Server announces the base URL where sound files are hosted.
 * UNItopia sends this once when the `Sound` package is registered (init push).
 * The URL is meant to be cached and prefixed onto subsequent `Sound.Event`
 * file names, not played directly.
 */
export type SoundUrlSignal = {
  type: 'Sound.Url';
  url: string;
};

/**
 * Server pushes a sound event for an in-game action (combat, room, …).
 * `file` is the relative file name; combine with the cached base URL from
 * `Sound.Url` to build a playable URL.
 */
export type SoundEventSignal = {
  type: 'Sound.Event';
  file: string;
};

// ---------------------------------------------------------------------------
// File Signals
// ---------------------------------------------------------------------------

export type FileEntry = {
  name: string;
  size: number;
  filedate: string;
  filetime: string;
  isdir: number;
};

export type FileInfo = {
  file: string;
  path: string;
  filename: string;
  filetype: string;
  editortype?: string;
  newfile: boolean;
  writeacl: boolean;
  temporary: boolean;
  closable: boolean;
  filesize: number;
  title: string;
  content?: string;
  /** HTTP URL provided by the MUD for GET (load) / PUT (save) of the file body. */
  lasturl: string;
};

export type FilesDirectorySignal = {
  type: 'Files.Dir';
  path: string;
  entries: FileEntry[];
};

export type FilesOpenSignal = {
  type: 'Files.Open';
  fileinfo: FileInfo;
};

// ---------------------------------------------------------------------------
// Input Completion Signals
// ---------------------------------------------------------------------------

export type InputCompleteTextSignal = {
  type: 'Input.CompleteText';
  text: string;
};

export type InputCompleteChoiceSignal = {
  type: 'Input.CompleteChoice';
  choices: string[];
};

export type InputCompleteNoneSignal = {
  type: 'Input.CompleteNone';
};

// ---------------------------------------------------------------------------
// Numpad Signals
// ---------------------------------------------------------------------------

export type NumpadLevelSignal = {
  type: 'Numpad.SendLevel';
  data: unknown;
};

// ---------------------------------------------------------------------------
// Room Signals
// ---------------------------------------------------------------------------

export type RoomInfoSignal = {
  type: 'Room.Info';
  data: unknown;
};

// ---------------------------------------------------------------------------
// Communication Signals
// ---------------------------------------------------------------------------

export type CommSignal = {
  type: 'Comm.Message';
  channel: string;
  data: unknown;
};

// ---------------------------------------------------------------------------
// Core Signals
// ---------------------------------------------------------------------------

export type CorePingSignal = {
  type: 'Core.Ping';
};

export type CoreGoodbyeSignal = {
  type: 'Core.Goodbye';
};

/**
 * The MUD server announces itself via Core.Hello.
 * UNItopia sends this with `name` (server identifier) and `version`.
 */
export type CoreHelloSignal = {
  type: 'Core.Hello';
  /** Server-side MUD name, e.g. "UNItopia" */
  mudname?: string;
  /** Server version string */
  version?: string;
};

// ---------------------------------------------------------------------------
// Union Type
// ---------------------------------------------------------------------------

/** Discriminated union of all possible MUD signals */
export type MudSignal =
  | CharNameSignal
  | CharStatusSignal
  | CharVitalsSignal
  | CharStatsSignal
  | CharItemsListSignal
  | CharItemsAddSignal
  | CharItemsRemoveSignal
  | SoundUrlSignal
  | SoundEventSignal
  | FilesDirectorySignal
  | FilesOpenSignal
  | InputCompleteTextSignal
  | InputCompleteChoiceSignal
  | InputCompleteNoneSignal
  | NumpadLevelSignal
  | RoomInfoSignal
  | CommSignal
  | CorePingSignal
  | CoreGoodbyeSignal
  | CoreHelloSignal;

/** All possible signal type strings */
export type MudSignalType = MudSignal['type'];
