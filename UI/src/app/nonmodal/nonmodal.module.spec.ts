import { NonmodalModule } from './nonmodal.module';

describe('NonmodalModule', () => {
  let nonmodalModule: NonmodalModule;

  beforeEach(() => {
    nonmodalModule = new NonmodalModule();
  });

  it('should create an instance', () => {
    expect(nonmodalModule).toBeTruthy();
  });
});
