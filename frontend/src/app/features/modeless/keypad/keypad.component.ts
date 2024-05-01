import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OneKeypadData } from '@mudlet3/frontend/shared';

@Component({
  selector: 'app-keypad',
  templateUrl: './keypad.component.html',
  styleUrls: ['./keypad.component.scss'],
})
export class KeypadComponent {
  @Input() set keypad(one: OneKeypadData) {
    if (typeof one !== 'undefined') this._keypad = one;
  }
  get config(): OneKeypadData {
    return this._keypad;
  }
  _keypad: OneKeypadData = new OneKeypadData('');

  @Output() keyAction = new EventEmitter<string>();

  valAction(event: string) {
    const evs = event.split(':');
    switch (evs[1]) {
      case '/':
        evs[1] = 'NumpadDivide';
        break;
      case '*':
        evs[1] = 'NumpadMultiply';
        break;
      case '-':
        evs[1] = 'NumpadSubtract';
        break;
      case '+':
        evs[1] = 'NumpadAdd';
        break;
      case ',':
        evs[1] = 'NumpadDecimal';
        break;
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        evs[1] = 'Numpad' + evs[1];
        break;
      default:
        console.log('keypad-unknown event:', event);
        return;
    }
    this.keyAction.emit(evs.join(':'));
  }
}
