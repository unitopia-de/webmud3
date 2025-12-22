import { EnvironmentKeys } from '../types/environment-keys.js';
import { getEnvironmentVariable } from './get-environment-variable.js';

describe('getEnvironmentVariable', () => {
  const ENV_KEY = 'TEST_ENV_KEY' as EnvironmentKeys;

  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  it('should return the value of the environment variable if set', () => {
    process.env[ENV_KEY] = 'test_value';

    const value = getEnvironmentVariable(ENV_KEY);

    expect(value).toBe('test_value');
  });

  it('should throw an error if the environment variable is not set and throwError is true', () => {
    expect(() => getEnvironmentVariable(ENV_KEY)).toThrow(
      `Environment variable ${ENV_KEY} is not set`,
    );
  });

  it('should return the default value if the environment variable is not set and throwError is false', () => {
    const defaultValue = 'default_value';

    const value = getEnvironmentVariable(ENV_KEY, false, defaultValue);

    expect(value).toBe(defaultValue);
  });

  it('should return null if the environment variable is not set, throwError is false, and no default value is provided', () => {
    const value = getEnvironmentVariable(ENV_KEY, false);

    expect(value).toBeNull();
  });

  // Todo[myst] renable this tests by mocking the new logger
  // it('should log a warning if the environment variable is not set, throwError is false, and no default value is provided', () => {
  //   console.warn = jest.fn();

  //   getEnvironmentVariable(ENV_KEY, false);

  //   expect(console.warn).toHaveBeenCalledWith(
  //     `Environment variable ${ENV_KEY} is not set and no default value provided.`,
  //   );
  // });

  // it('should log a warning if the environment variable is not set and a default value is provided', () => {
  //   const defaultValue = 'default_value';

  //   console.warn = jest.fn();

  //   getEnvironmentVariable(ENV_KEY, false, defaultValue);

  //   expect(console.warn).toHaveBeenCalledWith(
  //     `Environment variable ${ENV_KEY} is not set. Using default value: ${defaultValue}`,
  //   );
  // });
});
