import { Component, inject } from '@angular/core';

import { MudClientComponent } from '@webmud3/frontend/core/mud/components/mud-client/mud-client.component';
import { CharFooterComponent } from '@webmud3/frontend/features/footer/char-footer.component';
import { WindowContainerComponent } from '@webmud3/frontend/features/windows/window-container.component';
import { WindowService } from '@webmud3/frontend/features/windows/window.service';

/**
 * Classic WebMUD3 shell — xterm-driven input and output, the layout the
 * project shipped before the splitscreen / `/ez` variant existed.
 *
 * Lives under the `/` route. Functionally identical to the original
 * `AppComponent`: same imports, same template, same `__windowService`
 * debug hook on `window`. The only change is that this shell is now
 * a routed child of a (minimal) `AppComponent` rather than the root
 * component itself.
 *
 * NOT to be touched in cosmetic ways — anything that changes behaviour
 * here changes behaviour for every existing user on `/`.
 */
@Component({
  selector: 'app-classic-shell',
  templateUrl: './classic-shell.component.html',
  styleUrls: ['./classic-shell.component.scss'],
  imports: [MudClientComponent, WindowContainerComponent, CharFooterComponent],
  standalone: true,
})
export class ClassicShellComponent {
  private readonly windowService = inject(WindowService);

  constructor() {
    // Expose WindowService on window for debugging / manual testing in the
    // browser console. Example:
    //   __windowService.newWindow({ title: 'Test', component: 'demo', data: { hello: 'world' } })
    (window as unknown as Record<string, unknown>)['__windowService'] =
      this.windowService;
    console.log(
      '[ClassicShell] __windowService exposed on window',
      this.windowService,
    );
  }
}
