import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { WindowConfig } from 'src/app/shared/window-config';

@Component({
  selector: 'app-window',
  templateUrl: './window.component.html',
  styleUrls: ['./window.component.scss'],
})
export class WindowComponent {
  @Input() config: WindowConfig;
  @Output() menuAction = new EventEmitter<string>();
  @ViewChild('dialog') dialog;

  doWindowAction(event: any, actionType: string) {
    //console.log(actionType,event);
    switch (actionType) {
      case 'resize_end':
        this.config.inComingEvents.next(
          'resize:' + event.pageX + ':' + event.pageY,
        );
        return;
      case 'drag_end':
        this.config.outGoingEvents.next('do_focus:' + this.config.windowid);
        return;
      case 'hide':
        this.config.outGoingEvents.next('do_hide:' + this.config.windowid);
        return;
      case 'show':
      case 'resize_init':
      case 'maximize':
        break;
      default:
        return;
    }
  }
}
