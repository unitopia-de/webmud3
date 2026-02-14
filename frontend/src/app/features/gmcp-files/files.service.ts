import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { WindowService } from '../windows/window.service';
import {
  editorModeFromExtension,
  FileInfo,
  FilesUrlPayload,
} from './file-types';

/**
 * Service for managing MUD file operations (load, save, track state).
 *
 * Responsibilities:
 * - Maintains a registry of open files by their file path
 * - Loads file content via HTTP GET from the MUD-provided URL
 * - Saves file content via HTTP PUT to the MUD-provided URL
 * - Tracks dirty/save state per file
 *
 * Architecture:
 * ```
 * GMCP Files.URL → FilesGmcpHandler → FilesService.processFileUrl()
 *                                        ├─ HTTP GET → load content
 *                                        └─ Opens editor window via WindowService
 * Editor → FilesService.saveFile()
 *            └─ HTTP PUT → save content
 *            └─ GMCP Files.OpenFile (flag=1) → Files.fileSaved
 * ```
 */
@Injectable({ providedIn: 'root' })
export class FilesService {
  private readonly http = inject(HttpClient);
  private readonly windowService = inject(WindowService);

  /** Registry of open files, keyed by full file path */
  private readonly fileRegistry = new Map<string, FileInfo>();

  /**
   * Processes a GMCP Files.URL message.
   *
   * - If the file is already open and a save is active, updates the URL
   *   for the ongoing save operation.
   * - Otherwise, creates a new FileInfo and loads the content.
   *
   * @returns The FileInfo (existing or new)
   */
  public processFileUrl(payload: FilesUrlPayload): FileInfo {
    const existingFile = this.fileRegistry.get(payload.file);

    if (existingFile !== undefined && existingFile.saveActive) {
      // File already open with an active save — update URL for PUT
      existingFile.lasturl = payload.url;
      existingFile.alreadyLoaded = true;

      console.debug('[FilesService] File already loaded (save active):', payload.file);

      return existingFile;
    }

    // Create a new FileInfo
    const fileInfo: FileInfo = {
      file: payload.file,
      path: payload.path,
      filename: payload.filename,
      filetype: payload.filetype,
      title: payload.title,
      lasturl: payload.url,
      newfile: payload.newfile,
      writeacl: payload.writeacl,
      temporary: payload.temporary,
      filesize: payload.filesize,
      closable: payload.closable,
      content: '',
      oldContent: '',
      saveActive: payload.saveactive,
      alreadyLoaded: false,
      editorMode: editorModeFromExtension(payload.filetype),
    };

    this.fileRegistry.set(payload.file, fileInfo);

    console.info('[FilesService] Registered file:', payload.file);

    return fileInfo;
  }

  /**
   * Loads file content from the MUD's HTTP endpoint.
   *
   * @returns The loaded content string
   */
  public async loadFileContent(fileInfo: FileInfo): Promise<string> {
    try {
      const content = await firstValueFrom(
        this.http.get(fileInfo.lasturl, { responseType: 'text' }),
      );

      fileInfo.content = content;
      fileInfo.oldContent = content;

      console.info('[FilesService] Loaded file:', fileInfo.file, `(${content.length} chars)`);

      return content;
    } catch (error) {
      console.error('[FilesService] Failed to load file:', fileInfo.file, error);
      throw error;
    }
  }

  /**
   * Saves file content to the MUD's HTTP endpoint.
   *
   * @returns The response text from the server
   */
  public async saveFileContent(fileInfo: FileInfo): Promise<string> {
    fileInfo.saveActive = true;

    try {
      const response = await firstValueFrom(
        this.http.put(fileInfo.lasturl, fileInfo.content, {
          responseType: 'text',
        }),
      );

      fileInfo.oldContent = fileInfo.content;
      fileInfo.saveActive = false;

      console.info('[FilesService] Saved file:', fileInfo.file);

      return response;
    } catch (error) {
      fileInfo.saveActive = false;
      console.error('[FilesService] Failed to save file:', fileInfo.file, error);
      throw error;
    }
  }

  /**
   * Returns the FileInfo for a given file path, or undefined if not open.
   */
  public getFileInfo(filepath: string): FileInfo | undefined {
    return this.fileRegistry.get(filepath);
  }

  /**
   * Associates a window ID with a file (after editor window is created).
   */
  public setWindowId(filepath: string, windowId: string): void {
    const fileInfo = this.fileRegistry.get(filepath);

    if (fileInfo !== undefined) {
      fileInfo.windowId = windowId;
    }
  }

  /**
   * Removes a file from the registry (e.g. when editor window is closed).
   */
  public removeFile(filepath: string): void {
    this.fileRegistry.delete(filepath);

    console.debug('[FilesService] Removed file from registry:', filepath);
  }

  /**
   * Checks whether a file has unsaved changes.
   */
  public isDirty(fileInfo: FileInfo): boolean {
    return fileInfo.content !== fileInfo.oldContent;
  }

  /**
   * Clears all tracked files (e.g. on disconnect).
   */
  public reset(): void {
    this.fileRegistry.clear();

    console.info('[FilesService] File registry cleared.');
  }
}
