import {
  GmcpIncomingMessage,
  handleGmcpOption,
  parseGmcpMessage,
} from './handle-gmcp-option.js';

// Minimal mock for TelnetSocket — only the methods used by the handler
function createMockSocket() {
  return {
    writeDo: jest.fn(),
    writeDont: jest.fn(),
    writeWill: jest.fn(),
    writeWont: jest.fn(),
    writeSub: jest.fn(),
  } as unknown as import('telnet-stream').TelnetSocket;
}

describe('parseGmcpMessage', () => {
  it('should parse a standard GMCP message with JSON data', () => {
    const result = parseGmcpMessage('Core.Hello {"client":"WebMud3"}');

    expect(result).toEqual({
      module: 'Core',
      message: 'Hello',
      data: { client: 'WebMud3' },
    });
  });

  it('should parse a message without JSON data (empty object)', () => {
    const result = parseGmcpMessage('Core.Goodbye');

    expect(result).toEqual({
      module: 'Core',
      message: 'Goodbye',
      data: {},
    });
  });

  it('should parse a nested module message', () => {
    const result = parseGmcpMessage(
      'Char.Status.Vitals {"hp":100,"sp":50}',
    );

    expect(result).toEqual({
      module: 'Char',
      message: 'Status.Vitals',
      data: { hp: 100, sp: 50 },
    });
  });

  it('should handle a message with array data', () => {
    const result = parseGmcpMessage(
      'Core.Supports.Set ["Char 1","Sound 1"]',
    );

    expect(result).toEqual({
      module: 'Core',
      message: 'Supports.Set',
      data: ['Char 1', 'Sound 1'],
    });
  });

  it('should return null for empty string', () => {
    expect(parseGmcpMessage('')).toBeNull();
  });

  it('should return null for message without a dot', () => {
    expect(parseGmcpMessage('CoreHello')).toBeNull();
  });

  it('should return null if dot is at position 0', () => {
    expect(parseGmcpMessage('.Hello')).toBeNull();
  });

  it('should return null if message after dot is empty', () => {
    expect(parseGmcpMessage('Core.')).toBeNull();
  });

  it('should keep raw string as data when JSON is malformed', () => {
    const result = parseGmcpMessage('Core.Hello {invalid json}');

    expect(result).toEqual({
      module: 'Core',
      message: 'Hello',
      data: '{invalid json}',
    });
  });
});

describe('handleGmcpOption', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;
  let incomingMessages: GmcpIncomingMessage[];
  let handler: ReturnType<typeof handleGmcpOption>;

  beforeEach(() => {
    mockSocket = createMockSocket();
    incomingMessages = [];
    handler = handleGmcpOption(mockSocket, 'test-socket', (msg) => {
      incomingMessages.push(msg);
    });
  });

  describe('negotiation', () => {
    it('should accept GMCP when server sends WILL (respond with DO)', () => {
      const result = handler.handleWill();

      expect(result.controlSequence).toBe(253); // DO
      expect(mockSocket.writeDo).toHaveBeenCalledWith(201); // TELOPT_GMCP
    });

    it('should decline when server sends WONT (respond with DONT)', () => {
      const result = handler.handleWont();

      expect(result.controlSequence).toBe(254); // DONT
      expect(mockSocket.writeDont).toHaveBeenCalledWith(201); // TELOPT_GMCP
    });

    it('should refuse DO from server (respond with WONT)', () => {
      const result = handler.handleDo();

      expect(result.controlSequence).toBe(252); // WONT
      expect(mockSocket.writeWont).toHaveBeenCalledWith(201); // TELOPT_GMCP
    });

    it('should respond to DONT with WONT', () => {
      const result = handler.handleDont();

      expect(result.controlSequence).toBe(252); // WONT
      expect(mockSocket.writeWont).toHaveBeenCalledWith(201); // TELOPT_GMCP
    });
  });

  describe('state tracking', () => {
    it('should start inactive', () => {
      expect(handler.getState!()).toEqual({ isActive: false });
    });

    it('should become active after WILL negotiation', () => {
      handler.handleWill();

      expect(handler.getState!()).toEqual({ isActive: true });
    });

    it('should become inactive after WONT', () => {
      handler.handleWill(); // activate first
      handler.handleWont();

      expect(handler.getState!()).toEqual({ isActive: false });
    });
  });

  describe('handleSub (incoming GMCP messages)', () => {
    it('should parse and forward incoming GMCP messages', () => {
      const buffer = Buffer.from('Core.Hello {"client":"MudClient"}');

      handler.handleSub!(buffer);

      expect(incomingMessages).toHaveLength(1);
      expect(incomingMessages[0]).toEqual({
        module: 'Core',
        message: 'Hello',
        data: { client: 'MudClient' },
      });
    });

    it('should handle messages without payload', () => {
      const buffer = Buffer.from('Core.Goodbye');

      handler.handleSub!(buffer);

      expect(incomingMessages).toHaveLength(1);
      expect(incomingMessages[0]).toEqual({
        module: 'Core',
        message: 'Goodbye',
        data: {},
      });
    });

    it('should return subnegotiation result with module.message', () => {
      const buffer = Buffer.from('Char.Name {"name":"Test"}');

      const result = handler.handleSub!(buffer);

      expect(result).not.toBeNull();
      expect(result!.clientOption).toBe('Char.Name');
    });

    it('should return null for unparseable messages', () => {
      const buffer = Buffer.from('');

      const result = handler.handleSub!(buffer);

      expect(result).toBeNull();
      expect(incomingMessages).toHaveLength(0);
    });
  });

  describe('sendGmcp', () => {
    it('should send GMCP message when active', () => {
      handler.handleWill(); // activate GMCP

      handler.sendGmcp('Core', 'Hello', { client: 'WebMud3' });

      expect(mockSocket.writeSub).toHaveBeenCalledWith(
        201, // TELOPT_GMCP
        Buffer.from('Core.Hello {"client":"WebMud3"}', 'utf-8'),
      );
    });

    it('should not send when GMCP is inactive', () => {
      handler.sendGmcp('Core', 'Hello', { client: 'WebMud3' });

      expect(mockSocket.writeSub).not.toHaveBeenCalled();
    });

    it('should not send after deactivation', () => {
      handler.handleWill(); // activate
      handler.handleWont(); // deactivate

      handler.sendGmcp('Core', 'Hello', { client: 'WebMud3' });

      expect(mockSocket.writeSub).not.toHaveBeenCalled();
    });
  });
});
