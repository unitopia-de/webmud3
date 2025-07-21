import { Component, ViewChild } from '@angular/core';

import { MudInputComponent } from '../components/mud-input/mud-input.component';
import { MudService } from '../mud.service';
import { AsyncPipe } from '@angular/common';
import { MudOutputComponent } from 'src/app/core/mud/components/mud-output/mud-output.component';

@Component({
  selector: 'app-mud-client',
  standalone: true,
  imports: [AsyncPipe, MudOutputComponent, MudInputComponent],
  templateUrl: './mud-client.component.html',
  styleUrls: ['./mud-client.component.scss'],
})
export class MudClientComponent {
  /** Verbindungs- und Echo-Status aus dem Service */
  readonly isConnected$ = this.mud.connectedToMud$;
  readonly showEcho$ = this.mud.showEcho$;

  @ViewChild(MudInputComponent) private input?: MudInputComponent;

  constructor(private mud: MudService) {
    /* Direkt beim Laden verbinden */
    this.mud.connect();
  }

  /* -------- Event-Handler -------------------------------------- */

  onSend(text: string): void {
    this.mud.sendMessage(text);
  }

  connect(): void {
    this.mud.connect();
  }

  /* Tastendruck → Fokus ins Eingabefeld holen */
  // @HostListener('document:keydown', ['$event'])
  // focusInput(ev: KeyboardEvent) {
  //   if (!ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.key.includes('Tab')) {
  //     this.input?.focus();
  //   }
  // }
}
