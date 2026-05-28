import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import loader from '@monaco-editor/loader';
import type * as MonacoNs from 'monaco-editor';

import { MudNoticeService } from '@webmud3/frontend/core/mud/services/mud-notice.service';
import { SelectionModeService } from '@webmud3/frontend/features/terminal';
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
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) config!: WindowConfig;

  @ViewChild('host', { static: true })
  private hostRef!: ElementRef<HTMLDivElement>;

  private readonly files = inject(FilesService);
  private readonly mudNotices = inject(MudNoticeService);
  private readonly cdr = inject(ChangeDetectorRef);
  public readonly selectionMode = inject(SelectionModeService);

  // DOM-level pointer listener for the two-tap range selection feature.
  // We use a raw DOM listener rather than `editor.onMouseDown` because
  // Monaco's normalised mouse event does not fire reliably for touch
  // input on canvas-rendered builds, while the underlying pointerdown
  // always does.
  private selectionPointerHandler?: (event: PointerEvent) => void;
  private selectionPointerHandlerTarget?: HTMLElement;
  private scrollDisposable?: MonacoNs.IDisposable;
  private layoutDisposable?: MonacoNs.IDisposable;

  // Bumped on every Monaco scroll/layout event so the computed marker
  // positions re-evaluate — same pattern as the xterm side.
  private readonly markerInvalidator = signal(0);

  /**
   * Pixel coordinates (relative to the editor's outer DOM node) for the
   * start marker. `null` when no anchor is set, when the anchor is in a
   * different target, or when the position has scrolled off-screen.
   */
  public readonly startMarkerPos = computed<{
    x: number;
    y: number;
  } | null>(() => {
    this.markerInvalidator();
    const anchor = this.selectionMode.anchor();
    if (anchor === null || anchor.target !== 'editor') return null;
    return this.editorPosToPixel(
      anchor.data as { lineNumber: number; column: number },
    );
  });

  /** Same as `startMarkerPos` for the end marker. */
  public readonly endMarkerPos = computed<{
    x: number;
    y: number;
  } | null>(() => {
    this.markerInvalidator();
    const end = this.selectionMode.end();
    if (end === null || end.target !== 'editor') return null;
    return this.editorPosToPixel(
      end.data as { lineNumber: number; column: number },
    );
  });

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

    if (this.selectionPointerHandler && this.selectionPointerHandlerTarget) {
      this.selectionPointerHandlerTarget.removeEventListener(
        'pointerdown',
        this.selectionPointerHandler,
        { capture: true },
      );
    }
    this.selectionPointerHandler = undefined;
    this.selectionPointerHandlerTarget = undefined;
    this.scrollDisposable?.dispose();
    this.scrollDisposable = undefined;
    this.layoutDisposable?.dispose();
    this.layoutDisposable = undefined;

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

    let statusAfterLoad = 'Datei geladen';

    if (content === '' && fileinfo.lasturl) {
      try {
        content = (await this.files.loadContent(fileinfo).toPromise()) ?? '';
      } catch (err) {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          // 404 = Datei existiert auf dem MUD-Server noch nicht.
          // Editor mit leerem Inhalt öffnen, damit der User sie anlegen kann.
          content = '';
          statusAfterLoad = 'Neue Datei';
        } else {
          this.errorMessage = `Datei konnte nicht geladen werden: ${this.formatError(err)}`;
          this.statusMessage = '';
          this.cdr.markForCheck();
          return;
        }
      }
    }

    if (this.destroyed) {
      return;
    }

    this.initialContent = content;
    this.statusMessage = statusAfterLoad;
    // OnPush: ohne markForCheck bleibt die Statuszeile auf "Lade Datei …" hängen,
    // weil die Zuweisung aus einer async-Promise-Kette nach ngAfterViewInit kommt.
    this.cdr.markForCheck();

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

    this.installClipboardActions(this.editor);
    this.installSelectionTapHandler(this.editor);
  }

  /**
   * Wires the two-tap range-selection flow into Monaco via a capture-phase
   * DOM pointerdown listener on the editor's root node. When the footer
   * button is armed, the first tap stores the buffer position as anchor
   * and the second tap calls `editor.setSelection(...)`. Outside selection
   * mode the listener is a no-op and Monaco's normal handling runs.
   *
   * Why a DOM listener instead of `editor.onMouseDown`: that event does
   * not reliably fire for touch input on canvas-rendered builds of Monaco,
   * which is exactly the platform this feature targets. Pointer events on
   * the editor's outer DOM node fire for mouse and touch alike. We use
   * `editor.getTargetAtClientPoint(x, y)` to resolve the tap coordinates
   * back to an editor position — same conversion Monaco does internally
   * for clicks.
   */
  private installSelectionTapHandler(
    editor: MonacoNs.editor.IStandaloneCodeEditor,
  ): void {
    const editorDom = editor.getDomNode();
    if (!editorDom) {
      return;
    }

    this.selectionPointerHandler = (event: PointerEvent) => {
      if (!this.selectionMode.isActive()) {
        return;
      }

      // Marker handles live inside the editor's overlay container —
      // let them process their own pointer events for dragging.
      const eventTarget = event.target as HTMLElement | null;
      if (eventTarget?.closest('.selection-marker')) {
        return;
      }

      // In `adjusting` the user refines via the handles. A bare tap on
      // the editor background must not re-anchor — they hit the footer
      // button to commit explicitly.
      if (this.selectionMode.state() === 'adjusting') {
        return;
      }

      const target = editor.getTargetAtClientPoint(
        event.clientX,
        event.clientY,
      );
      const position = target?.position;
      if (!position) {
        return;
      }

      // Suppress Monaco's normal cursor-placement so the tap is fully
      // ours. Without this, the editor would move the caret into the
      // buffer and the user would see a transient blink before our
      // selection lands.
      event.preventDefault();
      event.stopPropagation();

      const editorPos = {
        lineNumber: position.lineNumber,
        column: position.column,
      };

      const anchor = this.selectionMode.anchor();
      if (anchor === null || anchor.target !== 'editor') {
        this.selectionMode.setAnchor('editor', editorPos);
        return;
      }

      // Second tap → place end marker, render initial range, enter
      // adjusting mode for fine-tuning via handle drag.
      this.selectionMode.setEnd('editor', editorPos);
      this.applyMonacoSelectionFromMarkers();
      editor.focus();
    };

    this.selectionPointerHandlerTarget = editorDom;
    editorDom.addEventListener('pointerdown', this.selectionPointerHandler, {
      capture: true,
    });

    // Re-evaluate marker pixel positions whenever Monaco scrolls or
    // re-layouts (font change, resize, …) — without this the handles
    // drift off their anchor cells.
    this.scrollDisposable = editor.onDidScrollChange(() =>
      this.markerInvalidator.update((n) => n + 1),
    );
    this.layoutDisposable = editor.onDidLayoutChange(() =>
      this.markerInvalidator.update((n) => n + 1),
    );
  }

  /**
   * Buffer position → pixel coords (relative to the editor's outer DOM
   * node). Returns `null` when the position is scrolled off-screen.
   * Wraps Monaco's public `getScrolledVisiblePosition` API which
   * already accounts for line height, character width and scroll
   * offset.
   */
  private editorPosToPixel(pos: {
    lineNumber: number;
    column: number;
  }): { x: number; y: number } | null {
    if (!this.editor) return null;
    const visible = this.editor.getScrolledVisiblePosition(pos);
    if (visible === null) return null;
    // Monaco returns `{ top, left, height }`. Centre the handle
    // vertically on the line; we use `left` as the horizontal anchor
    // (cursor sits between cells, not in the middle of one).
    return { x: visible.left, y: visible.top + visible.height / 2 };
  }

  /**
   * Reads anchor/end signals and applies the range via
   * `editor.setSelection(...)`. Called after the second tap and on
   * every pointermove during a marker drag.
   */
  private applyMonacoSelectionFromMarkers(): void {
    if (!this.editor) return;
    const anchor = this.selectionMode.anchor();
    const end = this.selectionMode.end();
    if (
      anchor === null ||
      end === null ||
      anchor.target !== 'editor' ||
      end.target !== 'editor'
    ) {
      return;
    }

    const a = anchor.data as { lineNumber: number; column: number };
    const b = end.data as { lineNumber: number; column: number };

    this.editor.setSelection({
      startLineNumber: a.lineNumber,
      startColumn: a.column,
      endLineNumber: b.lineNumber,
      endColumn: b.column,
    });
  }

  /**
   * Drag-start handler for the marker overlays. Mirrors the xterm path:
   * capture the pointer to the handle, recompute editor position from
   * each pointermove via `getTargetAtClientPoint`, push into the
   * selection service and re-render.
   */
  public onMarkerPointerDown(
    event: PointerEvent,
    which: 'start' | 'end',
  ): void {
    if (!this.editor) return;
    event.preventDefault();
    event.stopPropagation();

    const editor = this.editor;
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);

    const onMove = (e: PointerEvent) => {
      const target = editor.getTargetAtClientPoint(e.clientX, e.clientY);
      const position = target?.position;
      if (!position) return;
      const editorPos = {
        lineNumber: position.lineNumber,
        column: position.column,
      };
      if (which === 'start') {
        this.selectionMode.updateAnchor(editorPos);
      } else {
        this.selectionMode.updateEnd(editorPos);
      }
      this.applyMonacoSelectionFromMarkers();
    };

    const onUp = () => {
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  /**
   * Adds working Cut/Copy/Paste actions to the editor's context menu.
   *
   * Why: Monaco's stock Cut/Copy/Paste actions go through an internal
   * command pipeline that calls `accessor.get(IProductService)`. The
   * standalone build does not register that service, so the menu clicks
   * throw `[invokeFunction] unknown service 'productService'` and do
   * nothing. Ctrl+C/V/X aren't affected — they bypass Monaco's command
   * runner and hit the browser's native clipboard events directly.
   *
   * Why unique IDs instead of overriding Monaco's IDs: `addAction` with
   * the same id as a built-in action does not unregister the built-in's
   * context-menu entry (that's a separate `MenuRegistry` registration we
   * can't reach without private API access). So overriding produced
   * **duplicate** menu items. Using own ids documents the conflict
   * clearly: the German "Kopieren / Ausschneiden / Einfügen" entries
   * are the working ones; the English defaults are Monaco's broken
   * leftovers we can't remove cleanly.
   *
   * No `keybindings` set — Ctrl+C/V/X already work via the browser path
   * and we don't want to shadow them with this slower clipboard-API
   * implementation.
   */
  private installClipboardActions(
    editor: MonacoNs.editor.IStandaloneCodeEditor,
  ): void {
    editor.addAction({
      id: 'webmud3.editor.clipboardCut',
      label: 'Ausschneiden',
      contextMenuGroupId: '9_cutcopypaste',
      contextMenuOrder: 0.1,
      run: async (ed) => {
        if (this.readOnly) {
          return;
        }
        const selection = ed.getSelection();
        const model = ed.getModel();
        if (!selection || selection.isEmpty() || !model) {
          return;
        }
        const text = model.getValueInRange(selection);
        try {
          await navigator.clipboard.writeText(text);
          ed.executeEdits('webmud3-cut', [
            { range: selection, text: '', forceMoveMarkers: true },
          ]);
        } catch (err) {
          console.warn('[Editor] Clipboard cut failed:', err);
        }
      },
    });

    editor.addAction({
      id: 'webmud3.editor.clipboardCopy',
      label: 'Kopieren',
      contextMenuGroupId: '9_cutcopypaste',
      contextMenuOrder: 0.2,
      run: async (ed) => {
        const selection = ed.getSelection();
        const model = ed.getModel();
        if (!selection || selection.isEmpty() || !model) {
          return;
        }
        const text = model.getValueInRange(selection);
        try {
          await navigator.clipboard.writeText(text);
        } catch (err) {
          console.warn('[Editor] Clipboard copy failed:', err);
        }
      },
    });

    editor.addAction({
      id: 'webmud3.editor.clipboardPaste',
      label: 'Einfügen',
      contextMenuGroupId: '9_cutcopypaste',
      contextMenuOrder: 0.3,
      run: async (ed) => {
        if (this.readOnly) {
          return;
        }
        let text: string;
        try {
          text = await navigator.clipboard.readText();
        } catch (err) {
          console.warn('[Editor] Clipboard read failed:', err);
          return;
        }
        if (!text) {
          return;
        }
        const selection = ed.getSelection();
        if (!selection) {
          return;
        }
        ed.executeEdits('webmud3-paste', [
          { range: selection, text, forceMoveMarkers: true },
        ]);
      },
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
