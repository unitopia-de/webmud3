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
import { of, Subscription } from 'rxjs';

import { MudService } from '../../services/mud.service';
import { SecureString } from '@mudlet3/frontend/shared';
import { LinemodeState } from '@mudlet3/frontend/features/sockets';
import {
  CTRL,
  MudInputController,
  MudPromptContext,
  MudPromptManager,
  MudSocketAdapter,
} from '@mudlet3/frontend/features/terminal';

/**
 * Component-internal shape that bundles the mutable Mud client flags.
 */
type MudClientState = {
  isEditMode: boolean;
  showEcho: boolean;
  localEchoEnabled: boolean;
  terminalReady: boolean;
};

const DELETE_SEQUENCE = `${CTRL.ESC}[3~`;

/**
 * Angular wrapper around the xterm-based MUD client.  The component hosts the terminal,
 * wires the input/prompt helpers together and mirrors socket events to the view.
 */
@Component({
  selector: 'app-mud-client',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './mud-client.component.html',
  styleUrls: ['./mud-client.component.scss'],
})
export class MudClientComponent implements AfterViewInit, OnDestroy {
  private readonly mudService = inject(MudService);
  private readonly isStaticTerminalMode = true;

  private readonly terminal: Terminal;
  private readonly inputController?: MudInputController;
  private readonly promptManager?: MudPromptManager;
  private readonly terminalFitAddon = new FitAddon();
  private readonly socketAdapter?: MudSocketAdapter;
  private readonly terminalAttachAddon?: AttachAddon;

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

  protected readonly isConnected$ = this.isStaticTerminalMode
    ? of(true)
    : this.mudService.connectedToMud$;
  protected readonly showEcho$ = this.isStaticTerminalMode
    ? of(true)
    : this.mudService.showEcho$;

  /**
   * Instantiates the terminal plus helper controllers.  All services (input/prompt)
   * share the same terminal instance.
   */
  constructor() {
    this.terminal = new Terminal({
      fontFamily: 'JetBrainsMono, monospace',
      theme: { background: '#000', foreground: '#ccc' },
      disableStdin: this.isStaticTerminalMode,
      screenReaderMode: true,
    });

    if (!this.isStaticTerminalMode) {
      this.socketAdapter = new MudSocketAdapter(this.mudService.mudOutput$, {
        transformMessage: (data) => this.transformMudOutput(data),
        beforeMessage: (data) => this.beforeMudOutput(data),
        afterMessage: (data) => this.afterMudOutput(data),
      });
      this.terminalAttachAddon = new AttachAddon(
        this.socketAdapter as unknown as WebSocket,
        { bidirectional: false },
      );

      this.inputController = new MudInputController(
        this.terminal,
        ({ message, echoed }) => this.handleCommittedInput(message, echoed),
      );
      this.inputController.setLocalEcho(this.state.localEchoEnabled);

      this.promptManager = new MudPromptManager(
        this.terminal,
        this.inputController,
      );
    }
  }

  /**
   * Bootstraps the terminal after the view is ready: attaches addons, subscribes
   * to socket events and reports the initial viewport dimensions to the server.
   */
  ngAfterViewInit() {
    this.terminal.open(this.terminalRef.nativeElement);
    this.terminal.loadAddon(this.terminalFitAddon);
    this.terminalFitAddon.fit();
    this.resizeObs.observe(this.terminalRef.nativeElement);
    this.setState({ terminalReady: true });

    if (this.isStaticTerminalMode) {
      this.renderStaticDemoText();
      return;
    }

    this.terminal.loadAddon(this.terminalAttachAddon!);
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

    const columns = this.terminal.cols;
    const rows = this.terminal.rows + 1;

    this.mudService.connect({ columns, rows });
  }

  /**
   * Cleans up subscriptions and disposes terminal resources.
   */
  ngOnDestroy() {
    this.resizeObs.disconnect();

    this.terminalDisposables.forEach((disposable) => disposable.dispose());
    this.showEchoSubscription?.unsubscribe();
    this.linemodeSubscription?.unsubscribe();

    this.terminalAttachAddon?.dispose();
    this.socketAdapter?.dispose();
    this.terminal.dispose();
  }

