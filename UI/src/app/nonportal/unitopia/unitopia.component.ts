import { Component, OnInit } from '@angular/core';
import { WebmudConfig } from '../../mud/webmud-config';

@Component({
  selector: 'app-unitopia',
  templateUrl: './unitopia.component.html',
  styleUrls: ['./unitopia.component.css']
})
export class UnitopiaComponent implements OnInit {

  private mudcfg : WebmudConfig = {
    mudname : 'unitopia',
    autoConnect : true,
    autoLogin : false,
    autoUser : '',
    autoToken:'',
    localEcho : true
  }

  constructor() { }

  ngOnInit() {
  }

}
