import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import loader from '@monaco-editor/loader';
import type * as MonacoNs from 'monaco-editor';

import { MudNoticeService } from '@webmud3/frontend/core/mud/services/mud-notice.service';
import type { WindowConfig } from '@webmud3/frontend/features/windows/window-config';
import type { FileInfo } from '../gmcp/signals/mud-signals';
import { FilesService } from './files.service';

type EditorPayload = {
  fileinfo: FileInfo;
};

/**
 * Code editor window content. Hosts a lazy-loaded Monaco editor instance.
 *
 * Receives its `WindowConfig` via the `config` input wired up by the
 * Window-Container's `ngComponentOutletInputs`. The hosted file is read from
 * `config.data.fileinfo`; the body is fetched via `FilesService.loadContent`.
 *
 * Save / cancel actions communicate back to the WindowService through
 * `config.outgoing` so the surrounding window can be closed by the host.
 *
 * Accessibility: `accessibilitySupport: 'on'` activates Monaco's screen-reader
 * paging mode (NVDA / JAWS / VoiceOver compatible).
 */
@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) config!: WindowConfig;

  @ViewChild('host', { static: true })
  private hostRef!: ElementRef<HTMLDivElement>;

  private readonly files = inject(FilesService);
  private readonly mudNotices = inject(MudNoticeService);
  private readonly cdr = inject(ChangeDetectorRef);

  private editor: MonacoNs.editor.IStandaloneCodeEditor | undefined;
  private initialContent = '';
  private hasUnsavedChanges = false;
  private destroyed = false;
  // True after at least one successful save; suppresses the cancel-on-destroy
  // path so we do not tell the MUD to drop a file we just persisted.
  private wasSaved = false;
  // Idempotency flag: ensures we send `Files.fileCanceled` at most once even
  // if both onCancel and ngOnDestroy trigger (e.g. cancel button -> close ->
  // component destroyed).
  private cancelSent = false;

  public saving = false;

  public statusMessage = 'Lade Datei …';
  public errorMessage: string | null = null;

  public get fileinfo(): FileInfo | undefined {
    return (this.config?.data as EditorPayload | undefined)?.fileinfo;
  }

  public get title(): string {
    return this.fileinfo?.title || this.fileinfo?.filename || 'Editor';
  }

  public get readOnly(): boolean {
    return this.fileinfo?.writeacl === false;
  }

  ngOnInit(): void {
    if (!this.fileinfo) {
      this.errorMessage = 'Keine Datei-Information vorhanden.';
      this.statusMessage = '';
    }
  }

  ngAfterViewInit(): void {
    if (!this.fileinfo) {
      return;
    }

    void this.bootstrap(this.fileinfo);
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    // Catch close paths that bypass onCancel (X button, closeAll on disconnect,
    // route change, ...) and still notify the MUD so the temp file gets
    // released. Idempotent via `cancelSent` if onCancel already ran.
    this.sendCancelToMud();

    if (this.editor) {
      const model = this.editor.getModel();
      this.editor.dispose();
      model?.dispose();
      this.editor = undefined;
    }
  }

  public onSave(closeAfter: boolean): void {
    if (this.readOnly || this.editor === undefined || this.saving) {
      return;
    }

    const fileinfo = this.fileinfo;
    if (!fileinfo) {
      return;
    }

    const content = this.editor.getValue();

    this.saving = true;
    this.statusMessage = 'Speichere …';
    this.errorMessage = null;

    this.files.saveFile(fileinfo, content).subscribe({
      next: () => {
        if (this.destroyed) {
          return;
        }

        this.initialContent = content;
        this.hasUnsavedChanges = false;
        this.saving = false;
        this.wasSaved = true;
        this.statusMessage = 'Gespeichert.';

        // OnPush change detection does not pick up mutations made inside
        // a subscribe() callback automatically — without an explicit
        // markForCheck() the toolbar would still show "Speichere …" until
        // the next external event.
        this.cdr.markForCheck();

        // Mirror the success into the main MUD terminal so the user gets
        // the confirmation even when the editor window is hidden behind
        // others.
        // Use the full MUD path (`file`) so the user can tell which copy of
        // a file was saved when several editors are open at once. Fall back
        // to the basename only if the path is missing.
        this.mudNotices.notify(
          `[Datei ${fileinfo.file || fileinfo.filename} gespeichert]`,
        );

        if (closeAfter) {
          this.config.outgoing.next('do_close');
        }
      },
      error: (err: unknown) => {
        if (this.destroyed) {
          return;
        }

        this.saving = false;
        this.errorMessage = `Fehler beim Speichern: ${this.formatError(err)}`;
        this.statusMessage = '';
        this.cdr.markForCheck();
      },
    });
  }

  public onCancel(): void {
    if (
      this.hasUnsavedChanges &&
      !window.confirm('Willst Du ohne Speichern schliessen?')
    ) {
      return;
    }

    // Tell the MUD to drop the temp file before we close the window. The
    // ngOnDestroy fallback below also calls this — `cancelSent` ensures we
    // never send the message twice.
    this.sendCancelToMud();
    this.config.outgoing.next('do_close');
  }

  /**
   * Sends `Files.fileCanceled` to the MUD so it can `gmcp_edit_drop_tempfile`.
   * No-op when there is no fileinfo, after a successful save, or when this
   * method has already run for the current editor session.
   */
  private sendCancelToMud(): void {
    if (this.cancelSent || this.wasSaved || !this.fileinfo) {
      return;
    }

    this.cancelSent = true;
    this.files.cancelFile(this.fileinfo);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async bootstrap(fileinfo: FileInfo): Promise<void> {
    let monaco: typeof MonacoNs;

    try {
      monaco = await loader.init();
    } catch (err) {
      this.errorMessage = `Editor konnte nicht geladen werden: ${this.formatError(err)}`;
      this.statusMessage = '';
      return;
    }

    if (this.destroyed) {
      return;
    }

    let content = fileinfo.content ?? '';

    if (content === '' && fileinfo.lasturl) {
      try {
        content = await this.files.loadContent(fileinfo).toPromise() ?? '';
      } catch (err) {
        this.errorMessage = `Datei konnte nicht geladen werden: ${this.formatError(err)}`;
        this.statusMessage = '';
        return;
      }
    }

    if (this.destroyed) {
      return;
    }

    this.initialContent = content;
    this.statusMessage = '';

    this.editor = monaco.editor.create(this.hostRef.nativeElement, {
      value: content,
      language: this.toMonacoLanguage(fileinfo.editortype),
      readOnly: this.readOnly,
      automaticLayout: true,
      accessibilitySupport: 'on',
      ariaLabel: `Datei-Editor: ${this.title}`,
      tabSize: 4,
      insertSpaces: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
    });

    this.editor.onDidChangeModelContent(() => {
      this.hasUnsavedChanges = this.editor?.getValue() !== this.initialContent;
    });
  }

  private toMonacoLanguage(editortype: string | undefined): string {
    switch (editortype) {
      case 'c_cpp':
        return 'cpp';

      case 'text':
      case undefined:
      case '':
        return 'plaintext';

      default:
        return editortype;
    }
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }

    if (typeof err === 'string') {
      return err;
    }

    return String(err);
  }
}
