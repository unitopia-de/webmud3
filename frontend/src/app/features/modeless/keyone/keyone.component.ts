import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';

@Component({
  selector: 'app-keyone',
  templateUrl: './keyone.component.html',
  styleUrls: ['./keyone.component.scss'],
})
export class KeyoneComponent {
  @Input({ required: true })
  public prefix!: string;

  @Input({ required: true })
  public key!: string;

  @Input()
  set value(val: string) {
    this.keyinp = val;
  }
  get value(): string {
    return this.keyinp;
  }

  @Output()
  public keyAction = new EventEmitter<string>();

  @ViewChild('keyoneInput', { static: false })
  public keyoneInput?: ElementRef;

  public keyinp = '';

  submit() {
    this.keyAction.emit(this.prefix + ':' + this.key + ':' + this.keyinp);
  }
}
