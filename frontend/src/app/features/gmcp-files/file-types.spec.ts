import { editorModeFromExtension } from './file-types';

describe('editorModeFromExtension', () => {
  it('should return "c_cpp" for .c files', () => {
    expect(editorModeFromExtension('.c')).toBe('c_cpp');
  });

  it('should return "c_cpp" for .h files', () => {
    expect(editorModeFromExtension('.h')).toBe('c_cpp');
  });

  it('should return "c_cpp" for .inc files', () => {
    expect(editorModeFromExtension('.inc')).toBe('c_cpp');
  });

  it('should return "text" for unknown extensions', () => {
    expect(editorModeFromExtension('.txt')).toBe('text');
    expect(editorModeFromExtension('.md')).toBe('text');
    expect(editorModeFromExtension('.log')).toBe('text');
    expect(editorModeFromExtension('')).toBe('text');
  });
});
