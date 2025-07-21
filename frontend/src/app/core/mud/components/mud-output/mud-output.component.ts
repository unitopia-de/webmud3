import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';

import { MudService } from 'src/app/core/mud/mud.service';

@Component({
  selector: 'app-mud-output',
  standalone: true,
  templateUrl: './mud-output.component.html',
  styleUrls: ['./mud-output.component.scss'],
})
export class MudOutputComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true })
  host!: ElementRef<HTMLDivElement>;

  constructor(private mud: MudService) {}

  ngAfterViewInit() {
    this.mud.initTerminal(this.host.nativeElement); // Terminal einbetten
  }

  ngOnDestroy() {
    this.mud.disposeTerminal(); // sauber aufräumen
  }
}
