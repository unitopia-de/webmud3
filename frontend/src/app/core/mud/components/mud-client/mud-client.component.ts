import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { AttachAddon } from '@xterm/addon-attach';
import { FitAddon } from '@xterm/addon-fit';
import { IDisposable, Terminal } from '@xterm/xterm';
import { Subscription } from 'rxjs';

import { MudService } from '../../services/mud.service';
import { SecureString } from '@mudlet3/frontend/shared';
import { LinemodeState } from '@mudlet3/frontend/features/sockets';
import {
  CTRL,
  CSI_REGEX,
  SS3,
  SS3_LEN,
  cursorLeft,
  resetLine,
} from '@mudlet3/frontend/features/terminal';
import { MudInputController } from '@mudlet3/frontend/features/terminal';

type SocketListener = EventListener;
type MudSocketAdapterHooks = {
  transformMessage?: (data: string) => string;
  beforeMessage?: (data: string) => void;
  afterMessage?: (data: string) => void;
};

class MudSocketAdapter {
  public binaryType: BinaryType = 'arraybuffer';
  public readyState = WebSocket.OPEN;

  private readonly listeners = new Map<string, Set<SocketListener>>();
  private readonly subscription: Subscription;

  constructor(
    private readonly mudService: MudService,
    private readonly hooks?: MudSocketAdapterHooks,
  ) {
    this.subscription = this.mudService.mudOutput$.subscribe(({ data }) => {
      this.hooks?.beforeMessage?.(data);

      const transformed = this.hooks?.transformMessage?.(data) ?? data;

      if (transformed.length > 0) {
        this.dispatch(
          'message',
          new MessageEvent('message', { data: transformed }),
        );
      }

      this.hooks?.afterMessage?.(transformed);
    });
  }

  public addEventListener(type: string, listener: SocketListener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(listener);
  }

  public removeEventListener(type: string, listener: SocketListener) {
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }

    listeners.delete(listener);

    if (listeners.size === 0) {
      this.listeners.delete(type);
    }
  }

  public send(): void {
    // Input handling is managed separately via terminal.onData
  }

  public close() {
    this.dispose();
  }

  public dispose() {
    this.subscription.unsubscribe();
    this.listeners.clear();
  }

  private dispatch(type: string, event: Event) {
    const listeners = this.listeners.get(type);

    if (!listeners) {
      return;
    }

    listeners.forEach((listener) => listener.call(this, event));
  }
}

@Component({
  selector: 'app-mud-client',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './mud-client.component.html',
  styleUrls: ['./mud-client.component.scss'],
})
export class MudClientComponent implements AfterViewInit, OnDestroy {
  private readonly mudService = inject(MudService);

  private readonly terminal: Terminal;
  private readonly inputController: MudInputController;
  private readonly terminalFitAddon = new FitAddon();
  private readonly socketAdapter = new MudSocketAdapter(this.mudService, {
    transformMessage: (data) => this.transformMudOutput(data),
    beforeMessage: (data) => this.beforeMudOutput(data),
    afterMessage: (data) => this.afterMudOutput(data),
  });
  private readonly terminalAttachAddon = new AttachAddon(
    this.socketAdapter as unknown as WebSocket,
    { bidirectional: false },
  );

  private readonly terminalDisposables: IDisposable[] = [];
  private readonly resizeObs = new ResizeObserver(() => {
    this.handleTerminalResize();
  });

  private showEchoSubscription?: Subscription;
  private linemodeSubscription?: Subscription;
  private localEchoEnabled = true;
  private currentShowEcho = true;
  private isEditMode = true;
  private lastViewportSize?: { columns: number; rows: number };
  private terminalReady = false;
  private editLineHidden = false;
  private serverLineBuffer = '';
  private hiddenPrompt = '';
  private leadingLineBreaksToStrip = 0;

  @ViewChild('hostRef', { static: true })
  private readonly terminalRef!: ElementRef<HTMLDivElement>;

  protected readonly isConnected$ = this.mudService.connectedToMud$;
  protected readonly showEcho$ = this.mudService.showEcho$;

  constructor() {
    this.terminal = new Terminal({
      fontFamily: 'JetBrainsMono, monospace',
      theme: { background: '#000', foreground: '#ccc' },
      disableStdin: false,
      screenReaderMode: true,
    });

    this.inputController = new MudInputController(this.terminal, ({ message, echoed }) =>
      this.handleCommittedInput(message, echoed),
    );
    this.inputController.setLocalEcho(this.localEchoEnabled);
  }

  ngAfterViewInit() {
    this.terminal.open(this.terminalRef.nativeElement);
    this.terminal.loadAddon(this.terminalFitAddon);
    this.terminal.loadAddon(this.terminalAttachAddon);
    this.terminal.focus();

    this.terminalDisposables.push(
      this.terminal.onData((data) => this.handleInput(data)),
    );

    this.showEchoSubscription = this.showEcho$.subscribe((showEcho) => {
      this.currentShowEcho = showEcho;
      this.updateLocalEcho(showEcho);
    });

    this.linemodeSubscription = this.mudService.linemode$.subscribe((state) =>
      this.setLinemode(state),
    );

    this.resizeObs.observe(this.terminalRef.nativeElement);
    this.terminalReady = true;

    const columns = this.terminal.cols;
    const rows = this.terminal.rows + 1;

    this.mudService.connect({ columns, rows });
  }

  ngOnDestroy() {
    this.resizeObs.disconnect();

    this.terminalDisposables.forEach((disposable) => disposable.dispose());
    this.showEchoSubscription?.unsubscribe();
    this.linemodeSubscription?.unsubscribe();

    this.terminalAttachAddon.dispose();
    this.socketAdapter.dispose();
    this.terminal.dispose();
  }

