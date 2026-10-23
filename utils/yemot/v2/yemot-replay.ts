import { EventEmitter } from 'events';
import { Call, ExitError, HangupError } from 'yemot-router2';

// Stateless call handling: nothing about a call is kept in memory between Yemot
// requests, so any server node can answer any request of the call.
//
// Yemot resends every value collected so far (val_1, val_2, ...) on each request,
// so each request runs processCall() from the top: read() returns the value Yemot
// already sent, and the first read() with no value sends its prompt and throws
// CallSuspended. A hangup=yes request replays the same way and throws HangupError
// at that read, so a handler's catch/finally still runs once when the caller leaves.
//
// Handlers must make the same calls in the same order on every replay: no new Date()
// or Math.random() in flow decisions (use callStartedAt / once()), and mid-call DB
// writes wrapped in once() so they run on one request only.

// ExitError subclass so yemot-router2 treats it as a normal end and drops the call.
export class CallSuspended extends ExitError {
  constructor(call: Call) {
    super(call, { caller: 'id_list_message', target: 'next request' });
    this.name = 'CallSuspended';
  }
}

type Messages = Parameters<Call['id_list_message']>[0];

interface ReplayState {
  startedAt?: Date;
  isHangup: boolean;
  answeredCount: number;
  consumedCount: number;
}

const states = new WeakMap<Call, ReplayState>();

export function getReplayState(call: Call): ReplayState | undefined {
  return states.get(call);
}

// True while the handler is re-running steps an earlier request already did.
export function isReplaying(call: Call): boolean {
  const state = states.get(call);
  return Boolean(state) && (state.isHangup || state.consumedCount < state.answeredCount);
}

export function enableReplay(call: Call, events: EventEmitter, startedAt?: Date): void {
  const values = call.values;
  const state: ReplayState = {
    startedAt,
    isHangup: values.hangup === 'yes',
    answeredCount: Object.keys(values).filter((key) => /^val_\d+$/.test(key)).length,
    consumedCount: 0,
  };
  states.set(call, state);

  const read = call.read.bind(call);
  const idListMessage = call.id_list_message.bind(call);
  const goToFolder = call.go_to_folder.bind(call);
  const routingYemot = (call as any).routing_yemot.bind(call);
  let readCount = 0;
  // prependToNextAction messages wait here, so ones already played on an earlier
  // request are dropped instead of being played again before the next prompt.
  let queued: Messages[] = [];

  const flush = () => {
    if (state.isHangup) throw new ExitError(call, { caller: 'id_list_message', target: 'hangup' });
    queued.forEach((messages) => idListMessage(messages, { prependToNextAction: true }));
    queued = [];
  };

  call.id_list_message = (messages, options) => {
    if (options?.prependToNextAction) {
      queued.push(messages);
      return;
    }
    flush();
    return idListMessage(messages, options);
  };
  // hangup() and restart_ext() go through go_to_folder()
  call.go_to_folder = (target) => {
    flush();
    return goToFolder(target);
  };
  (call as any).routing_yemot = (number: string) => {
    flush();
    return routingYemot(number);
  };

  call.read = (async (messages, mode, options: any = {}) => {
    const valName = options.val_name ?? `val_${++readCount}`;
    if (valName in values) {
      state.consumedCount++;
      queued = [];
      const value = values[valName];
      return options.allow_empty && String(value) === String(options.empty_val) ? options.empty_val : value;
    }

    if (state.isHangup) throw new HangupError(call);
    flush();
    // Sends the prompt synchronously; timeout 0 so no timer outlives this request.
    const pending = read(messages, mode, { ...options, val_name: valName, timeout: 0 });
    pending.catch(() => undefined); // never resumed - the next request replays instead
    if (!call.req.res?.headersSent) await pending; // surfaces a validation error
    events.removeAllListeners(call.callId);
    throw new CallSuspended(call);
  }) as Call['read'];
}
