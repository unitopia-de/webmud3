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
    const { Environment } = await import('./environment.js');

    return Environment.getInstance();
  };

  it('should create an instance of Environment', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    const env = await getFreshEnvironmentInstance();

    const { Environment } = await import('./environment.js');

    expect(env).toBeInstanceOf(Environment);
  });

  it('should initialize environment variables correctly', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    const env = await getFreshEnvironmentInstance();

    expect(env.telnetHost).toBe('localhost');

    expect(env.telnetPort).toBe(3000);
  });

  it('should handle optional TLS configuration', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.TELNET_TLS = 'true';

    const env = await getFreshEnvironmentInstance();

    expect(env.telnetTLS).toBe(true);
  });

  it('should handle TRUE as boolean values for TLS configuration', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.TELNET_TLS = 'TRUE';

    const env = await getFreshEnvironmentInstance();

    expect(env.telnetTLS).toBe(true);
  });

  it('should handle missing TLS configuration gracefully', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    const env = await getFreshEnvironmentInstance();

    expect(env.telnetTLS).toBe(false);
  });

  it('should set projectRoot correctly', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.CHARSET = 'utf-8';

    process.env.SOCKET_ROOT = '/socket.io';

    const env = await getFreshEnvironmentInstance();

    expect(env.projectRoot).toBe('/path/to/project/root');
  });

  it('should parse CORS allowed origins into a list', async () => {
    process.env.TELNET_HOST = 'localhost';

    process.env.TELNET_PORT = '3000';

    process.env.SOCKET_ROOT = '/socket.io';

    process.env.CORS_ALLOWED_ORIGINS =
      'https://example.com, https://another.example';

    const env = await getFreshEnvironmentInstance();

    expect(env.corsAllowList).toEqual([
      'https://example.com',
      'https://another.example',
    ]);
  });
});
