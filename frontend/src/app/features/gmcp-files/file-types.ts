/**
 * A single entry in a directory listing.
 * Corresponds to the GMCP `Files.DirectoryList` entries.
 */
export interface FileEntry {
  /** File or directory name */
  name: string;
  /** 0 = file, non-zero = directory */
  isdir: number;
  /** File size in bytes (0 for directories) */
  size?: number;
  /** Human-readable date string (e.g. "14.02.2026") */
  filedate?: string;
  /** Human-readable time string (e.g. "12:34") */
  filetime?: string;
}

/**
 * Ace Editor mode identifier based on file extension.
 */
export type FileEditorMode = 'c_cpp' | 'text';

/**
 * Information about a file opened for editing.
 * Central data structure for the editor workflow.
 */
export interface FileInfo {
  /** Full file path on the MUD server */
  file: string;
  /** Directory path */
  path: string;
  /** Filename without path */
  filename: string;
  /** File extension (e.g. ".c", ".h") */
  filetype: string;
  /** Display title in the editor */
  title: string;
  /** URL for HTTP GET/PUT operations */
  lasturl: string;
  /** Whether this is a new (unsaved) file */
  newfile: boolean;
  /** Whether the user has write access */
  writeacl: boolean;
  /** Whether this is a temporary file */
  temporary: boolean;
  /** File size in bytes */
  filesize: number;
  /** Whether the file can be closed immediately after saving */
  closable: boolean;
  /** Current file content */
  content: string;
  /** Original content at load time (for dirty-check) */
  oldContent: string;
  /** Whether a save operation is in progress */
  saveActive: boolean;
  /** Whether the file was already loaded (re-opened) */
  alreadyLoaded: boolean;
  /** Ace editor mode identifier */
  editorMode: FileEditorMode;
  /** ID of the window displaying this file */
  windowId?: string;
}

/**
 * Payload received from the MUD for the GMCP `Files.URL` message.
 */
export interface FilesUrlPayload {
  url: string;
  file: string;
  path: string;
  filename: string;
  filetype: string;
  title: string;
  newfile: boolean;
  writeacl: boolean;
  temporary: boolean;
  saveactive: boolean;
  filesize: number;
  closable: boolean;
}

/**
 * Payload received from the MUD for the GMCP `Files.DirectoryList` message.
 */
export interface FilesDirectoryListPayload {
  path: string;
  entries: FileEntry[];
}

/**
 * Determines the Ace editor mode from a file extension.
 */
export function editorModeFromExtension(ext: string): FileEditorMode {
  switch (ext) {
    case '.c':
    case '.h':
    case '.inc':
      return 'c_cpp';
    default:
      return 'text';
  }
}