  protected connect() {
    const columns = this.terminal.cols;
    const rows = this.terminal.rows;

    this.mudService.connect({ columns, rows });
  }

  private handleTerminalResize() {
    this.terminalFitAddon.fit();

    const columns = this.terminal.cols;
    const rows = this.terminal.rows;

    if (
      !Number.isFinite(columns) ||
      !Number.isFinite(rows) ||
      columns <= 0 ||
      rows <= 0
    ) {
      return;
    }

    if (
      this.lastViewportSize?.columns === columns &&
      this.lastViewportSize?.rows === rows
    ) {
      return;
    }

    this.lastViewportSize = { columns, rows };

    this.mudService.updateViewportSize(columns, rows);
  }

  private handleCommittedInput(message: string, echoed: boolean) {
    const payload: string | SecureString = echoed ? message : { value: message };

    this.mudService.sendMessage(payload);
  }

  private handleInput(data: string) {
    if (!this.isEditMode) {
      if (data.length > 0) {
        this.mudService.sendMessage(data);
      }

      return;
    }

    this.inputController.handleData(data);
  }

  private setLinemode(state: LinemodeState) {
    const wasEditMode = this.isEditMode;

    this.isEditMode = state.edit;

    if (!this.isEditMode) {
      if (wasEditMode) {
        const pending = this.inputController.flush();

        if (pending) {
          this.handleCommittedInput(pending.message, pending.echoed);
        }
      }

      this.inputController.reset();
    } else if (!wasEditMode) {
      this.inputController.reset();
    }

    this.editLineHidden = false;
    this.serverLineBuffer = '';
    this.hiddenPrompt = '';
    this.leadingLineBreaksToStrip = 0;
    this.updateLocalEcho(this.currentShowEcho);
  }

  private updateLocalEcho(showEcho: boolean) {
    this.localEchoEnabled = this.isEditMode && showEcho;
    this.inputController.setLocalEcho(this.localEchoEnabled);
  }

  private skipEscapeSequence(segment: string): number {
    if (segment.startsWith(SS3) && segment.length >= SS3_LEN) {
      return SS3_LEN;
    }

    const match = segment.match(CSI_REGEX);

    if (match) {
      return match[0].length;
    }

    // Default to consuming only the ESC character
    return CTRL.ESC.length;
  }

  private beforeMudOutput(_data: string) {
    if (
      !this.isEditMode ||
      !this.terminalReady ||
      !this.localEchoEnabled ||
      !this.inputController.hasContent() ||
      this.editLineHidden
    ) {
      return;
    }

    this.hiddenPrompt = this.serverLineBuffer;
    this.serverLineBuffer = '';
    this.leadingLineBreaksToStrip = 1;
    this.terminal.write(resetLine);
    this.editLineHidden = true;
  }

  private afterMudOutput(data: string) {
    this.trackServerLine(data);

    if (
      !this.editLineHidden ||
      !this.isEditMode ||
      !this.terminalReady ||
      !this.localEchoEnabled ||
      !this.inputController.hasContent()
    ) {
      return;
    }

    queueMicrotask(() => this.restoreEditInput());
  }

  private restoreEditInput() {
    if (!this.editLineHidden) {
      return;
    }

    if (!this.isEditMode || !this.terminalReady || !this.localEchoEnabled) {
      this.editLineHidden = false;
      return;
    }

    const snapshot = this.inputController.getSnapshot();

    if (snapshot.buffer.length === 0) {
      this.editLineHidden = false;
      return;
    }

    this.terminal.write(resetLine);

    const prefix =
      this.serverLineBuffer.length > 0
        ? this.serverLineBuffer
        : this.hiddenPrompt;

    if (prefix.length > 0) {
      this.terminal.write(prefix);
    }

    this.terminal.write(snapshot.buffer);

    const moveLeft = snapshot.buffer.length - snapshot.cursor;

    if (moveLeft > 0) {
      this.terminal.write(cursorLeft(moveLeft));
    }

    this.editLineHidden = false;
    this.hiddenPrompt = '';
    this.serverLineBuffer = prefix;
    this.leadingLineBreaksToStrip = 0;
  }

  private transformMudOutput(data: string): string {
    if (this.leadingLineBreaksToStrip === 0 || data.length === 0) {
      return data;
    }

    let startIndex = 0;
    let remainingBreaks = this.leadingLineBreaksToStrip;

    while (startIndex < data.length && remainingBreaks > 0) {
      const char = data[startIndex];

      if (char === CTRL.LF) {
        remainingBreaks -= 1;
        startIndex += 1;
        continue;
      }

      if (char === CTRL.CR) {
        startIndex += 1;
        continue;
      }

      break;
    }

    this.leadingLineBreaksToStrip = remainingBreaks;

    if (startIndex === 0) {
      this.leadingLineBreaksToStrip = 0;
      return data;
    }

    if (startIndex >= data.length) {
      return '';
    }

    this.leadingLineBreaksToStrip = 0;
    return data.slice(startIndex);
  }

  private trackServerLine(data: string) {
    let index = 0;

    while (index < data.length) {
      const char = data[index];

      if (char === CTRL.CR || char === CTRL.LF) {
        this.serverLineBuffer = '';
        index += 1;
        continue;
      }

      if (char === CTRL.BS || char === CTRL.DEL) {
        this.serverLineBuffer = this.serverLineBuffer.slice(0, -1);
        index += 1;
        continue;
      }

      if (char === CTRL.ESC) {
        const consumed = this.skipEscapeSequence(data.slice(index));
        const parsedSequence =
          consumed > 0 ? data.slice(index, index + consumed) : char;

        this.serverLineBuffer += parsedSequence;
        index += Math.max(consumed, 1);
        continue;
      }

      this.serverLineBuffer += char;
      index += 1;
    }
  }
}
