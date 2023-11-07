import { Component, OnInit, Input } from '@angular/core';
import { InventoryList } from 'src/app/mud/mud-signals';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
})
export class InventoryComponent implements OnInit {
  @Input() inv: InventoryList;
  @Input() vheight: number;

  public mystyle(): string {
    if (this.vheight == 0) {
      this.vheight = 300;
    }
    return "{width: '100%', height: '" + this.vheight + "px'}";
  }

  constructor() {}

  ngOnInit(): void {}
}
