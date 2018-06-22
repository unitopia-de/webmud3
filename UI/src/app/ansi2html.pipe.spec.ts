import { Ansi2htmlPipe } from './ansi2html.pipe';

describe('Ansi2htmlPipe', () => {
  it('create an instance', () => {
    const pipe = new Ansi2htmlPipe();
    expect(pipe).toBeTruthy();
  });
});
