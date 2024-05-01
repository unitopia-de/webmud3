import { EventEmitter } from '@angular/core';

export class Box {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
  outerBox?: Box | null = null;
  minBox?: Box | null = null;
  outEvent: EventEmitter<Box> = null;
  init_absolute(left: number, top: number, right: number, bottom: number) {
    this.left = left;
    this.top = top;
    this.right = right;
    this.bottom = bottom;
    this.width = this.right - this.left;
    this.height = this.bottom - this.top;
  }

  init_relative(left: number, top: number, width: number, height: number) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
    this.right = this.left + width;
    this.bottom = this.top + height;
  }
  resize_to_mouse(mouse_x: number, mouse_y: number) {
    // (this.mouse.x < this.containerPos.right && this.mouse.y < this.containerPos.bottom
    let width = this.width;
    let height = this.height;
    let count_width_changes = 0;
    let count_height_changes = 0;
    if (this.outerBox != null) {
      if (mouse_x >= this.outerBox.right || mouse_y >= this.outerBox.bottom) {
        return;
      }
      width = Number(mouse_x > this.outerBox.left)
        ? mouse_x - this.outerBox.left
        : 0;
      height = Number(mouse_y > this.outerBox.top)
        ? mouse_y - this.outerBox.top
        : 0;
      if (this.left + width > this.outerBox.right) {
        width = this.outerBox.right - this.left;
        count_width_changes++;
      }
      if (this.top + height > this.outerBox.bottom) {
        height = this.outerBox.bottom - this.top;
        count_height_changes++;
      }
    } else {
      return;
    }
    if (this.minBox != null) {
      if (width < this.minBox.width) {
        width = this.minBox.width;
        count_width_changes++;
      }
      if (height < this.minBox.height) {
        height = this.minBox.height;
        count_height_changes++;
      }
    }
    let changeflag = 0;
    if (count_width_changes < 2 && width != this.width) {
      this.width = width;
      this.right = this.left + this.width;
      changeflag++;
    }
    if (count_height_changes < 2 && height != this.height) {
      this.height = height;
      this.bottom = this.top + this.height;
      changeflag++;
    }
    if (changeflag > 0 && this.outEvent != null) {
      this.outEvent.next(this);
    }
  }
}
