import { TestBed } from '@angular/core/testing';

import { InputGmcpHandler, CompletionResult } from './input-gmcp-handler';
import { GmcpService } from '../gmcp/gmcp.service';

describe('InputGmcpHandler', () => {
  let handler: InputGmcpHandler;
  let gmcpService: GmcpService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InputGmcpHandler, GmcpService],
    });

    handler = TestBed.inject(InputGmcpHandler);
    gmcpService = TestBed.inject(GmcpService);
  });

  it('should have correct module metadata', () => {
    expect(handler.moduleName).toBe('Input');
    expect(handler.version).toBe('1');
  });

  describe('CompleteText', () => {
    it('should emit text completion result', () => {
      const results: CompletionResult[] = [];
      handler.completionResult$.subscribe(r => results.push(r));

      handler.handleMessage('CompleteText', 'nordwesten');

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('text');
      expect(results[0].value).toBe('nordwesten');
    });
  });

  describe('CompleteChoice', () => {
    it('should emit choice completion result', () => {
      const results: CompletionResult[] = [];
      handler.completionResult$.subscribe(r => results.push(r));

      const options = [['nord', 'nord'], ['nordwesten', 'nordwesten']];

      handler.handleMessage('CompleteChoice', options);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('choice');
      expect(results[0].options).toEqual(options);
    });
  });

  describe('CompleteNone', () => {
    it('should emit none completion result', () => {
      const results: CompletionResult[] = [];
      handler.completionResult$.subscribe(r => results.push(r));

      handler.handleMessage('CompleteNone', null);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('none');
    });
  });

  describe('requestCompletion', () => {
    it('should send GMCP Input.Complete request', () => {
      const sendSpy = jest.spyOn(gmcpService, 'sendOutgoing').mockImplementation(() => {});

      handler.requestCompletion('nor');

      expect(sendSpy).toHaveBeenCalledWith('Input', 'Complete', { text: 'nor' });
    });
  });
});
