import { Injectable } from '@angular/core';
// import { I18n } from '@aws-amplify/core';
import { i18nStrings } from '../locale/i18nStrings';

@Injectable({
  providedIn: 'root',
})
export class ReadLanguageService {
  public voc: any = {};
  public current: string;

  public get(key: string): string {
    if (typeof this.voc[this.current] === 'undefined') {
      this.current = 'en';
    }
    if (typeof this.voc[this.current][key] === 'undefined') {
      return key;
    }
    return this.voc[this.current][key];
    // return I18n.get(key);
  }

  public setLanguage(shortcut: string): boolean {
    this.current = shortcut;
    // I18n.setLanguage(shortcut);
    return true;
  }

  constructor() {
    var other = this;
    other.voc = i18nStrings;
    // I18n.putVocabularies(i18nStrings);
  }
}
