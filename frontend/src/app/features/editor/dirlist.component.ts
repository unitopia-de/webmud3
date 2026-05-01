import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
} from '@angular/core';

import { GmcpService } from '@webmud3/frontend/features/gmcp/gmcp.service';
import type { WindowConfig } from '@webmud3/frontend/features/windows/window-config';
import type { FileEntry } from '../gmcp/signals/mud-signals';
import { FilesService } from './files.service';

/**
 * Directory browser window content.
 *
 * Shows the latest directory listing pushed by the MUD via `Files.DirectoryList`
 * (mapped to MudSignal `Files.Dir`). Clicking a file asks the MUD to open it
 * (`Files.OpenFile`); clicking a sub-directory navigates into it
 * (`Files.ChDir`). The MUD answers each navigation with a fresh
 * `Files.DirectoryList`, which the component picks up reactively via the
 * async pipe in the template.
 */
@Component({
  selector: 'app-dirlist',
  templateUrl: './dirlist.component.html',
  styleUrls: ['./dirlist.component.scss'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirlistComponent {
  @Input({ required: true }) config!: WindowConfig;

  private readonly files = inject(FilesService);
  private readonly gmcp = inject(GmcpService);

  public readonly listing$ = this.files.directoryList$;

  public onFileClick(entry: FileEntry, currentPath: string, event?: Event): void {
    event?.preventDefault();

    const fullPath = this.joinPath(currentPath, entry.name);
    this.gmcp.send('Files.OpenFile', { file: fullPath });
  }

  public onDirClick(entry: FileEntry, currentPath: string, event?: Event): void {
    event?.preventDefault();

    // ".." stays a relative reference — the MUD resolves it server-side.
    // Anything else is sent as an absolute path beneath the current path.
    const dir =
      entry.name === '..' ? '..' : this.joinPath(currentPath, entry.name);

    this.gmcp.send('Files.ChDir', { dir });
  }

  public onParentDir(): void {
    this.gmcp.send('Files.ChDir', { dir: '..' });
  }

  public trackByEntry(_index: number, entry: FileEntry): string {
    return `${entry.isdir ? 'd' : 'f'}:${entry.name}`;
  }

  private joinPath(base: string, name: string): string {
    if (base === '' || base === '/') {
      return `/${name}`;
    }

    return base.endsWith('/') ? `${base}${name}` : `${base}/${name}`;
  }
}
