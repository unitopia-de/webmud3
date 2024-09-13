jest.mock('./utils/resolve-modulepath', () => {
  return {
    resolveModulePath: jest.fn(() => '/path/to/project/root'),
  };
});

describe('Environment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();

    process.env = { ...originalEnv }; // Reset process.env to its original state
  });

  afterAll(() => {
    process.env = originalEnv; // Restore process.env
  });

  const getFreshEnvironmentInstance = async () => {
    // Dynamically import the Environment class to ensure a fresh instance
    const { Environment } = await import('./environment');

    return Environment.getInstance();
  };

  it('should create an instance of Environment', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.CHARSET = 'utf-8';

    const env = await getFreshEnvironmentInstance();

    const { Environment } = await import('./environment');

    expect(env).toBeInstanceOf(Environment);
  });

  it('should initialize environment variables correctly', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.CHARSET = 'utf-8';

    const env = await getFreshEnvironmentInstance();

    expect(env.telnetHost).toBe('localhost');

    expect(env.telnetPort).toBe(3000);

    expect(env.charset).toBe('utf-8');
  });

  it('should handle optional TLS configuration', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.CHARSET = 'utf-8';

    process.env.TELNET_TLS = 'true';

    const env = await getFreshEnvironmentInstance();

    expect(env.telnetTLS).toBe(true);
  });

  it('should handle TRUE as boolean values for TLS configuration', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.CHARSET = 'utf-8';

    process.env.TELNET_TLS = 'TRUE';

    const env = await getFreshEnvironmentInstance();

    expect(env.telnetTLS).toBe(true);
  });

  it('should handle missing TLS configuration gracefully', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.CHARSET = 'utf-8';

    const env = await getFreshEnvironmentInstance();

    expect(env.telnetTLS).toBe(false);
  });

  it('should use utf-8 charset when set to utf8', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.CHARSET = 'utf8';

    const env = await getFreshEnvironmentInstance();

    expect(env.charset).toBe('utf-8');
  });

  it('should use utf-8 charset when set to utf-8', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.CHARSET = 'utf-8';

    const env = await getFreshEnvironmentInstance();

    expect(env.charset).toBe('utf-8');
  });

  it('should use latin1 charset when set to latin1', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.CHARSET = 'latin1';

    const env = await getFreshEnvironmentInstance();

    expect(env.charset).toBe('latin1');
  });

  it('should use latin1 charset when set to iso-8859-1', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.CHARSET = 'iso-8859-1';

    const env = await getFreshEnvironmentInstance();

    expect(env.charset).toBe('latin1');
  });

  it('should use ascii charset when set to ascii', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.CHARSET = 'ascii';

    const env = await getFreshEnvironmentInstance();

    expect(env.charset).toBe('ascii');
  });

  it('should use ascii charset when set to us-ascii', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.CHARSET = 'us-ascii';

    const env = await getFreshEnvironmentInstance();

    expect(env.charset).toBe('ascii');
  });

  it('should throw an error for invalid charset', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.CHARSET = 'invalid-charset';

    await expect(getFreshEnvironmentInstance()).rejects.toThrow();
  });

  it('should use utf-8 as the default charset when CHARSET is not set', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    delete process.env.CHARSET; // Remove CHARSET from environment

    const env = await getFreshEnvironmentInstance();

    expect(env.charset).toBe('utf-8'); // Default value
  });

  it('should default to utf-8 when CHARSET is empty', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.CHARSET = ''; // Set CHARSET to an empty string

    const env = await getFreshEnvironmentInstance();

    expect(env.charset).toBe('utf-8'); // Default value
  });

  it('should set projectRoot correctly', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.CHARSET = 'utf-8';

    process.env.SOCKET_ROOT = '/socket.io';

    const env = await getFreshEnvironmentInstance();

    expect(env.projectRoot).toBe('/path/to/project/root');
  });
});
