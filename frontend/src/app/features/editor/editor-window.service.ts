import { inject, Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { WindowService } from '@webmud3/frontend/features/windows/window.service';
import type { FileInfo } from '../gmcp/signals/mud-signals';
import { FilesService } from './files.service';

const EDITOR_DEFAULT_WIDTH = 720;
const EDITOR_DEFAULT_HEIGHT = 480;
const EDITOR_DEFAULT_X = 120;
const EDITOR_DEFAULT_Y = 80;
const EDITOR_OFFSET_PER_WINDOW = 24;

/**
 * Wires the editor feature into the application:
 *  - listens to FilesService.fileOpen$ (MUD-pushed file requests)
 *  - opens an editor window for each new file
 *  - re-focuses an existing window if the same file path is pushed again
 *  - keeps the path -> windowId mapping in sync when the user closes a window
 */
@Injectable({ providedIn: 'root' })
export class EditorWindowService implements OnDestroy {
  private readonly windowService = inject(WindowService);
  private readonly files = inject(FilesService);

  private readonly pathToWindow = new Map<string, string>();
  private readonly subscriptions: Subscription[] = [];

  constructor() {
    this.subscriptions.push(
      this.files.fileOpen$.subscribe((fi) => this.openEditorFor(fi)),
      this.windowService.windows$.subscribe((windows) => {
        // Drop mappings for windows that have been closed externally.
        const liveIds = new Set(windows.map((w) => w.windowId));

        for (const [path, id] of this.pathToWindow) {
          if (!liveIds.has(id)) {
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

    const offset = this.pathToWindow.size * EDITOR_OFFSET_PER_WINDOW;

    const windowId = this.windowService.newWindow({
      title: fileinfo.title || fileinfo.filename || 'Editor',
      tooltip: fileinfo.file,
      component: 'editor',
      data: { fileinfo },
      posX: EDITOR_DEFAULT_X + offset,
      posY: EDITOR_DEFAULT_Y + offset,
      width: EDITOR_DEFAULT_WIDTH,
      height: EDITOR_DEFAULT_HEIGHT,
      saveable: true,
    });

    this.pathToWindow.set(fileinfo.file, windowId);
  }
}
