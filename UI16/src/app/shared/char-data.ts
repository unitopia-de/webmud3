export class CharacterData {
  public nameAtMud = '';
  public cStatus = '';
  public cVitals = '';
  public cStats: CharacterStat[] = [];

  constructor(name: string) {
    this.nameAtMud = name;
  }

  public setStatus(inp: string) {
    this.cStatus = inp;
  }
  public setVitals(inp: string) {
    const csplit = inp.split('|');
    this.cVitals = csplit[0];
  }
  public setStats(inp: string) {
    const csplit = inp.split('|');
    const csArr: string[] = ['str', 'int', 'con', 'dex'];
    let i = 0;
    const tmpOb: any = {};
    for (i = 0; i < csplit.length; i++) {
      const params = csplit[i].split('=');
      const statOb = new CharacterStat();
      switch (params[0]) {
        case 'str':
          statOb.name = 'Stärke';
          break;
        case 'int':
          statOb.name = 'Intelligenz';
          break;
        case 'con':
          statOb.name = 'Ausdauer';
          break;
        case 'dex':
          statOb.name = 'Geschicklichkeit';
          break;
        default:
          console.error('Unknown Stat', params);
          continue;
      }
      statOb.key = params[0];
      statOb.value = params[1];
      tmpOb[params[0]] = statOb;
    }
    this.cStats = [];
    for (i = 0; i < csArr.length; i++) {
      this.cStats.push(tmpOb[csArr[i]]);
    }
    console.log('setStats', this.cStats, csArr, tmpOb);
  }

  // con=34,2|dex=59,7|int=130|str=59,8
  // Stärke: 59,8   Intelligenz: 130   Ausdauer: 34,2   Geschicklichkeit: 59,7
}

export class CharacterStat {
  public key = '';
  public name = '';
  public value = '';
}
