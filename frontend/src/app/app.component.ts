import { Component } from '@angular/core';
import { MudClientComponent } from './core/mud';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [MudClientComponent],
  standalone: true,
})
export class AppComponent {}
