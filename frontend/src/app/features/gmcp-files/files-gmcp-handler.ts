import { inject, Injectable } from '@angular/core';

import { GmcpService } from '../gmcp/gmcp.service';
import type { GmcpModuleHandler } from '../gmcp/gmcp-module-handler';
import { WindowAction, WindowService } from '../windows';

import {
  FileEntry,
  FilesDirectoryListPayload,
  FilesUrlPayload,
} from './file-types';
import { FilesService } from './files.service';

/** Component type keys used with the WindowService */
const COMPONENT_DIR_LIST = 'DirlistComponent';
const COMPONENT_EDITOR = 'EditorComponent';

/**
 * GMCP handler for the `Files` module.
 *
 * Handles:
 * - `Files.URL` (u1: `files.url`)  → Open/re-open editor window
 * - `Files.DirectoryList` (u1: `files.directorylist`) → Open/update directory window
 * - `Files.ChDir` → Change directory request (sent from DirList)
 *
 * Integrates with:
 * - FilesService  (HTTP load/save, file registry)
 * - WindowService (open/close editor & directory windows)
 * - GmcpService   (sending outgoing GMCP messages)
 */
@Injectable({ providedIn: 'root' })
export class FilesGmcpHandler implements GmcpModuleHandler {
  readonly moduleName = 'Files';
  readonly version = '1';

  private readonly filesService = inject(FilesService);
  private readonly windowService = inject(WindowService);
  private readonly gmcpService = inject(GmcpService);

  /** ID of the current DirList window (only one at a time) */
  private dirListWindowId: string | undefined;

  /**
   * Routes incoming GMCP `Files.*` messages to the appropriate handler.
   */
  handleMessage(message: string, data: unknown): void {
    const msgLower = message.toLowerCase().trim();

    switch (msgLower) {
      case 'url':
        this.handleFilesUrl(data as FilesUrlPayload);
        break;

      case 'directorylist':
        this.handleDirectoryList(data as FilesDirectoryListPayload);
        break;

      default:
        console.debug(`[FilesGmcpHandler] Unknown message: Files.${message}`, data);
    }
  }

  /**
   * Handles `Files.URL`: MUD wants to open a file for editing.
   *
   * Workflow:
   * 1. Register file in FilesService
   * 2. If already loaded (re-save), skip window creation
   * 3. Load content via HTTP GET
   * 4. Open editor window
   */
  private async handleFilesUrl(payload: FilesUrlPayload): Promise<void> {
    const fileInfo = this.filesService.processFileUrl(payload);

    if (fileInfo.alreadyLoaded) {
      // File is being re-opened after save request — complete the save workflow
      console.info('[FilesGmcpHandler] File re-opened for save:', payload.file);

      // Complete the save via HTTP PUT (not saveFile which would re-request the URL)
      await this.completeSave(fileInfo.file);

      return;
    }

    // Load content from MUD HTTP endpoint
    try {
      await this.filesService.loadFileContent(fileInfo);
    } catch {
      console.error('[FilesGmcpHandler] Failed to load file, opening empty editor:', payload.file);
      fileInfo.content = '';
      fileInfo.oldContent = '';
    }

    // Open editor window
    const windowId = this.windowService.open({
      title: fileInfo.title || fileInfo.filename,
      componentType: COMPONENT_EDITOR,
      allowSave: fileInfo.writeacl,
      showCancel: true,
      parentWindowId: this.dirListWindowId,
      size: { width: 700, height: 500 },
      data: fileInfo,
    });

    this.filesService.setWindowId(fileInfo.file, windowId);

    // Subscribe to window events for this editor
    this.subscribeToEditorEvents(windowId, fileInfo.file);

    console.info('[FilesGmcpHandler] Opened editor for:', fileInfo.file);
  }

  /**
   * Handles `Files.DirectoryList`: MUD sends directory contents.
   *
   * Opens a new DirList window or updates the existing one.
   */
  private handleDirectoryList(payload: FilesDirectoryListPayload): void {
    const existingConfig = this.dirListWindowId !== undefined
      ? this.windowService.getConfig(this.dirListWindowId)
      : undefined;

    if (existingConfig !== undefined) {
      // Update existing DirList window
      this.windowService.updateData(this.dirListWindowId!, {
        path: payload.path,
        entries: payload.entries,
      });

      console.debug('[FilesGmcpHandler] Updated DirList:', payload.path);
    } else {
      // Open new DirList window
      this.dirListWindowId = this.windowService.open({
        title: 'Verzeichnisanzeige',
        componentType: COMPONENT_DIR_LIST,
        allowSave: false,
        showCancel: true,
        size: { width: 500, height: 400 },
        data: {
          path: payload.path,
          entries: payload.entries,
        },
      });

      // Subscribe to DirList events (file open, dir change)
      this.subscribeToDirListEvents(this.dirListWindowId);

      console.info('[FilesGmcpHandler] Opened DirList for:', payload.path);
    }
  }

