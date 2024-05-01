import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  ViewChild,
} from '@angular/core';

const enum Status {
  OFF = 0,
  RESIZE = 1,
  MOVE = 2,
}

@Component({
  selector: 'app-resizable-draggable',
  templateUrl: './resizable-draggable.component.html',
  styleUrls: ['./resizable-draggable.component.scss'],
})
export class ResizableDraggableComponent implements AfterViewInit {
  private boxPosition: { left: number; top: number } = { left: 0, top: 0 };

  private containerPos: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } = { bottom: 0, left: 0, right: 0, top: 0 };

  private mouseClick: { x: number; y: number; left: number; top: number } = {
    left: 0,
    top: 0,
    x: 0,
    y: 0,
  };

  @Input({ required: true })
  public width!: number;

  @Input({ required: true })
  public height!: number;

  @Input({ required: true })
  public left!: number;

  @Input({ required: true })
  public top!: number;

  // Todo[myst]: Typings: Not sure of that one
  @ViewChild('box', { static: true })
  public box!: ElementRef;

  public mouse: { x: number; y: number } = { x: 0, y: 0 };

  public status: Status = Status.OFF;

  ngAfterViewInit() {
    this.loadBox();
    this.loadContainer();
  }

  private loadBox() {
    const { left, top } = this.box.nativeElement.getBoundingClientRect();
    this.boxPosition = { left, top };
  }

  private loadContainer() {
    const left = this.boxPosition.left - this.left;
    const top = this.boxPosition.top - this.top;
    const right = left + 600;
    const bottom = top + 450;
    this.containerPos = { left, top, right, bottom };
  }

  setStatus(event: MouseEvent, status: number) {
    if (status === 1) event.stopPropagation();
    else if (status === 2)
      this.mouseClick = {
        x: event.clientX,
        y: event.clientY,
        left: this.left,
        top: this.top,
      };
    else this.loadBox();
    this.status = status;
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.mouse = { x: event.clientX, y: event.clientY };

    if (this.status === Status.RESIZE) this.resize();
    else if (this.status === Status.MOVE) this.move();
  }

  private resize() {
    if (this.resizeCondMeet()) {
      this.width = Number(this.mouse.x > this.boxPosition.left)
        ? this.mouse.x - this.boxPosition.left
        : 0;
      this.height = Number(this.mouse.y > this.boxPosition.top)
        ? this.mouse.y - this.boxPosition.top
        : 0;
    }
  }

  private resizeCondMeet() {
    return (
      this.mouse.x < this.containerPos.right &&
      this.mouse.y < this.containerPos.bottom
    );
  }

  private move() {
    if (this.moveCondMeet()) {
      this.left = this.mouseClick.left + (this.mouse.x - this.mouseClick.x);
      this.top = this.mouseClick.top + (this.mouse.y - this.mouseClick.y);
    }
  }

  private moveCondMeet() {
    const offsetLeft = this.mouseClick.x - this.boxPosition.left;
    const offsetRight = this.width - offsetLeft;
    const offsetTop = this.mouseClick.y - this.boxPosition.top;
    const offsetBottom = this.height - offsetTop;
    return (
      this.mouse.x > this.containerPos.left + offsetLeft &&
      this.mouse.x < this.containerPos.right - offsetRight &&
      this.mouse.y > this.containerPos.top + offsetTop &&
      this.mouse.y < this.containerPos.bottom - offsetBottom
    );
  }
}
