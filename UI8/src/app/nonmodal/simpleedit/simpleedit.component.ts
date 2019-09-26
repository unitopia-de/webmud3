import { Component, OnInit } from '@angular/core';
import { MyDynamicComponent } from '../window/my-dynamic.component';

@Component({
  selector: 'app-simple-edit',
  templateUrl: './simpleedit.component.html',
  styleUrls: ['./simpleedit.component.css']
})
export class SimpleEditComponent extends MyDynamicComponent implements OnInit {

  constructor() {
    super();
  }

  ngOnInit() {
  }

}
