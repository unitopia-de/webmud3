import { HttpClient } from '@angular/common/http';
import { inject, Injectable, OnDestroy } from '@angular/core';
import {
  BehaviorSubject,
  filter,
  map,
  Observable,
  Subject,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';

import { GmcpService } from '../gmcp/gmcp.service';
import { MudSignalService } from '../gmcp/signals/mud-signal.service';
import type {
  FileEntry,
  FileInfo,
} from '../gmcp/signals/mud-signals';
import { FilesGmcpModule } from './files-gmcp.module';

export type DirectoryListing = {
  path: string;
  entries: FileEntry[];
};

/**
 * Manages file metadata and HTTP-based load/save for files exposed by the MUD
 * via the GMCP `Files` package.
 *
 * Responsibilities:
 *   - Cache `FileInfo` objects pushed by the MUD (`Files.OpenFile` -> Files.Open signal)
 *   - Stream incoming open requests and directory listings to consumers
 *     (Editor / Dirlist components — added in later migration steps)
 *   - Perform HTTP GET (load body) and HTTP PUT (save body) against the URL
 *     provided by the MUD in `FileInfo.lasturl`
 *   - Coordinate the save handshake: client sends `Files.OpenFile {flag:1}` to
 *     ask the MUD for a writable URL, waits for the matching `Files.Open`
 *     response, PUTs the new content, then notifies the MUD via
 *     `Files.fileSaved`.
 */
@Injectable({ providedIn: 'root' })
export class FilesService implements OnDestroy {
  private readonly signals = inject(MudSignalService);
  private readonly gmcp = inject(GmcpService);
  private readonly http = inject(HttpClient);
  // Bootstraps the GMCP "Files" registration as a side-effect of inject.
  private readonly _filesGmcp = inject(FilesGmcpModule);

  private readonly cache = new Map<string, FileInfo>();
  private readonly subscriptions: Subscription[] = [];

  private readonly fileOpenSubject = new Subject<FileInfo>();
  private readonly directorySubject =
    new BehaviorSubject<DirectoryListing | null>(null);

  /** Emits each file the MUD asks the client to open (load or save). */
  public readonly fileOpen$ = this.fileOpenSubject.asObservable();

  /** Latest directory listing pushed by the MUD; `null` until the first arrives. */
  public readonly directoryList$ = this.directorySubject.asObservable();

  constructor() {
    this.subscriptions.push(
      this.signals.on('Files.Open').subscribe((s) => {
        const fileinfo = this.normalizeFileInfo(s.fileinfo);

        this.cache.set(fileinfo.file, fileinfo);
        this.fileOpenSubject.next(fileinfo);
      }),
      this.signals.on('Files.Dir').subscribe((s) => {
        this.directorySubject.next({ path: s.path, entries: s.entries });
      }),
    );
  }

  ngOnDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }

  /** Synchronous lookup of a previously-seen file by its MUD path. */
  public getCachedFile(filepath: string): FileInfo | undefined {
    return this.cache.get(filepath);
  }

  /**
   * Synchronous snapshot of the most recent directory listing pushed by the
   * MUD. Returns `null` until the first `Files.DirectoryList` has arrived.
   */
  public getCurrentListing(): DirectoryListing | null {
    return this.directorySubject.value;
  }

  /**
   * Tells the MUD that the user has abandoned the editor without saving.
   * UNItopia drops the corresponding temp file (`gmcp_edit_drop_tempfile`).
   * Safe to call for non-temp files too — the server-side handler is a no-op
   * if the file is unknown.
   */
  public cancelFile(fileinfo: FileInfo): void {
    this.gmcp.send('Files.fileCanceled', { file: fileinfo.file });
  }

  /** Loads the file body via HTTP GET against `fileinfo.lasturl`. */
  public loadContent(fileinfo: FileInfo): Observable<string> {
    return this.http.get(fileinfo.lasturl, { responseType: 'text' });
  }

  /**
   * Saves the given content to the MUD.
   *
   * Protocol (mirrors u1_master):
   *   1. Send `Files.OpenFile {file, title, flag:1}` to request a writable URL.
   *   2. Wait for the matching `Files.Open` response carrying the new URL.
   *   3. HTTP PUT the content to that URL.
   *   4. Notify the MUD with `Files.fileSaved {file, title, flag:1}`.
   *
   * Resolves with the updated `FileInfo` (now containing the new `lasturl`).
   */
  public saveFile(fileinfo: FileInfo, content: string): Observable<FileInfo> {
    this.gmcp.send('Files.OpenFile', {
      file: fileinfo.file,
      title: fileinfo.title,
      flag: 1,
    });

    return this.fileOpenSubject.pipe(
      filter((fi) => fi.file === fileinfo.file),
      take(1),
      switchMap((fi) =>
        this.http.put(fi.lasturl, content, { responseType: 'text' }).pipe(
          tap(() => {
            this.gmcp.send('Files.fileSaved', {
              file: fi.file,
              title: fi.title,
              flag: 1,
            });
          }),
          map(() => ({ ...fi, content })),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private normalizeFileInfo(raw: FileInfo): FileInfo {
    return {
      ...raw,
      editortype: raw.editortype ?? this.deriveEditorType(raw.filetype),
    };
  }

  private deriveEditorType(filetype: string): string {
    switch (filetype) {
      case '.c':
      case '.h':
      case '.inc':
        return 'c_cpp';

      default:
        return 'text';
    }
  }
}
