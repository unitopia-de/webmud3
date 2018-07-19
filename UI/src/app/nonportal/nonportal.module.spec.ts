import { NonportalModule } from './nonportal.module';

describe('NonportalModule', () => {
  let nonportalModule: NonportalModule;

  beforeEach(() => {
    nonportalModule = new NonportalModule();
  });

  it('should create an instance', () => {
    expect(nonportalModule).toBeTruthy();
  });
});
