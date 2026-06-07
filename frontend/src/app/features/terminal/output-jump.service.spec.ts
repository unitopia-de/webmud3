import { OutputJumpService } from './output-jump.service';

describe('OutputJumpService', () => {
  it('notifies subscribers when a jump is requested', () => {
    const svc = new OutputJumpService();
    let count = 0;
    const sub = svc.jump$.subscribe(() => (count += 1));

    svc.requestJump();
    svc.requestJump();

    expect(count).toBe(2);
    sub.unsubscribe();
  });

  it('does not replay past jumps to late subscribers (plain Subject)', () => {
    const svc = new OutputJumpService();
    svc.requestJump();

    let count = 0;
    const sub = svc.jump$.subscribe(() => (count += 1));
    expect(count).toBe(0);
    sub.unsubscribe();
  });
});