  protected connect() {
    if (this.isStaticTerminalMode) {
      return;
    }

    const columns = this.terminal.cols;
    const rows = this.terminal.rows;

    this.mudService.connect({ columns, rows });
  }

  /**
   * Handles DOM resize events, updating xterm and notifying the backend whenever
   * the viewport size actually changes.
   */
  private handleTerminalResize() {
    this.terminalFitAddon.fit();
    if (this.isStaticTerminalMode) {
      return;
    }

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

  /**
   * Sends a committed line (or secure string) to the server.
   */
  private handleCommittedInput(message: string, echoed: boolean) {
    if (this.isStaticTerminalMode) {
      return;
    }

    const payload: string | SecureString = echoed
      ? message
      : { value: message };

    this.mudService.sendMessage(payload);
  }

  /**
   * Routes terminal keystrokes either directly to the socket (when not in edit mode)
   * or through the {@link MudInputController}.
   */
  private handleInput(data: string) {
    if (!this.inputController) {
      return;
    }

    if (!this.state.isEditMode) {
      if (data.length > 0) {
        const rewritten = this.rewriteBackspaceToDelete(data);
        this.mudService.sendMessage(rewritten);
      }

      return;
    }

    this.inputController.handleData(data);
  }

  /**
   * Applies the negotiated LINEMODE.  Pending local input is flushed before
   * leaving edit mode; both prompt and controller state are reset afterwards.
   */
  private setLinemode(state: LinemodeState) {
    const wasEditMode = this.state.isEditMode;

    if (!state.edit) {
      if (wasEditMode) {
        const pending = this.inputController?.flush();

        if (pending) {
          this.handleCommittedInput(pending.message, pending.echoed);
        }
      }

      this.inputController?.reset();
    } else if (!wasEditMode) {
      this.inputController?.reset();
    }

    this.setState({ isEditMode: state.edit });
    this.promptManager?.reset();
    this.updateLocalEcho(this.state.showEcho);
  }

  /**
   * Enables/disables local echo and informs the input controller.  The effective
   * value depends on both LINEMODE and the server-provided flag.
   */
  private updateLocalEcho(showEcho: boolean) {
    const localEchoEnabled = this.state.isEditMode && showEcho;

    this.setState({ showEcho, localEchoEnabled });
    this.inputController?.setLocalEcho(localEchoEnabled);
  }

  /**
   * Delegates to the prompt manager so it can temporarily hide the local prompt.
   */
  private beforeMudOutput(_data: string) {
    this.promptManager?.beforeServerOutput(this.getPromptContext());
  }

  /**
   * Restores prompt and user input after the server chunk has been rendered.
   */
  private afterMudOutput(data: string) {
    this.promptManager?.afterServerOutput(data, this.getPromptContext());
  }

  /**
   * Lets the prompt manager strip redundant CR/LF characters.
   */
  private transformMudOutput(data: string): string {
    return this.promptManager?.transformOutput(data) ?? data;
  }

  /**
   * Builds the prompt context consumed by the prompt manager.
   */
  private getPromptContext(): MudPromptContext {
    return {
      isEditMode: this.state.isEditMode,
      terminalReady: this.state.terminalReady,
      localEchoEnabled: this.state.localEchoEnabled,
    };
  }

  /**
   * Convenience helper for patching the local state object.
   */
  private setState(patch: Partial<MudClientState>): void {
    this.state = { ...this.state, ...patch };
  }

  /**
   * Maps DEL to BACKSPACE for non-edit mode
   */
  private rewriteBackspaceToDelete(data: string): string {
    const containsDelete = data.includes(CTRL.DEL);

    if (containsDelete) {
      // Many terminals internally map Backspace to Delete; mirror that when bypassing edit mode.
      return CTRL.BS;
    }

    return data;
  }

  /**
   * Renders a short static sample without connecting to the backend.
   */
  private renderStaticDemoText(): void {
    this.terminal.writeln('');
    this.terminal.writeln('Willkommen zum barrierefreien Testlauf.');
    this.terminal.writeln('Die Verbindung zum Server ist deaktiviert.');
    this.terminal.writeln(
      'Das Terminal zeigt ausschließlich diesen statischen Text an.',
    );
    this.terminal.writeln('');
    this.terminal.writeln(
      'Drücken von Tasten hat in diesem Modus keine Wirkung.',
    );
  }
}
