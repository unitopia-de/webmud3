import { MudModule } from './mud.module';

describe('MudModule', () => {
  let mudModule: MudModule;

  beforeEach(() => {
    mudModule = new MudModule();
  });

  it('should create an instance', () => {
    expect(mudModule).toBeTruthy();
  });
});
