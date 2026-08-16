/**
 * Formats what `harness.ts` counted into something a human can read in a
 * terminal. Pure string building — see report.test.ts for how to run it.
 */

import { PITCH_TYPES } from '../constants';
import { simulateRuns, type PitchSample, type RunSample } from './harness';
import type { BuyerArchetypeId } from '../types';

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;
const pad = (s: string, n: number): string => s.padEnd(n);
const padStart = (s: string, n: number): string => s.padStart(n);

// ---------------------------------------------------------------------------
// Aggregates, exported so balance.test.ts can guard them
// ---------------------------------------------------------------------------

export interface BalanceSummary {
  readonly runs: number;
  readonly pitches: number;
  readonly medianDepth: number;
  /** Share of runs that died at the single worst show. A cliff, if it is high. */
  readonly worstShowShare: number;
  readonly worstShowIndex: number;
  readonly medianTies: number;
  readonly tiedShare: number;
  readonly medianDensity: number;
  readonly cardsPerSale: number;
  readonly cappedShare: number;
  /** Pitch types that never fired in the whole sample. */
  readonly deadPitchTypes: readonly string[];
}

export function summarize(runs: readonly RunSample[]): BalanceSummary {
  const pitches = runs.flatMap((r) => r.pitches);

  const deathsByShow = new Map<number, number>();
  for (const run of runs) {
    if (run.death === 'survived') continue;
    deathsByShow.set(run.deathShow, (deathsByShow.get(run.deathShow) ?? 0) + 1);
  }
  let worstShowIndex = 0;
  let worstCount = 0;
  for (const [showIndex, count] of deathsByShow) {
    if (count > worstCount) {
      worstCount = count;
      worstShowIndex = showIndex;
    }
  }

  const fired = new Set(pitches.map((p) => p.pitchType));

  return {
    runs: runs.length,
    pitches: pitches.length,
    medianDepth: median(runs.map((r) => r.depth)),
    worstShowShare: runs.length > 0 ? worstCount / runs.length : 0,
    worstShowIndex,
    medianTies: median(pitches.map((p) => p.ties)),
    tiedShare: pitches.length > 0 ? pitches.filter((p) => p.ties > 1).length / pitches.length : 0,
    medianDensity: median(pitches.map((p) => p.density)),
    cardsPerSale: mean(pitches.map((p) => p.cardCount)),
    cappedShare:
      pitches.length > 0 ? pitches.filter((p) => p.cappedByBudget).length / pitches.length : 0,
    deadPitchTypes: PITCH_TYPES.filter((t) => !fired.has(t.id)).map((t) => t.label),
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function pitchTypeTable(pitches: readonly PitchSample[]): string {
  const counts = new Map<string, number>();
  for (const p of pitches) counts.set(p.pitchType, (counts.get(p.pitchType) ?? 0) + 1);

  return PITCH_TYPES.map((t) => {
    const n = counts.get(t.id) ?? 0;
    const share = pitches.length > 0 ? n / pitches.length : 0;
    const bar = '#'.repeat(Math.round(share * 40));
    return `  ${pad(t.label, 14)} ${padStart(pct(share), 6)}  ${bar}`;
  }).join('\n');
}

function archetypeTable(pitches: readonly PitchSample[]): string {
  const byArchetype = new Map<BuyerArchetypeId, number[]>();
  for (const p of pitches) {
    const list = byArchetype.get(p.archetype) ?? [];
    list.push(p.offer);
    byArchetype.set(p.archetype, list);
  }

  return [...byArchetype.entries()]
    .map(([archetype, offers]) => ({ archetype, avg: mean(offers), n: offers.length }))
    .sort((a, b) => b.avg - a.avg)
    .map(
      (row) =>
        `  ${pad(row.archetype, 20)} ${padStart(`$${Math.round(row.avg)}`, 7)} avg  ${padStart(String(row.n), 5)} sales`,
    )
    .join('\n');
}

function deathTable(runs: readonly RunSample[]): string {
  const byShow = new Map<number, Map<string, number>>();
  for (const run of runs) {
    if (run.death === 'survived') continue;
    const row = byShow.get(run.deathShow) ?? new Map<string, number>();
    row.set(run.death, (row.get(run.death) ?? 0) + 1);
    byShow.set(run.deathShow, row);
  }

  const survived = runs.filter((r) => r.death === 'survived').length;
  const lines = [...byShow.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([showIndex, causes]) => {
      const total = [...causes.values()].reduce((a, b) => a + b, 0);
      const detail = [...causes.entries()].map(([cause, n]) => `${cause} ${n}`).join(', ');
      return `  show ${padStart(String(showIndex), 2)}  ${padStart(String(total), 3)}  ${'#'.repeat(total)}  (${detail})`;
    });

  if (survived > 0) lines.push(`  survived  ${padStart(String(survived), 3)}`);
  return lines.join('\n');
}

function clearanceTable(runs: readonly RunSample[]): string {
  const byShow = new Map<number, number[]>();
  for (const run of runs) {
    for (const show of run.shows) {
      const list = byShow.get(show.showIndex) ?? [];
      list.push(show.earned / show.quota);
      byShow.set(show.showIndex, list);
    }
  }

  return [...byShow.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([showIndex, ratios]) => {
      const m = median(ratios);
      return `  show ${padStart(String(showIndex), 2)}  ${padStart(`${m.toFixed(2)}x`, 6)}  n=${padStart(String(ratios.length), 3)}  ${'#'.repeat(Math.min(40, Math.round(m * 10)))}`;
    })
    .join('\n');
}

export function renderReport(runs: readonly RunSample[]): string {
  const s = summarize(runs);
  const pitches = runs.flatMap((r) => r.pitches);

  return [
    '',
    `=== Show Floor balance report (${s.runs} runs, ${s.pitches} pitches) ===`,
    '',
    '-- Decisions --',
    `  distinct card sets tied for best (median)   ${s.medianTies}`,
    `  pitches with any tie                        ${pct(s.tiedShare)}`,
    `  decision density (best vs. alternative)     ${pct(s.medianDensity)}`,
    `  cards spent per sale                        ${s.cardsPerSale.toFixed(2)}`,
    `  pitches capped by budget                    ${pct(s.cappedShare)}`,
    '',
    '-- Pitch types --',
    pitchTypeTable(pitches),
    s.deadPitchTypes.length > 0
      ? `  never fired: ${s.deadPitchTypes.join(', ')}`
      : '  every pitch type fired at least once',
    '',
    '-- Buyers (realized, not budget) --',
    archetypeTable(pitches),
    '',
    '-- Quota clearance --',
    clearanceTable(runs),
    '',
    '-- Deaths --',
    `  median run depth  ${s.medianDepth}`,
    deathTable(runs),
    '',
  ].join('\n');
}

/** One call for the common case: simulate, then render. */
export function report(runCount = 40): string {
  return renderReport(simulateRuns(runCount));
}
