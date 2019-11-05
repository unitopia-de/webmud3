import { Component, OnInit } from '@angular/core';
import { LogapiService } from '../logapi.service';

@Component({
  selector: 'app-searchlog',
  templateUrl: './searchlog.component.html',
  styleUrls: ['./searchlog.component.css']
})
export class SearchlogComponent implements OnInit {

  constructor(public logsrv:LogapiService) { }

  ngOnInit() {
  }

}
