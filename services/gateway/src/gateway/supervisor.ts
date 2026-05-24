import { spawn, ChildProcess } from 'child_process';

/**
 * Bounded-restart supervisor for the Python LiveKit bridge subprocess.
 *
 * The supervisor wraps a single spawn so callers can hand it the same
 * argv they would pass to `child_process.spawn` and get back a handle
 * with:
 *   - `current`: the live ChildProcess (rotates on restart)
 *   - `onRestart(cb)`: invoked after a successful respawn
 *   - `stop()`: stop the loop and SIGTERM the live process (idempotent)
 *
 * Restart policy: if the subprocess exits with a non-zero code OR is
 * killed by a signal other than SIGTERM, restart up to `maxRestarts`
 * times within `windowMs`. Each restart waits `backoffMs * attempts`
 * before respawn (linear backoff). Graceful SIGTERM exits do NOT
 * trigger a restart — that path is reserved for `stop()`.
 *
 * Stdout / stderr handlers passed in are re-attached on every respawn
 * so callers see a continuous stream without re-registering listeners.
 */
export interface SupervisorOptions {
  command: string;
  args: string[];
  bridgeId: string;
  maxRestarts?: number;
  windowMs?: number;
  backoffMs?: number;
  onStdout?: (chunk: Buffer) => void;
  onStderr?: (chunk: Buffer) => void;
  /** Called after each respawn so the parent can notify clients. */
  onRestart?: (attempt: number) => void;
  /** Called when the supervisor gives up (budget exhausted). */
  onGaveUp?: (lastCode: number | null, lastSignal: NodeJS.Signals | null) => void;
}

export interface SupervisorHandle {
  current: ChildProcess;
  stop(): void;
}

export function startSupervisedProcess(opts: SupervisorOptions): SupervisorHandle {
  const maxRestarts = opts.maxRestarts ?? 3;
  const windowMs = opts.windowMs ?? 30_000;
  const backoffMs = opts.backoffMs ?? 500;

  const restartTimestamps: number[] = [];
  let stopped = false;
  let attempt = 0;
  let current: ChildProcess = doSpawn();

  function doSpawn(): ChildProcess {
    const child = spawn(opts.command, opts.args);
    if (opts.onStdout) child.stdout?.on('data', opts.onStdout);
    if (opts.onStderr) child.stderr?.on('data', opts.onStderr);
    child.on('close', (code, signal) => onChildClose(code, signal));
    return child;
  }

  function onChildClose(code: number | null, signal: NodeJS.Signals | null): void {
    if (stopped) return;
    if (signal === 'SIGTERM') return; // graceful — owner stopped us via stop()

    // Budget: drop timestamps older than the window, then check ceiling.
    const now = Date.now();
    while (restartTimestamps.length && now - restartTimestamps[0] > windowMs) {
      restartTimestamps.shift();
    }
    if (restartTimestamps.length >= maxRestarts) {
      console.error(`[supervisor ${opts.bridgeId}] restart budget exhausted (${maxRestarts}/${windowMs}ms). Giving up.`);
      stopped = true;
      opts.onGaveUp?.(code, signal);
      return;
    }

    attempt += 1;
    const wait = backoffMs * attempt;
    console.warn(`[supervisor ${opts.bridgeId}] subprocess exited code=${code} signal=${signal}. Restarting in ${wait}ms (attempt ${attempt}).`);
    setTimeout(() => {
      if (stopped) return;
      restartTimestamps.push(Date.now());
      current = doSpawn();
      handle.current = current;
      opts.onRestart?.(attempt);
    }, wait);
  }

  const handle: SupervisorHandle = {
    current,
    stop(): void {
      if (stopped) return;
      stopped = true;
      try { current.kill('SIGTERM'); } catch { /* ignore */ }
    },
  };
  return handle;
}
