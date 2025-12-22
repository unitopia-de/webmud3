import { Component } from '@angular/core';
import { MudClientComponent } from '@webmud3/frontend/core/mud/components/mud-client/mud-client.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [MudClientComponent],
  standalone: true,
})
export class AppComponent {}
