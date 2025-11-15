import { Component } from '@angular/core';
import { MudScreenreaderClientComponent } from './core/mud';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [MudScreenreaderClientComponent],
  standalone: true,
})
export class AppComponent {}
