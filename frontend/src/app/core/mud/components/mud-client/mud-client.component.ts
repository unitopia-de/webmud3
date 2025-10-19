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
import { MudInputController, MudPromptContext, MudPromptManager, MudSocketAdapter } from '@mudlet3/frontend/features/terminal';

type MudClientState = {
  isEditMode: boolean;
  showEcho: boolean;
  localEchoEnabled: boolean;
  terminalReady: boolean;
};

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
  private readonly socketAdapter = new MudSocketAdapter(this.mudService.mudOutput$, {
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
  private state: MudClientState = {
    isEditMode: true,
    showEcho: true,
    localEchoEnabled: true,
    terminalReady: false,
  };
  private lastViewportSize?: { columns: number; rows: number };

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
    this.inputController.setLocalEcho(this.state.localEchoEnabled);

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
      this.updateLocalEcho(showEcho);
    });

    this.linemodeSubscription = this.mudService.linemode$.subscribe((state) =>
      this.setLinemode(state),
    );

    this.resizeObs.observe(this.terminalRef.nativeElement);
    this.setState({ terminalReady: true });

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
    if (!this.state.isEditMode) {
      if (data.length > 0) {
        this.mudService.sendMessage(data);
      }

      return;
    }

    this.inputController.handleData(data);
  }

  private setLinemode(state: LinemodeState) {
    const wasEditMode = this.state.isEditMode;

    if (!state.edit) {
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

    this.setState({ isEditMode: state.edit });
    this.promptManager.reset();
    this.updateLocalEcho(this.state.showEcho);
  }

  private updateLocalEcho(showEcho: boolean) {
    const localEchoEnabled = this.state.isEditMode && showEcho;

    this.setState({ showEcho, localEchoEnabled });
    this.inputController.setLocalEcho(localEchoEnabled);
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
      isEditMode: this.state.isEditMode,
      terminalReady: this.state.terminalReady,
      localEchoEnabled: this.state.localEchoEnabled,
    };
  }

  private setState(patch: Partial<MudClientState>): void {
    this.state = { ...this.state, ...patch };
  }

}


