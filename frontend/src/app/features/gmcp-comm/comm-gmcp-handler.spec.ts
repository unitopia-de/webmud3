import { TestBed } from '@angular/core/testing';

import { CommGmcpHandler, CommMessage } from './comm-gmcp-handler';

describe('CommGmcpHandler', () => {
  let handler: CommGmcpHandler;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CommGmcpHandler],
    });

    handler = TestBed.inject(CommGmcpHandler);
  });

  it('should have correct module metadata', () => {
    expect(handler.moduleName).toBe('Comm');
    expect(handler.version).toBe('1');
  });

  it('should emit Say messages', () => {
    const messages: CommMessage[] = [];
    handler.commMessage$.subscribe(m => messages.push(m));

    handler.handleMessage('Say', { text: 'Hallo!' });

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('Say');
  });

  it('should emit Soul messages', () => {
    const messages: CommMessage[] = [];
    handler.commMessage$.subscribe(m => messages.push(m));

    handler.handleMessage('Soul', { text: 'grinst.' });

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('Soul');
  });

  it('should emit Tell messages', () => {
    const messages: CommMessage[] = [];
    handler.commMessage$.subscribe(m => messages.push(m));

    handler.handleMessage('Tell', { from: 'Leo', text: 'Hi!' });

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('Tell');
  });

  it('should not emit for unknown messages', () => {
    const messages: CommMessage[] = [];
    handler.commMessage$.subscribe(m => messages.push(m));

    handler.handleMessage('Unknown', {});

    expect(messages).toHaveLength(0);
  });
});
