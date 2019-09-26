import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { SocketService } from '../../shared/socket.service';

@Component({
  selector: 'app-mudlist',
  templateUrl: './mudlist.component.html',
  styleUrls: ['./mudlist.component.css']
})
export class MudlistComponent implements OnInit {

  private obs_list;
  @Output() mudselection = new EventEmitter<string>();

  constructor(public socketService: SocketService) { }

  ngOnInit() {
    const other = this;
    const len = this.socketService.mudnames.length;
    if (len < 1) {
      this.mudselection.emit('Disconnect');
      this.obs_list = this.socketService.mudList().subscribe(data => {
        other.obs_list.unsubscribe();
      });
    }
  }
  onChange(value) {
    this.mudselection.emit(value);
  }

}
