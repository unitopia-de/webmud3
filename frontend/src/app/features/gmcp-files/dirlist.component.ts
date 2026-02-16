import {
  Component,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { WindowAction, WindowConfig, WindowService } from '../windows';

import { FileEntry } from './file-types';
import { FilesGmcpHandler } from './files-gmcp-handler';

/**
 * Data shape expected in windowConfig.data for the DirList component.
 */
interface DirListData {
  path: string;
  entries: FileEntry[];
}

/**
 * Displays a directory listing inside a modeless window.
 *
 * Allows:
 * - Clicking a file to open it in the editor (via FilesGmcpHandler)
 * - Clicking a directory to navigate into it (GMCP Files.ChDir)
 *
 * The component receives its data through the WindowConfig.data property
 * and updates when the WindowService pushes new data via outgoingEvents$.
 */
@Component({
  selector: 'app-dirlist',
  standalone: true,
  template: `
    <div class="dirlist">
      <div class="dirlist-path">{{ path }}</div>
      <table class="dirlist-table" role="grid" aria-label="Verzeichnisinhalt">
        <thead>
          <tr>
            <th>Name</th>
            <th>Größe</th>
            <th>Datum</th>
            <th>Zeit</th>
          </tr>
        </thead>
        <tbody>
          @for (entry of entries; track entry.name; let i = $index) {
            @if (entry.isdir !== 0) {
              <tr class="dirlist-dir" (click)="onChangeDir(entry.name)" (keydown.enter)="onChangeDir(entry.name)" [attr.tabindex]="i">
                <td class="dirlist-name dirlist-name--dir">{{ entry.name }}/</td>
                <td></td>
                <td>{{ entry.filedate }}</td>
                <td>{{ entry.filetime }}</td>
              </tr>
            } @else {
              <tr class="dirlist-file" (click)="onFileOpen(entry.name)" (keydown.enter)="onFileOpen(entry.name)" [attr.tabindex]="i">
                <td class="dirlist-name dirlist-name--file">{{ entry.name }}</td>
                <td class="dirlist-size">{{ entry.size }}</td>
                <td>{{ entry.filedate }}</td>
                <td>{{ entry.filetime }}</td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [
    `
      .dirlist {
        font-family: monospace;
        font-size: 12px;
        color: #cdd6f4;
      }

      .dirlist-path {
        font-weight: bold;
        padding: 4px 0 8px 0;
        color: #89b4fa;
      }

      .dirlist-table {
        width: 100%;
        border-collapse: collapse;
      }

      .dirlist-table th {
        text-align: left;
        padding: 2px 8px;
        border-bottom: 1px solid #45475a;
        color: #a6adc8;
        font-weight: 500;
      }

      .dirlist-table td {
        padding: 2px 8px;
      }

      .dirlist-table tr {
        cursor: pointer;

        &:hover {
          background: #313244;
        }

        &:focus {
          outline: 1px solid #89b4fa;
          outline-offset: -1px;
        }
      }

      .dirlist-name--dir {
        color: #89dceb;
      }

      .dirlist-name--file {
        color: #cdd6f4;
      }

      .dirlist-size {
        text-align: right;
        color: #a6adc8;
      }
    `,
  ],
})
export class DirListComponent implements OnInit, OnDestroy {
  @Input({ required: true }) config!: WindowConfig;

  path = '';
  entries: FileEntry[] = [];

  private readonly windowService = inject(WindowService);
  private readonly filesHandler = inject(FilesGmcpHandler);
  private subscription?: Subscription;

  ngOnInit(): void {
    this.updateFromConfig();

    // Subscribe to data updates from the WindowService
    this.subscription = this.windowService.outgoingEvents$.subscribe(
      (event) => {
        if (event.windowId !== this.config.windowId) {
          return;
        }

        if (event.action === WindowAction.DataChanged && event.data !== undefined) {
          const dirData = event.data as DirListData;

          if (dirData.path !== undefined && dirData.entries !== undefined) {
            this.path = dirData.path;
            this.entries = dirData.entries;
          }
        }
      },
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  onFileOpen(filename: string): void {
    this.filesHandler.openFile(this.path, filename);
  }

  onChangeDir(dirname: string): void {
    this.filesHandler.changeDirectory(this.path, dirname);
  }

  private updateFromConfig(): void {
    const data = this.config.data as DirListData | undefined;

    if (data !== undefined) {
      this.path = data.path;
      this.entries = data.entries;
    }
  }
}
