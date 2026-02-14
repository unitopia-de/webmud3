import { SocketManager } from './socket-manager.js';

/**
 * Tests for SocketManager.extractRealIp().
 *
 * We create minimal mock socket objects — only the handshake fields
 * that extractRealIp actually reads are needed.
 */
describe('SocketManager.extractRealIp', () => {
  function mockSocket(
    address: string,
    xForwardedFor?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    return {
      handshake: {
        address,
        headers: {
          ...(xForwardedFor !== undefined
            ? { 'x-forwarded-for': xForwardedFor }
            : {}),
        },
      },
    };
  }

  it('should return x-forwarded-for when present (single IP)', () => {
    const socket = mockSocket('127.0.0.1', '203.0.113.50');

    expect(SocketManager.extractRealIp(socket)).toBe('203.0.113.50');
  });

  it('should return first IP from x-forwarded-for with multiple entries', () => {
    const socket = mockSocket(
      '127.0.0.1',
      '203.0.113.50, 70.41.3.18, 150.172.238.178',
    );

    expect(SocketManager.extractRealIp(socket)).toBe('203.0.113.50');
  });

  it('should trim whitespace from x-forwarded-for', () => {
    const socket = mockSocket('127.0.0.1', '  203.0.113.50  ');

    expect(SocketManager.extractRealIp(socket)).toBe('203.0.113.50');
  });

  it('should fall back to handshake.address when x-forwarded-for is missing', () => {
    const socket = mockSocket('192.168.1.100');

    expect(SocketManager.extractRealIp(socket)).toBe('192.168.1.100');
  });

  it('should fall back to handshake.address when x-forwarded-for is empty', () => {
    const socket = mockSocket('10.0.0.1', '');

    expect(SocketManager.extractRealIp(socket)).toBe('10.0.0.1');
  });

  it('should handle IPv6 addresses', () => {
    const socket = mockSocket(
      '::1',
      '2003:c6:b707:9b00:a924:3e18:56b4:867',
    );

    expect(SocketManager.extractRealIp(socket)).toBe(
      '2003:c6:b707:9b00:a924:3e18:56b4:867',
    );
  });

  it('should handle IPv6 in x-forwarded-for with multiple entries', () => {
    const socket = mockSocket(
      '::1',
      '2003:c6:b707:9b00::1, 10.0.0.1',
    );

    // Note: comma-based split works for IPv6 since IPv6 doesn't use commas
    expect(SocketManager.extractRealIp(socket)).toBe(
      '2003:c6:b707:9b00::1',
    );
  });
});
