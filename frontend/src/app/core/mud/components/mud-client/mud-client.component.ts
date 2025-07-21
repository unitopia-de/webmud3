import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';

import { MudService } from '../../services/mud.service';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-mud-client',
  standalone: true,
  imports: [AsyncPipe, FormsModule],
  templateUrl: './mud-client.component.html',
  styleUrls: ['./mud-client.component.scss'],
})
export class MudClientComponent implements AfterViewInit, OnDestroy {
  /** Verbindungs- und Echo-Status aus dem Service */
  readonly isConnected$ = this.mud.connectedToMud$;
  readonly showEcho$ = this.mud.showEcho$;

  @ViewChild('host', { static: true })
  host!: ElementRef<HTMLDivElement>;

  constructor(private mud: MudService) {
    /* Direkt beim Laden verbinden */
    this.mud.connect();
  }

  onSend(text: string): void {
    this.mud.sendMessage(text);
  }

  connect(): void {
    this.mud.connect();
  }

  ngAfterViewInit() {
    this.mud.initTerminal(this.host.nativeElement); // Terminal einbetten
  }

  ngOnDestroy() {
    this.mud.disposeTerminal(); // sauber aufräumen
  }

  value = '';

  protected submit(ev: Event) {
    ev.preventDefault();
    const trimmed = this.value.trim();
    if (trimmed) {
      this.onSend(trimmed);
      this.value = ''; // Eingabe leeren
    }
  }
}
