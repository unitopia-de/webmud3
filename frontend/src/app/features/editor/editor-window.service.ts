import { inject, Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { WindowGeometryService } from '@webmud3/frontend/features/windows/window-geometry.service';
import { WindowService } from '@webmud3/frontend/features/windows/window.service';
import type { WindowConfig } from '@webmud3/frontend/features/windows/window-config';
import type { FileInfo } from '../gmcp/signals/mud-signals';
import { FilesService } from './files.service';

const EDITOR_DEFAULT_WIDTH = 720;
const EDITOR_DEFAULT_HEIGHT = 480;
const EDITOR_DEFAULT_X = 120;
const EDITOR_DEFAULT_Y = 80;
const EDITOR_OFFSET_PER_WINDOW = 24;

const EDITOR_KEY_FALLBACK = '__default__';

/**
 * Builds the per-file localStorage key. Each file path gets its own slot so
 * that frequently edited files (e.g. start.c, room.c) reopen at the geometry
 * the user last picked for *that file*.
 *
 * The MUD-supplied `file` is the absolute LPC path and uniquely identifies
 * the file; no further normalization is needed. We fall back to a single
 * shared default key only if the path is empty (should not happen in practice).
 */
function geometryKeyFor(fileinfo: FileInfo): string {
  const id = fileinfo.file && fileinfo.file.length > 0
    ? fileinfo.file
    : EDITOR_KEY_FALLBACK;
  return `editor:${id}`;
}

/**
 * Wires the editor feature into the application:
 *  - listens to FilesService.fileOpen$ (MUD-pushed file requests)
 *  - opens an editor window for each new file
 *  - re-focuses an existing window if the same file path is pushed again
 *  - keeps the path -> windowId mapping in sync when the user closes a window
 *  - persists per-file geometry: every file path has its own saved
 *    position and size, restored on the next open of that file
 */
@Injectable({ providedIn: 'root' })
export class EditorWindowService implements OnDestroy {
  private readonly windowService = inject(WindowService);
  private readonly files = inject(FilesService);
  private readonly geometry = inject(WindowGeometryService);

  private readonly pathToWindow = new Map<string, string>();
  /** Bookkeeping per active editor window: live config + its geometry key. */
  private readonly windowDetails = new Map<
    string,
    { config: WindowConfig; geometryKey: string }
  >();
  private readonly subscriptions: Subscription[] = [];

  constructor() {
    this.subscriptions.push(
      this.files.fileOpen$.subscribe((fi) => this.openEditorFor(fi)),
      this.windowService.windows$.subscribe((windows) => {
        // Drop mappings for windows that have been closed externally and
        // persist their last known geometry on the way out.
        const liveIds = new Set(windows.map((w) => w.windowId));

        for (const [path, id] of this.pathToWindow) {
          if (!liveIds.has(id)) {
            this.persistGeometryFor(id);
            this.windowDetails.delete(id);
            this.pathToWindow.delete(path);
          }
        }
      }),
    );
  }

  ngOnDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }

  private openEditorFor(fileinfo: FileInfo): void {
    const existingId = this.pathToWindow.get(fileinfo.file);

    if (existingId !== undefined) {
      // Same file pushed again — focus the existing window. The editor
      // component itself is responsible for refreshing its content if
      // the MUD reissues a load (e.g. after a save handshake).
      this.windowService.focus(existingId);
      return;
    }

    const geometryKey = geometryKeyFor(fileinfo);
    const saved = this.geometry.load(geometryKey);
    const offset = this.pathToWindow.size * EDITOR_OFFSET_PER_WINDOW;

    const windowId = this.windowService.newWindow({
      title: fileinfo.title || fileinfo.filename || 'Editor',
      tooltip: fileinfo.file,
      component: 'editor',
      data: { fileinfo },
      posX: saved?.x ?? (EDITOR_DEFAULT_X + offset),
      posY: saved?.y ?? (EDITOR_DEFAULT_Y + offset),
      width: saved?.w ?? EDITOR_DEFAULT_WIDTH,
      height: saved?.h ?? EDITOR_DEFAULT_HEIGHT,
      saveable: true,
    });

    const config = this.windowService.getWindow(windowId);
    if (config) {
      this.windowDetails.set(windowId, { config, geometryKey });
    }
    this.pathToWindow.set(fileinfo.file, windowId);
  }

  private persistGeometryFor(windowId: string): void {
    const detail = this.windowDetails.get(windowId);
    if (!detail) {
      return;
    }
    this.geometry.save(detail.geometryKey, {
      x: detail.config.posX,
      y: detail.config.posY,
      w: detail.config.width,
      h: detail.config.height,
    });
  }
}
