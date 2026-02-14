import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { FilesService } from './files.service';
import { FilesUrlPayload } from './file-types';

/**
 * Tests FilesService pure logic:
 * processFileUrl, getFileInfo, removeFile, isDirty, reset.
 * HttpClient is provided but not exercised (HTTP tests would need HttpTestingController).
 */
describe('FilesService', () => {
  let service: FilesService;

  const mockPayload: FilesUrlPayload = {
    url: 'http://mud.example.com/files/test.c',
    file: '/w/myonara/test.c',
    path: '/w/myonara/',
    filename: 'test.c',
    filetype: '.c',
    title: 'test.c',
    newfile: false,
    writeacl: true,
    temporary: false,
    saveactive: false,
    filesize: 1234,
    closable: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), FilesService],
    });
    service = TestBed.inject(FilesService);
  });

  describe('processFileUrl()', () => {
    it('should create a new FileInfo from payload', () => {
      const fileInfo = service.processFileUrl(mockPayload);

      expect(fileInfo.file).toBe('/w/myonara/test.c');
      expect(fileInfo.filename).toBe('test.c');
      expect(fileInfo.editorMode).toBe('c_cpp');
      expect(fileInfo.writeacl).toBe(true);
      expect(fileInfo.alreadyLoaded).toBe(false);
      expect(fileInfo.content).toBe('');
      expect(fileInfo.oldContent).toBe('');
    });

    it('should return existing FileInfo if save is active', () => {
      const first = service.processFileUrl(mockPayload);
      first.saveActive = true;

      const second = service.processFileUrl({
        ...mockPayload,
        url: 'http://mud.example.com/files/test.c?v2',
      });

      expect(second).toBe(first); // Same reference
      expect(second.alreadyLoaded).toBe(true);
      expect(second.lasturl).toBe('http://mud.example.com/files/test.c?v2');
    });

    it('should create a new FileInfo if file not previously tracked', () => {
      const first = service.processFileUrl(mockPayload);
      first.saveActive = false; // Not saving

      const second = service.processFileUrl({
        ...mockPayload,
        url: 'http://mud.example.com/files/test.c?v3',
      });

      // Should create new (replaces old since saveActive was false)
      expect(second.lasturl).toBe('http://mud.example.com/files/test.c?v3');
      expect(second.alreadyLoaded).toBe(false);
    });

    it('should determine text mode for .txt files', () => {
      const fileInfo = service.processFileUrl({
        ...mockPayload,
        filetype: '.txt',
      });

      expect(fileInfo.editorMode).toBe('text');
    });
  });

  describe('getFileInfo()', () => {
    it('should return the FileInfo for a tracked file', () => {
      service.processFileUrl(mockPayload);

      const fileInfo = service.getFileInfo('/w/myonara/test.c');
      expect(fileInfo).toBeDefined();
      expect(fileInfo?.filename).toBe('test.c');
    });

    it('should return undefined for untracked files', () => {
      expect(service.getFileInfo('/nonexistent')).toBeUndefined();
    });
  });

  describe('setWindowId()', () => {
    it('should associate a window ID with a file', () => {
      service.processFileUrl(mockPayload);
      service.setWindowId('/w/myonara/test.c', 'win-123');

      const fileInfo = service.getFileInfo('/w/myonara/test.c');
      expect(fileInfo?.windowId).toBe('win-123');
    });

    it('should do nothing for untracked files', () => {
      // Should not throw
      service.setWindowId('/nonexistent', 'win-456');
    });
  });

  describe('removeFile()', () => {
    it('should remove the file from the registry', () => {
      service.processFileUrl(mockPayload);
      service.removeFile('/w/myonara/test.c');

      expect(service.getFileInfo('/w/myonara/test.c')).toBeUndefined();
    });
  });

  describe('isDirty()', () => {
    it('should return false when content matches oldContent', () => {
      const fileInfo = service.processFileUrl(mockPayload);
      fileInfo.content = 'hello';
      fileInfo.oldContent = 'hello';

      expect(service.isDirty(fileInfo)).toBe(false);
    });

    it('should return true when content differs from oldContent', () => {
      const fileInfo = service.processFileUrl(mockPayload);
      fileInfo.content = 'modified';
      fileInfo.oldContent = 'original';

      expect(service.isDirty(fileInfo)).toBe(true);
    });
  });

  describe('reset()', () => {
    it('should clear all tracked files', () => {
      service.processFileUrl(mockPayload);
      service.processFileUrl({
        ...mockPayload,
        file: '/w/myonara/other.c',
      });

      service.reset();

      expect(service.getFileInfo('/w/myonara/test.c')).toBeUndefined();
      expect(service.getFileInfo('/w/myonara/other.c')).toBeUndefined();
    });
  });
});
