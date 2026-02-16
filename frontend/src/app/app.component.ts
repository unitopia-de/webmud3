import { Component } from '@angular/core';
import { MudClientComponent } from '@webmud3/frontend/core/mud/components/mud-client/mud-client.component';
import { CharStatusBarComponent } from '@webmud3/frontend/features/gmcp-char';
import { MenuBarComponent } from '@webmud3/frontend/features/menu';
import { WindowContainerComponent } from '@webmud3/frontend/features/windows';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [MenuBarComponent, MudClientComponent, CharStatusBarComponent, WindowContainerComponent],
  standalone: true,
})
export class AppComponent {}
