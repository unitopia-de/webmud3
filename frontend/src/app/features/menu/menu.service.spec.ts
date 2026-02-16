import { TestBed } from '@angular/core/testing';

import { MenuService } from './menu.service';
import { GmcpService } from '../gmcp/gmcp.service';
import type { MenuItem } from './menu-item';

describe('MenuService', () => {
  let service: MenuService;
  let gmcpService: GmcpService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MenuService, GmcpService],
    });

    service = TestBed.inject(MenuService);
    gmcpService = TestBed.inject(GmcpService);
  });

  it('should start with empty items', () => {
    expect(service.getItems()).toEqual([]);
  });

  describe('setItems', () => {
    it('should replace all items', () => {
      const items: MenuItem[] = [
        { id: 'file', label: 'Datei' },
        { id: 'edit', label: 'Bearbeiten' },
      ];

      service.setItems(items);

      expect(service.getItems()).toEqual(items);
    });
  });

  describe('registerItem', () => {
    it('should add a top-level item when parentId is null', () => {
      service.registerItem(null, { id: 'file', label: 'Datei' });

      expect(service.getItems()).toHaveLength(1);
      expect(service.getItems()[0].label).toBe('Datei');
    });

    it('should replace an existing item with the same id', () => {
      service.registerItem(null, { id: 'file', label: 'Datei' });
      service.registerItem(null, { id: 'file', label: 'Datei v2' });

      expect(service.getItems()).toHaveLength(1);
      expect(service.getItems()[0].label).toBe('Datei v2');
    });

    it('should add a child item to a parent', () => {
      service.registerItem(null, { id: 'file', label: 'Datei', children: [] });
      service.registerItem('file', { id: 'new', label: 'Neu' });

      const fileMenu = service.getItems()[0];

      expect(fileMenu.children).toHaveLength(1);
      expect(fileMenu.children![0].label).toBe('Neu');
    });
  });

  describe('removeItem', () => {
    it('should remove a top-level item', () => {
      service.setItems([
        { id: 'file', label: 'Datei' },
        { id: 'edit', label: 'Bearbeiten' },
      ]);

      service.removeItem('file');

      expect(service.getItems()).toHaveLength(1);
      expect(service.getItems()[0].id).toBe('edit');
    });

    it('should remove a nested item', () => {
      service.setItems([
        {
          id: 'file', label: 'Datei', children: [
            { id: 'new', label: 'Neu' },
            { id: 'open', label: 'Öffnen' },
          ],
        },
      ]);

      service.removeItem('new');

      expect(service.getItems()[0].children).toHaveLength(1);
      expect(service.getItems()[0].children![0].id).toBe('open');
    });
  });

  describe('items$ observable', () => {
    it('should emit when items change', () => {
      const emissions: MenuItem[][] = [];
      const sub = service.items$.subscribe(items => emissions.push(items));

      service.registerItem(null, { id: 'test', label: 'Test' });

      expect(emissions.length).toBe(2); // Initial [] + after registerItem
      expect(emissions[1]).toHaveLength(1);

      sub.unsubscribe();
    });
  });

  describe('refreshGmcpMenuItems', () => {
    it('should collect items from GMCP handlers', () => {
      const mockHandler = {
        moduleName: 'Sound',
        version: '1',
        handleMessage: jest.fn(),
        getMenuItems: () => [{
          label: 'Vertonung',
          checked: true,
          action: jest.fn(),
        }],
      };

      gmcpService.registerModule(mockHandler);
      service.refreshGmcpMenuItems();

      const gmcpMenu = service.getItems().find(i => i.id === 'gmcp');

      expect(gmcpMenu).toBeDefined();
      expect(gmcpMenu!.children).toHaveLength(1);
      expect(gmcpMenu!.children![0].label).toBe('Vertonung');
    });
  });
});
