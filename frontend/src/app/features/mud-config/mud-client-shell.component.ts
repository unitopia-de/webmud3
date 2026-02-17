import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { MudClientComponent } from '../../core/mud/components/mud-client/mud-client.component';
import { CharStatusBarComponent } from '../gmcp-char';
import { WindowContainerComponent } from '../windows';
import { MudConfigService } from './mud-config.service';

/**
 * Route shell that reads the `:mudId` parameter and passes it to the
 * MudClientComponent. Renders the full MUD UI (client + status bar + windows).
 */
@Component({
  selector: 'app-mud-client-shell',
  standalone: true,
  imports: [MudClientComponent, CharStatusBarComponent, WindowContainerComponent],
  template: `
    <app-mud-client [mudId]="resolvedMudId"></app-mud-client>
    <app-char-statusbar></app-char-statusbar>
    <app-window-container></app-window-container>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    app-mud-client {
      flex: 1 1 0;
      min-height: 0;
    }
  `],
})
export class MudClientShellComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly mudConfig = inject(MudConfigService);

  protected resolvedMudId?: string;

  ngOnInit(): void {
    const paramMudId = this.route.snapshot.paramMap.get('mudId');

    if (paramMudId) {
      // Resolve parameter: could be a direct mud ID or a route alias
      this.resolvedMudId = this.mudConfig.resolveMudId(paramMudId) ?? paramMudId;
    } else {
      // No param → use default MUD (root route in single-MUD mode)
      this.resolvedMudId = this.mudConfig.getDefaultMudId();
    }

    console.info('[MudClientShell] Resolved mudId:', this.resolvedMudId);
  }
}
