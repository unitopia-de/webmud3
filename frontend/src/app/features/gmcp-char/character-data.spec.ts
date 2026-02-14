import {
  createCharacterData,
  formatStatusSummary,
  parseStats,
  parseVitals,
} from './character-data';

describe('character-data', () => {
  describe('createCharacterData()', () => {
    it('should create default character data with given name', () => {
      const data = createCharacterData('Myonara');

      expect(data.name).toBe('Myonara');
      expect(data.wizard).toBe(0);
      expect(data.isWizard).toBe(false);
      expect(data.statusVars).toEqual({});
      expect(data.status).toEqual({});
      expect(data.vitals).toEqual({});
      expect(data.stats).toEqual([]);
    });
  });

  describe('parseVitals()', () => {
    it('should parse a full vitals string', () => {
      const vitals = parseVitals('hp=100|sp=80|maxhp=120|maxsp=100');

      expect(vitals.hp).toBe(100);
      expect(vitals.sp).toBe(80);
      expect(vitals.maxHp).toBe(120);
      expect(vitals.maxSp).toBe(100);
    });

    it('should parse partial vitals (hp/sp only)', () => {
      const vitals = parseVitals('hp=50|sp=30');

      expect(vitals.hp).toBe(50);
      expect(vitals.sp).toBe(30);
      expect(vitals.maxHp).toBeUndefined();
      expect(vitals.maxSp).toBeUndefined();
    });

    it('should handle comma as decimal separator', () => {
      const vitals = parseVitals('hp=99,5|sp=45,2');

      expect(vitals.hp).toBe(99.5);
      expect(vitals.sp).toBe(45.2);
    });

    it('should be case-insensitive', () => {
      const vitals = parseVitals('HP=100|SP=80|MAXHP=120|MAXSP=100');

      expect(vitals.hp).toBe(100);
      expect(vitals.sp).toBe(80);
      expect(vitals.maxHp).toBe(120);
      expect(vitals.maxSp).toBe(100);
    });

    it('should return empty object for empty string', () => {
      expect(parseVitals('')).toEqual({});
    });

    it('should skip invalid entries', () => {
      const vitals = parseVitals('hp=100|invalid|sp=abc|maxhp=50');

      expect(vitals.hp).toBe(100);
      expect(vitals.sp).toBeUndefined();
      expect(vitals.maxHp).toBe(50);
    });
  });

  describe('parseStats()', () => {
    it('should parse stats in canonical order', () => {
      const stats = parseStats('con=34,2|dex=59,7|int=130|str=59,8');

      expect(stats).toHaveLength(4);
      expect(stats[0].key).toBe('str');
      expect(stats[0].value).toBe('59,8');
      expect(stats[0].label).toBe('Stärke');
      expect(stats[1].key).toBe('int');
      expect(stats[1].value).toBe('130');
      expect(stats[2].key).toBe('con');
      expect(stats[2].value).toBe('34,2');
      expect(stats[3].key).toBe('dex');
      expect(stats[3].value).toBe('59,7');
    });

    it('should handle subset of stats', () => {
      const stats = parseStats('str=50|dex=60');

      expect(stats).toHaveLength(2);
      expect(stats[0].key).toBe('str');
      expect(stats[1].key).toBe('dex');
    });

    it('should use uppercase key as label for unknown stats', () => {
      const stats = parseStats('wis=42');

      expect(stats).toHaveLength(1);
      expect(stats[0].key).toBe('wis');
      expect(stats[0].label).toBe('WIS');
      expect(stats[0].value).toBe('42');
    });

    it('should return empty array for empty string', () => {
      expect(parseStats('')).toEqual([]);
    });

    it('should assign German labels', () => {
      const stats = parseStats('str=1|int=2|con=3|dex=4');

      expect(stats[0].label).toBe('Stärke');
      expect(stats[1].label).toBe('Intelligenz');
      expect(stats[2].label).toBe('Ausdauer');
      expect(stats[3].label).toBe('Geschicklichkeit');
    });
  });

  describe('formatStatusSummary()', () => {
    it('should join non-empty status values with commas', () => {
      const result = formatStatusSummary(
        { guild: 'Zauberer', race: 'Mensch', rank: 'Erzmagier' },
        {},
      );

      expect(result).toBe('Zauberer, Mensch, Erzmagier');
    });

    it('should skip empty values', () => {
      const result = formatStatusSummary(
        { guild: 'Krieger', race: '', rank: 'Novize' },
        {},
      );

      expect(result).toBe('Krieger, Novize');
    });

    it('should skip zero values', () => {
      const result = formatStatusSummary(
        { guild: 'Heiler', level: 0, rank: 'Anfänger' },
        {},
      );

      expect(result).toBe('Heiler, Anfänger');
    });

    it('should return empty string for empty status', () => {
      expect(formatStatusSummary({}, {})).toBe('');
    });
  });
});
