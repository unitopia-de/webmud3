import { MudconfigModule } from './mudconfig.module';

describe('MudconfigModule', () => {
  let mudconfigModule: MudconfigModule;

  beforeEach(() => {
    mudconfigModule = new MudconfigModule();
  });

  it('should create an instance', () => {
    expect(mudconfigModule).toBeTruthy();
  });
});
