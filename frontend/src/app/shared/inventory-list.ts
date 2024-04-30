export class InventoryEntry {
  name = '';
  category = '';
}

export class InventoryList {
  private namedList: object = {};

  public getItems(cat: string): string[] {
    return this.namedList[cat];
  }
  public getCategories(): string[] {
    return Object.keys(this.namedList);
  }

  public addItem(ientry: InventoryEntry, addTop = true) {
    if (Object.prototype.hasOwnProperty.call(this.namedList, ientry.category)) {
      if (addTop) {
        this.namedList[ientry.category].unshift(ientry.name);
      } else {
        this.namedList[ientry.category].push(ientry.name);
      }
    } else {
      this.namedList[ientry.category] = [ientry.name];
    }
  }
  public removeItem(ientry: InventoryEntry) {
    if (Object.prototype.hasOwnProperty.call(this.namedList, ientry.category)) {
      const ix = this.namedList[ientry.category].indexOf(ientry.name);
      if (ix >= 0) {
        this.namedList[ientry.category].splice(ix, 1);
        if (this.namedList[ientry.category].length == 0) {
          delete this.namedList[ientry.category];
        }
      }
    }
  }
  public initList(ilist: InventoryEntry[]) {
    this.namedList = {};
    ilist.forEach(function (currentValue, index, arr) {
      this.addItem(currentValue, false);
    }, this);
  }
}
