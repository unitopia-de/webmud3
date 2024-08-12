import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  ViewChild,
} from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { IMudMessage } from '../../types/mud-message';

@Component({
  selector: 'app-mud-output',
  templateUrl: './mud-output.component.html',
  styleUrls: ['./mud-output.component.scss'],
})
export class MudOutputComponent implements AfterViewChecked, AfterViewInit {
  private readonly linesSubject = new BehaviorSubject<IMudMessage[]>([]);

  private canScrollToBottom = true;

  @ViewChild('container', { static: true })
  private readonly outputContainer!: ElementRef<HTMLDivElement>;

  protected readonly lines$: Observable<IMudMessage[]> =
    this.linesSubject.asObservable();

  public get lines(): IMudMessage[] {
    return this.linesSubject.value;
  }

  @Input({ required: true })
  public set lines(value: IMudMessage[]) {
    this.linesSubject.next(value);
  }

  @Input({ required: true })
  public foregroundColor!: string;

  @Input({ required: true })
  public backgroundColor!: string;

  @Input({ required: false })
  public shallScroll: boolean = false;

  @Input({ required: false })
  public autoScroll: boolean = false;

  public ngAfterViewChecked() {
    if (this.canScrollToBottom && this.autoScroll) {
      this.scrollToBottom();
    }
  }

  public ngAfterViewInit(): void {
    this.outputContainer.nativeElement.onscroll = (event: Event) => {
      this.onScroll(event);
    };
  }

  private onScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const tolerance = 5;
    const atBottom =
      Math.abs(
        element.scrollHeight - element.scrollTop - element.clientHeight,
      ) <= tolerance;

    this.canScrollToBottom = atBottom;
  }

  private scrollToBottom(): void {
    this.outputContainer.nativeElement.scrollTop =
      this.outputContainer.nativeElement.scrollHeight;
  }
}