  /**
   * Initiates a file save operation.
   *
   * Flow: Editor → saveFile() → HTTP PUT → GMCP Files.fileSaved
   */
  public async saveFile(filepath: string, closable = false): Promise<void> {
    const fileInfo = this.filesService.getFileInfo(filepath);

    if (fileInfo === undefined) {
      console.error('[FilesGmcpHandler] Cannot save unknown file:', filepath);
      return;
    }

    // Request save URL from MUD (sends GMCP Files.OpenFile with flag=1)
    this.gmcpService.sendOutgoing('Files', 'OpenFile', {
      file: filepath,
      title: fileInfo.title,
      flag: 1, // save flag
    });

    fileInfo.closable = closable;
    fileInfo.saveActive = true;
  }

  /**
   * Completes a save after receiving the new URL (in handleFilesUrl with alreadyLoaded).
   */
  private async completeSave(filepath: string): Promise<void> {
    const fileInfo = this.filesService.getFileInfo(filepath);

    if (fileInfo === undefined) {
      return;
    }

    try {
      await this.filesService.saveFileContent(fileInfo);

      // Notify MUD that save completed
      this.gmcpService.sendOutgoing('Files', 'fileSaved', {
        file: filepath,
        title: fileInfo.title,
        flag: 1,
      });

      if (fileInfo.temporary || fileInfo.closable) {
        // Close editor window
        if (fileInfo.windowId !== undefined) {
          this.windowService.close(fileInfo.windowId);
        }

        this.filesService.removeFile(filepath);
      }

      console.info('[FilesGmcpHandler] Save complete:', filepath);
    } catch (error) {
      console.error('[FilesGmcpHandler] Save failed:', filepath, error);

      if (fileInfo.windowId !== undefined) {
        // Notify editor of error
        this.windowService.outgoingEvents$.next({
          action: WindowAction.WinError,
          windowId: fileInfo.windowId,
          data: error,
        });
      }
    }
  }

  /**
   * Sends a GMCP Files.OpenFile request to open a file from DirList.
   */
  public openFile(dirPath: string, filename: string): void {
    this.gmcpService.sendOutgoing('Files', 'OpenFile', {
      file: dirPath + filename,
    });

    console.debug('[FilesGmcpHandler] Requested file open:', dirPath + filename);
  }

  /**
   * Sends a GMCP Files.ChDir request to change directory.
   */
  public changeDirectory(currentPath: string, dirName: string): void {
    const targetDir = dirName === '../' ? dirName : currentPath + dirName;

    this.gmcpService.sendOutgoing('Files', 'ChDir', {
      dir: targetDir,
    });

    console.debug('[FilesGmcpHandler] Requested chdir:', targetDir);
  }

  /**
   * Subscribes to window events from the editor window to handle
   * save, cancel, and close actions.
   */
  private subscribeToEditorEvents(windowId: string, filepath: string): void {
    const sub = this.windowService.outgoingEvents$.subscribe((event) => {
      if (event.windowId !== windowId) {
        return;
      }

      switch (event.action) {
        case WindowAction.CloseParent:
          this.filesService.removeFile(filepath);
          sub.unsubscribe();
          break;
      }
    });
  }

  /**
   * Subscribes to DirList window events for file navigation.
   */
  private subscribeToDirListEvents(windowId: string): void {
    const sub = this.windowService.outgoingEvents$.subscribe((event) => {
      if (event.windowId !== windowId) {
        return;
      }

      if (event.action === WindowAction.CloseParent) {
        this.dirListWindowId = undefined;
        sub.unsubscribe();
      }
    });
  }

  /**
   * Cleanup when the Files GMCP module is unregistered.
   */
  dispose(): void {
    // Close all editor/dirlist windows
    if (this.dirListWindowId !== undefined) {
      this.windowService.close(this.dirListWindowId);
      this.dirListWindowId = undefined;
    }

    this.filesService.reset();

    console.info('[FilesGmcpHandler] Disposed.');
  }
}
