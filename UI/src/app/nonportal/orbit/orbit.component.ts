import { Component, OnInit } from '@angular/core';
import { WebmudConfig } from '../../mud/webmud-config';

@Component({
  selector: 'app-orbit',
  templateUrl: './orbit.component.html',
  styleUrls: ['./orbit.component.css']
})
export class OrbitComponent implements OnInit {

  private mudcfg : WebmudConfig = {
    mudname : 'orbit',
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
