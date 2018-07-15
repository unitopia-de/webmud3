import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private windowsHeight : number;
  private windowsWidth : number;

  constructor() { }

  public setWindowsSize(height:number,width : number) {
    this.windowsHeight = height;
    this.windowsWidth = width;
  }
  public setMudOutputSize(height:number,width : number) {
  }
  
}
