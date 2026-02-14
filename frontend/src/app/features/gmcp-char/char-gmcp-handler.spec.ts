import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';

import { GmcpService } from '../gmcp/gmcp.service';

import { CharGmcpHandler } from './char-gmcp-handler';

describe('CharGmcpHandler', () => {
  let handler: CharGmcpHandler;
  let gmcpService: GmcpService;
  let titleService: Title;
  let sendSpy: jest.SpyInstance;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CharGmcpHandler, GmcpService, Title],
    });

    handler = TestBed.inject(CharGmcpHandler);
    gmcpService = TestBed.inject(GmcpService);
    titleService = TestBed.inject(Title);

    sendSpy = jest.spyOn(gmcpService, 'sendOutgoing').mockImplementation();
  });

  describe('module identity', () => {
    it('should have moduleName "Char"', () => {
      expect(handler.moduleName).toBe('Char');
    });

    it('should have version "1"', () => {
      expect(handler.version).toBe('1');
    });
  });

  describe('characterData$', () => {
    it('should start as null', () => {
      expect(handler.characterData$.value).toBeNull();
    });
  });

  describe('Char.Name', () => {
    it('should initialize character data', () => {
      handler.handleMessage('Name', {
        name: 'Myonara',
        fullname: 'Myonara der Erzmagier',
        gender: 'male',
        wizard: 0,
      });

      const data = handler.characterData$.value;
      expect(data).not.toBeNull();
      expect(data!.name).toBe('Myonara');
      expect(data!.fullname).toBe('Myonara der Erzmagier');
      expect(data!.gender).toBe('male');
      expect(data!.wizard).toBe(0);
      expect(data!.isWizard).toBe(false);
    });

    it('should detect wizard status', () => {
      handler.handleMessage('Name', {
        name: 'Wizzy',
        wizard: 5,
      });

      const data = handler.characterData$.value;
      expect(data!.isWizard).toBe(true);
      expect(data!.wizard).toBe(5);
    });

    it('should enable Files/Input/Numpad for wizards', () => {
      handler.handleMessage('Name', {
        name: 'Wizzy',
        wizard: 1,
      });

      expect(sendSpy).toHaveBeenCalledWith('Core', 'Supports.Add', [
        'Files 1',
      ]);
      expect(sendSpy).toHaveBeenCalledWith('Core', 'Supports.Add', [
        'Input 1',
      ]);
      expect(sendSpy).toHaveBeenCalledWith('Core', 'Supports.Add', [
        'Numpad 1',
      ]);
    });

    it('should NOT enable wizard modules for players', () => {
      handler.handleMessage('Name', {
        name: 'Player',
        wizard: 0,
      });

      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('should update browser title with fullname', () => {
      const titleSpy = jest.spyOn(titleService, 'setTitle');

      handler.handleMessage('Name', {
        name: 'Myonara',
        fullname: 'Myonara der Erzmagier',
      });

      expect(titleSpy).toHaveBeenCalledWith('Myonara der Erzmagier');
    });

    it('should use name as title fallback when fullname is missing', () => {
      const titleSpy = jest.spyOn(titleService, 'setTitle');

      handler.handleMessage('Name', { name: 'Myonara' });

      expect(titleSpy).toHaveBeenCalledWith('Myonara');
    });

    it('should handle case-insensitive message name', () => {
      handler.handleMessage('name', { name: 'Test' });

      expect(handler.characterData$.value?.name).toBe('Test');
    });
  });

  describe('Char.StatusVars', () => {
    it('should store status variable definitions', () => {
      handler.handleMessage('StatusVars', {
        guild: 'Gilde',
        race: 'Rasse',
        rank: 'Rang',
      });

      const data = handler.characterData$.value;
      expect(data).not.toBeNull();
      expect(data!.statusVars).toEqual({
        guild: 'Gilde',
        race: 'Rasse',
        rank: 'Rang',
      });
    });
  });

  describe('Char.Status', () => {
    it('should update status values', () => {
      handler.handleMessage('Status', {
        guild: 'Zauberer',
        race: 'Mensch',
      });

      const data = handler.characterData$.value;
      expect(data!.status).toEqual({
        guild: 'Zauberer',
        race: 'Mensch',
      });
    });

    it('should merge with existing status', () => {
      handler.handleMessage('Status', { guild: 'Zauberer' });
      handler.handleMessage('Status', { race: 'Elf' });

      const data = handler.characterData$.value;
      expect(data!.status).toEqual({
        guild: 'Zauberer',
        race: 'Elf',
      });
    });
  });

  describe('Char.Vitals', () => {
    it('should parse string-format vitals', () => {
      handler.handleMessage('Vitals', 'hp=100|sp=80|maxhp=120|maxsp=100');

      const data = handler.characterData$.value;
      expect(data!.vitals.hp).toBe(100);
      expect(data!.vitals.sp).toBe(80);
      expect(data!.vitals.maxHp).toBe(120);
      expect(data!.vitals.maxSp).toBe(100);
    });

    it('should parse object-format vitals', () => {
      handler.handleMessage('Vitals', {
        hp: 90,
        sp: 75,
        maxhp: 120,
        maxsp: 100,
      });

      const data = handler.characterData$.value;
      expect(data!.vitals.hp).toBe(90);
      expect(data!.vitals.sp).toBe(75);
      expect(data!.vitals.maxHp).toBe(120);
      expect(data!.vitals.maxSp).toBe(100);
    });

    it('should merge vitals updates', () => {
      handler.handleMessage('Vitals', 'hp=100|maxhp=120');
      handler.handleMessage('Vitals', 'sp=80|maxsp=100');

      const data = handler.characterData$.value;
      expect(data!.vitals.hp).toBe(100);
      expect(data!.vitals.maxHp).toBe(120);
      expect(data!.vitals.sp).toBe(80);
      expect(data!.vitals.maxSp).toBe(100);
    });
  });

  describe('Char.Stats', () => {
    it('should parse string-format stats', () => {
      handler.handleMessage(
        'Stats',
        'con=34,2|dex=59,7|int=130|str=59,8',
      );

      const data = handler.characterData$.value;
      expect(data!.stats).toHaveLength(4);
      expect(data!.stats[0].key).toBe('str');
      expect(data!.stats[0].value).toBe('59,8');
    });

    it('should parse object-format stats', () => {
      handler.handleMessage('Stats', { str: 50, int: 100 });

      const data = handler.characterData$.value;
      expect(data!.stats.length).toBeGreaterThan(0);
    });
  });

  describe('Char.Items.List', () => {
    it('should initialize the inventory', () => {
      handler.handleMessage('Items.List', {
        items: [
          { name: 'Schwert', category: 'Waffen' },
          { name: 'Dolch', category: 'Waffen' },
          { name: 'Kettenhemd', category: 'Rüstung' },
        ],
      });

      const inv = handler.inventory$.value;
      expect(inv.totalItems).toBe(3);
      expect(inv.getCategories()).toEqual(['Waffen', 'Rüstung']);
      expect(inv.getItems('Waffen')).toEqual(['Schwert', 'Dolch']);
    });

    it('should replace previous inventory on new Items.List', () => {
      handler.handleMessage('Items.List', {
        items: [{ name: 'Alt', category: 'Test' }],
      });

      handler.handleMessage('Items.List', {
        items: [{ name: 'Neu', category: 'Andere' }],
      });

      const inv = handler.inventory$.value;
      expect(inv.totalItems).toBe(1);
      expect(inv.getCategories()).toEqual(['Andere']);
    });

    it('should handle empty items array', () => {
      handler.handleMessage('Items.List', { items: [] });

      expect(handler.inventory$.value.isEmpty).toBe(true);
    });
  });

  describe('Char.Items.Add', () => {
    it('should add a single item', () => {
      handler.handleMessage('Items.List', {
        items: [{ name: 'Schwert', category: 'Waffen' }],
      });

      handler.handleMessage('Items.Add', {
        item: { name: 'Dolch', category: 'Waffen' },
      });

      expect(handler.inventory$.value.getItems('Waffen')).toEqual([
        'Dolch',
        'Schwert',
      ]);
    });

    it('should ignore null item', () => {
      handler.handleMessage('Items.Add', { item: null });

      expect(handler.inventory$.value.isEmpty).toBe(true);
    });
  });

  describe('Char.Items.Remove', () => {
    it('should remove a single item', () => {
      handler.handleMessage('Items.List', {
        items: [
          { name: 'Schwert', category: 'Waffen' },
          { name: 'Dolch', category: 'Waffen' },
        ],
      });

      handler.handleMessage('Items.Remove', {
        item: { name: 'Schwert', category: 'Waffen' },
      });

      expect(handler.inventory$.value.getItems('Waffen')).toEqual(['Dolch']);
    });

    it('should remove category when last item is removed', () => {
      handler.handleMessage('Items.List', {
        items: [{ name: 'Schwert', category: 'Waffen' }],
      });

      handler.handleMessage('Items.Remove', {
        item: { name: 'Schwert', category: 'Waffen' },
      });

      expect(handler.inventory$.value.getCategories()).toEqual([]);
    });

    it('should ignore null item', () => {
      handler.handleMessage('Items.Remove', { item: null });

      expect(handler.inventory$.value.isEmpty).toBe(true);
    });
  });

  describe('dispose()', () => {
    it('should reset characterData$ to null', () => {
      handler.handleMessage('Name', { name: 'Test' });
      expect(handler.characterData$.value).not.toBeNull();

      handler.dispose();
      expect(handler.characterData$.value).toBeNull();
    });

    it('should reset inventory to empty', () => {
      handler.handleMessage('Items.List', {
        items: [{ name: 'Test', category: 'Cat' }],
      });

      handler.dispose();
      expect(handler.inventory$.value.isEmpty).toBe(true);
    });
  });
});
