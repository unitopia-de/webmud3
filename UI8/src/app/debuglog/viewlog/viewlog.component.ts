import { Component, OnInit } from '@angular/core';
import { LogapiService } from '../logapi.service';
import {PageEvent} from '@angular/material/paginator';
import { ViewLogData } from '../viewlog-data';

@Component({
  selector: 'app-viewlog',
  templateUrl: './viewlog.component.html',
  styleUrls: ['./viewlog.component.css']
})
export class ViewlogComponent implements OnInit {

  constructor(public logsrv:LogapiService) { }

  doPageEvent(event:PageEvent) {
    this.logsrv.doPageEvent(event);
  }

  onRefresh() {
    this.logsrv.doRefresh();
  }

  onOpen(vlogid:number) {
    this.logsrv.fetchLogEntry(vlogid);
  }

  ngOnInit() {
  }

}
