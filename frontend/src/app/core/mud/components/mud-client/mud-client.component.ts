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
  MudInputController,
  MudPromptManager,
  MudPromptContext,
} from '@mudlet3/frontend/features/terminal';

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
  private readonly promptManager: MudPromptManager;
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

    this.promptManager = new MudPromptManager(this.terminal, this.inputController);
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

    this.promptManager.reset();
    this.updateLocalEcho(this.currentShowEcho);
  }

  private updateLocalEcho(showEcho: boolean) {
    this.localEchoEnabled = this.isEditMode && showEcho;
    this.inputController.setLocalEcho(this.localEchoEnabled);
  }



  private beforeMudOutput(_data: string) {
    this.promptManager.beforeServerOutput(this.getPromptContext());
  }

  private afterMudOutput(data: string) {
    this.promptManager.afterServerOutput(data, this.getPromptContext());
  }

  private transformMudOutput(data: string): string {
    return this.promptManager.transformOutput(data);
  }

  private getPromptContext(): MudPromptContext {
    return {
      isEditMode: this.isEditMode,
      terminalReady: this.terminalReady,
      localEchoEnabled: this.localEchoEnabled,
    };
  }




}


