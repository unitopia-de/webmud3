import { Component, OnInit } from '@angular/core';
import { LoggerService } from '../shared/logger.service';

@Component({
  selector: 'app-logdisplay',
  templateUrl: './logdisplay.component.html',
  styleUrls: ['./logdisplay.component.css']
})
export class LogdisplayComponent implements OnInit {

  constructor(public messageService: LoggerService) {}

  ngOnInit() {
  }

}
