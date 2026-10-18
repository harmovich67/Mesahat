import { runLifecycle } from '../services/bookings.js';
import { config } from '../config/env.js';

let intervalId = null;

export function startLifecycleJob() {
  if (!config.jobs.enabled) return;

  const run = async () => {
    try {
      await runLifecycle();
    } catch (err) {
      console.error('[lifecycle job] error:', err.message);
    }
  };

  // Run on startup
  run();
  intervalId = setInterval(run, config.jobs.intervalMs);
  return () => {
    if (intervalId) clearInterval(intervalId);
  };
}
