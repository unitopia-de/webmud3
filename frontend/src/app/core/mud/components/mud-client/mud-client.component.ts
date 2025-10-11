import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

import { MudService } from '../../services/mud.service';

@Component({
  selector: 'app-mud-client',
  standalone: true,
  imports: [AsyncPipe, FormsModule],
  templateUrl: './mud-client.component.html',
  styleUrls: ['./mud-client.component.scss'],
})
export class MudClientComponent implements AfterViewInit, OnDestroy {
  private readonly terminal: Terminal;

  private readonly terminalFitAddon = new FitAddon();

  // Das Element, in dem das Terminal gerendert wird
  @ViewChild('hostRef', { static: true })
  private readonly terminalRef!: ElementRef<HTMLDivElement>;

  @ViewChild('inputRef')
  private readonly inputRef?: ElementRef<HTMLTextAreaElement>;

  private readonly mudService = inject(MudService);

  private readonly resizeObs = new ResizeObserver(() => {
    this.terminalFitAddon.fit();
  });

  protected readonly isConnected$ = this.mudService.connectedToMud$;

  protected readonly showEcho$ = this.mudService.showEcho$;

  protected value = ''; // Eingabepuffer für das Textfeld

  constructor() {
    this.terminal = new Terminal({
      fontFamily: 'JetBrainsMono, monospace',
      theme: { background: '#000', foreground: '#ccc' },
      disableStdin: true,
      screenReaderMode: true,
    });

    this.mudService.connect(); // beim Laden verbinden
  }

  ngAfterViewInit() {
    this.terminal.open(this.terminalRef.nativeElement);
    this.terminal.loadAddon(this.terminalFitAddon);

    /* Backend → Terminal */
    this.mudService.mudOutput$.subscribe(({ data }) =>
      this.terminal.write(data),
    );

    // Todo Limitieren der Masse an Events:

    //   const resize$ = fromEventPattern<ResizeObserverEntry[]>(
    //   handler => {
    //     const ro = new ResizeObserver(handler);
    //     ro.observe(this.terminalHost.nativeElement);
    //     return ro;               // fürs Unsubscribe
    //   },
    //   (handler, ro) => ro.disconnect()
    // );

    // this.sub = resize$
    //   .pipe(debounceTime(150))   // oder throttleTime(200), auditTime(100) …
    //   .subscribe(() => this.terminalFitAddon.fit());

    this.resizeObs.observe(this.terminalRef.nativeElement);
  }

  ngOnDestroy() {
    this.resizeObs.disconnect();
    this.terminal.dispose();
  }

  protected submit(ev: Event) {
    ev.preventDefault();

    // Wir schicken alles 1:1 an den Server, egal ob es leer ist oder nicht
    this.mudService.sendMessage(this.value);

    this.value = ''; // Eingabepuffer leeren
  }

  protected connect() {
    this.mudService.connect();
  }
}
