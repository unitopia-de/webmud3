import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { WindowConfig } from '@mudlet3/frontend/shared';

@Component({
  selector: 'app-window',
  templateUrl: './window.component.html',
  styleUrls: ['./window.component.scss'],
})
export class WindowComponent {
  @Input({ required: true })
  public config!: WindowConfig;

  @Output()
  public menuAction = new EventEmitter<string>();

  @ViewChild('dialog', { static: false })
  public dialog?: any;

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
