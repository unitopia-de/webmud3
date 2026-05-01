import { Component, inject } from '@angular/core';
import { MudClientComponent } from '@webmud3/frontend/core/mud/components/mud-client/mud-client.component';
import { CharFooterComponent } from '@webmud3/frontend/features/footer/char-footer.component';
import { WindowContainerComponent } from '@webmud3/frontend/features/windows/window-container.component';
import { WindowService } from '@webmud3/frontend/features/windows/window.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [MudClientComponent, WindowContainerComponent, CharFooterComponent],
  standalone: true,
})
export class AppComponent {
  private readonly windowService = inject(WindowService);

  constructor() {
    // Expose WindowService on window for debugging / manual testing in the
    // browser console. Example:
    //   __windowService.newWindow({ title: 'Test', component: 'demo', data: { hello: 'world' } })
    (window as unknown as Record<string, unknown>)['__windowService'] =
      this.windowService;
    console.log('[AppComponent] __windowService exposed on window', this.windowService);
  }
}
