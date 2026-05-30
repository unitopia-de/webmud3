import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Top-level application shell — now just a router outlet.
 *
 * Both the classic and the EZ variant live as sibling routes
 * (see app.routes.ts). The previous direct rendering of
 * `<app-mud-client> + <app-char-footer> + <app-window-container>` and
 * the `__windowService` debug hook have moved into
 * `ClassicShellComponent` so the `/` route stays visually and
 * behaviourally identical to the pre-routing version of the app.
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [RouterOutlet],
  standalone: true,
})
export class AppComponent {}
