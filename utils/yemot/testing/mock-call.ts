/**
 * MockCall — programmable mock of yemot-router2's Call interface.
 *
 * Mirrors real yemot-router2 behavior:
 *   - hangup() → throws MockExitError
 *   - id_list_message() without prependToNextAction → throws MockExitError
 *   - id_list_message() with prependToNextAction: true → does NOT throw
 *   - read() after hangup → throws
 *
 * Usage:
 *   const call = new MockCall({ ApiDID: '...', ApiPhone: '...', ApiCallId: '...' });
 *   call.setInputs(['123', '1']);  // responses for successive read() calls
 *   await handler.processCall();
 *   call.getMessages();  // all id_list_message batches sent
 */

import { ExitError } from 'yemot-router2';
import { CallSuspended } from '../v2/yemot-replay';

export interface MockCallOptions {
  ApiDID?: string;
  ApiPhone?: string;
  ApiCallId?: string;
  ApiEnterID?: string;
  did?: string;
  phone?: string;
  callId?: string;
}

export interface YemotMessage {
  type: 'text' | 'file';
  data: string;
}

/**
 * Error thrown when the call is terminated (hangup or final id_list_message).
 * A real yemot-router2 ExitError, so handlers' `instanceof ExitError` checks match.
 */
export class MockExitError extends ExitError {
  constructor(message = 'the call was exited from the extension') {
    super(undefined, { caller: 'go_to_folder', target: 'hangup' });
    this.message = message;
    this.name = 'MockExitError';
  }
}

/**
 * Error thrown when MockCall runs out of programmed inputs.
 * This prevents infinite hangs in tests when a handler enters a retry loop
 * that the scenario didn't account for. A CallSuspended, since that is what a
 * read() with no answer yet throws in a stateless call.
 */
export class MockInputExhaustedError extends CallSuspended {
  constructor(readCount: number) {
    super(undefined);
    this.message =
      `MockCall ran out of programmed inputs after ${readCount} read() calls. ` +
      `The handler asked for more input than the scenario provided. ` +
      `Check that your scenario steps cover all retry loops and branches.`;
    this.name = 'MockInputExhaustedError';
  }
}

export class MockCall {
  did: string;
  phone: string;
  callId: string;
  ApiDID: string;
  ApiPhone: string;
  ApiCallId: string;
  ApiEnterID?: string;

  private inputs: (string | false)[] = [];
  private idx = 0;
  private responses: Array<{
    type: 'read' | 'id_list_message';
    messages: YemotMessage[];
    opts?: any;
    timestamp: number;
  }> = [];
  private _hungup = false;

  constructor(opts: MockCallOptions = {}) {
    this.did = opts.did || opts.ApiDID || '';
    this.phone = opts.phone || opts.ApiPhone || '';
    this.callId = opts.callId || opts.ApiCallId || '';
    this.ApiDID = opts.ApiDID || opts.did || '';
    this.ApiPhone = opts.ApiPhone || opts.phone || '';
    this.ApiCallId = opts.ApiCallId || opts.callId || '';
    this.ApiEnterID = opts.ApiEnterID;
  }

  /** Set the ordered list of inputs that read() will return. */
  setInputs(v: (string | false)[]): this {
    this.inputs = v;
    this.idx = 0;
    return this;
  }

  /** Whether hangup() was called. */
  wasHungup(): boolean {
    return this._hungup;
  }

  /** All id_list_message batches sent. */
  getMessages(): YemotMessage[][] {
    return this.responses
      .filter((r) => r.type === 'id_list_message')
      .map((r) => r.messages);
  }

  /** The most recent id_list_message batch, or null. */
  getLastMessage(): YemotMessage[] | null {
    const msgs = this.getMessages();
    return msgs.length > 0 ? msgs[msgs.length - 1] : null;
  }

  /** All recorded interactions (read + id_list_message). */
  getResponses() {
    return this.responses;
  }

  // ---- yemot-router2 Call interface ----

  async read(
    messages: YemotMessage[],
    _mode: string,
    _opts?: any,
  ): Promise<string | false> {
    this.responses.push({ type: 'read', messages, timestamp: Date.now() });
    if (this._hungup) {
      throw new Error(`Call ended - hangup`);
    }
    if (this.idx < this.inputs.length) {
      return this.inputs[this.idx++];
    }
    throw new MockInputExhaustedError(this.responses.filter(r => r.type === 'read').length + 1);
  }

  async id_list_message(
    messages: YemotMessage[],
    opts?: { prependToNextAction?: boolean },
  ): Promise<void> {
    this.responses.push({
      type: 'id_list_message',
      messages,
      opts,
      timestamp: Date.now(),
    });
    // Real yemot-router2: id_list_message without prependToNextAction
    // throws ExitError (same as go_to_folder / hangup).
    if (!opts?.prependToNextAction) {
      this._hungup = true;
      throw new MockExitError();
    }
  }

  hangup(): void {
    this._hungup = true;
    throw new MockExitError();
  }
}
