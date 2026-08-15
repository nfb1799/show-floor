/**
 * localStorage persistence. No backend, per the design doc.
 *
 * The whole run snapshot is plain data, so saving is a JSON round-trip. The one
 * thing that needs care is the RNG: only its integer state is stored, and
 * createRng(state) reconstitutes the identical stream.
 */

import type { RunSnapshot } from './runState';

const KEY = 'showFloor.run.v1';
const BEST_KEY = 'showFloor.best.v1';
const VERSION = 2;

interface Envelope {
  readonly version: number;
  readonly saved: number;
  readonly run: RunSnapshot;
}

function storage(): Storage | null {
  try {
    // Absent in tests and in private-mode Safari.
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveRun(run: RunSnapshot): void {
  const store = storage();
  if (!store) return;
  try {
    const envelope: Envelope = { version: VERSION, saved: Date.now(), run };
    store.setItem(KEY, JSON.stringify(envelope));
  } catch {
    // Quota or serialisation failure is not worth interrupting a run over.
  }
}

export function loadRun(): RunSnapshot | null {
  const store = storage();
  if (!store) return null;
  try {
    const text = store.getItem(KEY);
    if (!text) return null;
    const envelope = JSON.parse(text) as Envelope;
    if (envelope.version !== VERSION) return null;
    return envelope.run;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  storage()?.removeItem(KEY);
}

export interface BestRun {
  readonly showsCleared: number;
  readonly totalEarned: number;
  readonly seed: string;
}

export function loadBest(): BestRun | null {
  const store = storage();
  if (!store) return null;
  try {
    const text = store.getItem(BEST_KEY);
    return text ? (JSON.parse(text) as BestRun) : null;
  } catch {
    return null;
  }
}

/** Keeps whichever run got further, measured in shows cleared. */
export function recordBest(candidate: BestRun): BestRun {
  const store = storage();
  const current = loadBest();
  const best =
    current && current.showsCleared >= candidate.showsCleared ? current : candidate;

  try {
    store?.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // Non-fatal.
  }
  return best;
}
