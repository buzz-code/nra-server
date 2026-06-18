import { MockCall, MockExitError, MockInputExhaustedError } from '../mock-call';

describe('MockCall', () => {
  it('should return programmed inputs in order', async () => {
    const call = new MockCall({ ApiPhone: '0501234567' });
    call.setInputs(['first', 'second', 'third']);

    expect(await call.read([{ type: 'text', data: 'msg1' }], 'text')).toBe('first');
    expect(await call.read([{ type: 'text', data: 'msg2' }], 'text')).toBe('second');
    expect(await call.read([{ type: 'text', data: 'msg3' }], 'text')).toBe('third');
  });

  it('should throw MockInputExhaustedError when inputs exhausted', async () => {
    const call = new MockCall();
    call.setInputs(['only']);
    await call.read([{ type: 'text', data: 'msg' }], 'text');
    await expect(
      call.read([{ type: 'text', data: 'msg' }], 'text')
    ).rejects.toThrow(MockInputExhaustedError);
  });

  it('should throw MockExitError on hangup()', () => {
    const call = new MockCall();
    expect(() => call.hangup()).toThrow(MockExitError);
    expect(call.wasHungup()).toBe(true);
  });

  it('should throw MockExitError on id_list_message without prependToNextAction', async () => {
    const call = new MockCall();
    await expect(
      call.id_list_message([{ type: 'text', data: 'final' }])
    ).rejects.toThrow(MockExitError);
    expect(call.wasHungup()).toBe(true);
  });

  it('should NOT throw on id_list_message with prependToNextAction', async () => {
    const call = new MockCall();
    await call.id_list_message(
      [{ type: 'text', data: 'before read' }],
      { prependToNextAction: true }
    );
    expect(call.wasHungup()).toBe(false);
  });

  it('should throw on read() after hangup', async () => {
    const call = new MockCall();
    try { call.hangup(); } catch (e) { /* expected */ }
    await expect(
      call.read([{ type: 'text', data: 'msg' }], 'text')
    ).rejects.toThrow('Call ended - hangup');
  });

  it('should record messages in getMessages()', async () => {
    const call = new MockCall();
    await call.id_list_message(
      [{ type: 'text', data: 'msg1' }],
      { prependToNextAction: true }
    );
    try { await call.id_list_message([{ type: 'text', data: 'msg2' }]); } catch (e) { }

    const msgs = call.getMessages();
    expect(msgs).toHaveLength(2);
    expect(msgs[0][0].data).toBe('msg1');
    expect(msgs[1][0].data).toBe('msg2');
  });

  it('should expose ApiPhone and phone', () => {
    const call = new MockCall({ ApiPhone: '0501234567' });
    expect(call.ApiPhone).toBe('0501234567');
    expect(call.phone).toBe('0501234567');
  });
});
