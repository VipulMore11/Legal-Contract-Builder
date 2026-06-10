export interface WorkerSuccessResult {
  success: true;
  type: 'init' | 'dispatch';
  state: Record<string, unknown>;
  response?: Record<string, unknown>;
  emit: unknown[];
  durationMs: number;
}
export interface WorkerErrorResult {
  success: false;
  error: string;
  stack: string;
  durationMs: number;
}
export type WorkerResult = WorkerSuccessResult | WorkerErrorResult;

export interface InitMessage   { type: 'init';     logic: string; params: Record<string, unknown>; }
export interface DispatchMessage { type: 'dispatch'; logic: string; params: Record<string, unknown>; state: Record<string, unknown>; request: Record<string, unknown>; }
export type WorkerMessage = InitMessage | DispatchMessage;

let _worker: Worker | null = null;
const _pending = new Map<string, { resolve: (r: WorkerResult) => void; startTime: number }>();
let _idCounter = 0;

function getWorker(): Worker {
  if (typeof window === 'undefined') throw new Error('Worker cannot be created server-side.');
  if (!_worker) {
    _worker = new Worker('/logic-worker.js');
    _worker.onmessage = (e: MessageEvent) => {
      const { id, ...rest } = e.data as { id: string } & Omit<WorkerResult, 'durationMs'>;
      const entry = _pending.get(id);
      if (!entry) return;
      _pending.delete(id);
      entry.resolve({ ...rest, durationMs: Date.now() - entry.startTime } as WorkerResult);
    };
    _worker.onerror = (e: ErrorEvent) => {
      for (const [id, entry] of _pending.entries()) {
        entry.resolve({ success: false, error: e.message ?? 'Worker crashed', stack: '', durationMs: Date.now() - entry.startTime });
        _pending.delete(id);
      }
      _worker = null;
    };
  }
  return _worker;
}

export function executeLogic(msg: WorkerMessage): Promise<WorkerResult> {
  return new Promise((resolve) => {
    const id = String(++_idCounter);
    _pending.set(id, { resolve, startTime: Date.now() });
    getWorker().postMessage({ id, ...msg });
  });
}

export function terminateWorker(): void {
  _worker?.terminate();
  _worker = null;
  _pending.clear();
}
