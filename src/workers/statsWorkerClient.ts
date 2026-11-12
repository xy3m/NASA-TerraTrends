import type { StatsWorkerRequest, StatsWorkerResponse } from './statsWorker';

export interface WorkerExecutionResult<T> {
  result: T;
  durationMs: number;
  viaWorker: boolean;
}

type PendingTask = {
  resolve: (value: WorkerExecutionResult<unknown>) => void;
  reject: (reason?: unknown) => void;
};

let sharedWorker: Worker | null = null;
let taskSeq = 0;
const pendingTasks = new Map<string, PendingTask>();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;

  if (!sharedWorker) {
    sharedWorker = new Worker(new URL('./statsWorker.ts', import.meta.url), {
      type: 'module',
    });

    sharedWorker.onmessage = (event: MessageEvent<StatsWorkerResponse>) => {
      const { id, result, error, durationMs } = event.data;
      const pending = pendingTasks.get(id);
      if (!pending) return;
      pendingTasks.delete(id);

      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve({ result, durationMs, viaWorker: true });
      }
    };

    sharedWorker.onerror = (err: ErrorEvent) => {
      for (const [id, pending] of pendingTasks.entries()) {
        pending.reject(new Error(err.message || 'Stats Web Worker failed'));
        pendingTasks.delete(id);
      }
      sharedWorker?.terminate();
      sharedWorker = null;
    };
  }

  return sharedWorker;
}

/**
 * Dispatch a computation to statsWorker.ts, with an optional main-thread fallback
 * when Web Workers are unavailable (e.g. non-browser test environments).
 */
export async function runStatsWorkerTask<T>(
  type: StatsWorkerRequest['type'],
  payload: Record<string, unknown>,
  fallback?: () => T
): Promise<WorkerExecutionResult<T>> {
  const worker = getWorker();
  if (!worker) {
    if (!fallback) {
      throw new Error(`Web Worker unavailable for task "${type}"`);
    }
    const start = performance.now();
    const result = fallback();
    return { result, durationMs: performance.now() - start, viaWorker: false };
  }

  const id = `task_${++taskSeq}_${Date.now()}`;
  return new Promise<WorkerExecutionResult<T>>((resolve, reject) => {
    pendingTasks.set(id, {
      resolve: (val) => resolve(val as WorkerExecutionResult<T>),
      reject,
    });

    const req: StatsWorkerRequest = { id, type, payload };
    worker.postMessage(req);
  });
}

