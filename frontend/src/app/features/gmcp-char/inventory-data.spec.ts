import { InventoryList } from './inventory-data';

describe('InventoryList', () => {
  let inv: InventoryList;

  beforeEach(() => {
    inv = new InventoryList();
  });

  describe('initial state', () => {
    it('should be empty', () => {
      expect(inv.isEmpty).toBe(true);
      expect(inv.totalItems).toBe(0);
      expect(inv.getCategories()).toEqual([]);
    });
  });

  describe('addItem()', () => {
    it('should add an item to a new category', () => {
      inv.addItem({ name: 'Schwert', category: 'Waffen' });

      expect(inv.getCategories()).toEqual(['Waffen']);
      expect(inv.getItems('Waffen')).toEqual(['Schwert']);
      expect(inv.totalItems).toBe(1);
      expect(inv.isEmpty).toBe(false);
    });

    it('should prepend by default (addTop = true)', () => {
      inv.addItem({ name: 'Schwert', category: 'Waffen' });
      inv.addItem({ name: 'Dolch', category: 'Waffen' });

      expect(inv.getItems('Waffen')).toEqual(['Dolch', 'Schwert']);
    });

    it('should append when addTop = false', () => {
      inv.addItem({ name: 'Schwert', category: 'Waffen' }, false);
      inv.addItem({ name: 'Dolch', category: 'Waffen' }, false);

      expect(inv.getItems('Waffen')).toEqual(['Schwert', 'Dolch']);
    });

    it('should support multiple categories', () => {
      inv.addItem({ name: 'Schwert', category: 'Waffen' });
      inv.addItem({ name: 'Kettenhemd', category: 'Rüstung' });
      inv.addItem({ name: 'Fackel', category: 'Sonstiges' });

      expect(inv.getCategories()).toEqual(['Waffen', 'Rüstung', 'Sonstiges']);
      expect(inv.totalItems).toBe(3);
    });
  });

  describe('removeItem()', () => {
    it('should remove an existing item', () => {
      inv.addItem({ name: 'Schwert', category: 'Waffen' });
      inv.addItem({ name: 'Dolch', category: 'Waffen' });

      const removed = inv.removeItem({ name: 'Schwert', category: 'Waffen' });

      expect(removed).toBe(true);
      expect(inv.getItems('Waffen')).toEqual(['Dolch']);
    });

    it('should remove the category when last item is removed', () => {
      inv.addItem({ name: 'Schwert', category: 'Waffen' });

      inv.removeItem({ name: 'Schwert', category: 'Waffen' });

      expect(inv.getCategories()).toEqual([]);
      expect(inv.isEmpty).toBe(true);
    });

    it('should return false for non-existent item', () => {
      inv.addItem({ name: 'Schwert', category: 'Waffen' });

      const removed = inv.removeItem({ name: 'Dolch', category: 'Waffen' });

      expect(removed).toBe(false);
      expect(inv.getItems('Waffen')).toEqual(['Schwert']);
    });

    it('should return false for non-existent category', () => {
      const removed = inv.removeItem({ name: 'Schwert', category: 'Waffen' });

      expect(removed).toBe(false);
    });
  });

  describe('initList()', () => {
    it('should replace entire inventory', () => {
      inv.addItem({ name: 'Alt', category: 'Test' });

      inv.initList([
        { name: 'Schwert', category: 'Waffen' },
        { name: 'Dolch', category: 'Waffen' },
        { name: 'Kettenhemd', category: 'Rüstung' },
      ]);

      expect(inv.getCategories()).toEqual(['Waffen', 'Rüstung']);
      expect(inv.getItems('Waffen')).toEqual(['Schwert', 'Dolch']);
      expect(inv.getItems('Rüstung')).toEqual(['Kettenhemd']);
      expect(inv.totalItems).toBe(3);
    });

    it('should handle empty list', () => {
      inv.addItem({ name: 'Alt', category: 'Test' });

      inv.initList([]);

      expect(inv.isEmpty).toBe(true);
    });
  });

  describe('clear()', () => {
    it('should empty the inventory', () => {
      inv.addItem({ name: 'Schwert', category: 'Waffen' });
      inv.addItem({ name: 'Kettenhemd', category: 'Rüstung' });

      inv.clear();

      expect(inv.isEmpty).toBe(true);
      expect(inv.totalItems).toBe(0);
      expect(inv.getCategories()).toEqual([]);
    });
  });

  describe('getItems()', () => {
    it('should return empty array for unknown category', () => {
      expect(inv.getItems('NonExistent')).toEqual([]);
    });
  });
});
