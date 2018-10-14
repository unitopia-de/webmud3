import { Component, OnInit } from '@angular/core';
import { TabData } from '../shared/tabdata';

@Component({
  selector: 'app-tabview',
  templateUrl: './tabview.component.html',
  styleUrls: ['./tabview.component.css']
})
export class TabviewComponent implements OnInit {

  public alltabs : TabData[] = [];

  constructor() { }

  ngOnInit() {
  }

}
