import { GmcpModule } from './gmcp.module';

describe('GmcpModule', () => {
  let gmcpModule: GmcpModule;

  beforeEach(() => {
    gmcpModule = new GmcpModule();
  });

  it('should create an instance', () => {
    expect(gmcpModule).toBeTruthy();
  });
});
