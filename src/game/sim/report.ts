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
  /** How far ahead the best buyer to serve is of the next best. */
  readonly medianSeatMargin: number;
  /** Share of everyone who came through a show and left without buying. */
  readonly walkedShare: number;
  readonly servedPerShow: number;
  /** Mean Buzz a sale was made at, and the mean peak a show reached. */
  readonly meanBuzz: number;
  readonly meanPeakBuzz: number;
  readonly pleasedShare: number;
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
  const shows = runs.flatMap((r) => r.shows);
  const served = shows.reduce((sum, s) => sum + s.served, 0);
  const walked = shows.reduce((sum, s) => sum + s.walked, 0);
  const margins = pitches.map((p) => p.seatMargin).filter((m): m is number => m !== null);

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
    medianSeatMargin: median(margins),
    walkedShare: served + walked > 0 ? walked / (served + walked) : 0,
    servedPerShow: shows.length > 0 ? served / shows.length : 0,
    meanBuzz: mean(pitches.map((p) => p.buzz)),
    meanPeakBuzz: mean(shows.map((s) => s.peakBuzz)),
    pleasedShare: pitches.length > 0 ? pitches.filter((p) => p.pleased).length / pitches.length : 0,
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

/**
 * How each house rule actually performs, against the same show with no rule at
 * all. A condition that halves clearance is a wall, not a wrinkle.
 */
function conditionTable(runs: readonly RunSample[]): string {
  const shows = runs.flatMap((r) => r.shows);
  const byCondition = new Map<string, { ratios: number[]; failed: number }>();

  for (const show of shows) {
    for (const id of show.conditionIds) {
      const row = byCondition.get(id) ?? { ratios: [], failed: 0 };
      row.ratios.push(show.earned / show.quota);
      if (!show.cleared) row.failed++;
      byCondition.set(id, row);
    }
  }

  const plain = shows.filter((s) => s.conditionIds.length === 0);
  const baseline = median(plain.map((s) => s.earned / s.quota));

  const rows = [...byCondition.entries()]
    .map(([id, row]) => ({ id, m: median(row.ratios), n: row.ratios.length, failed: row.failed }))
    .sort((a, b) => a.m - b.m)
    .map(
      (row) =>
        `  ${pad(row.id, 18)} ${padStart(`${row.m.toFixed(2)}x`, 6)}  n=${padStart(String(row.n), 3)}  failed ${padStart(pct(row.n > 0 ? row.failed / row.n : 0), 6)}`,
    );

  return [`  ${pad('(no condition)', 18)} ${padStart(`${baseline.toFixed(2)}x`, 6)}  n=${padStart(String(plain.length), 3)}`, ...rows].join('\n');
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

  const stockByShow = new Map<number, number[]>();
  const cashByShow = new Map<number, number[]>();
  for (const run of runs) {
    for (const show of run.shows) {
      const list = stockByShow.get(show.showIndex) ?? [];
      list.push(show.stockAtStart);
      stockByShow.set(show.showIndex, list);
      const cash = cashByShow.get(show.showIndex) ?? [];
      cash.push(show.bankrollAtStart);
      cashByShow.set(show.showIndex, cash);
    }
  }

  return [...byShow.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([showIndex, ratios]) => {
      const m = median(ratios);
      const stock = median(stockByShow.get(showIndex) ?? []);
      const cash = median(cashByShow.get(showIndex) ?? []);
      return `  show ${padStart(String(showIndex), 2)}  ${padStart(`${m.toFixed(2)}x`, 6)}  n=${padStart(String(ratios.length), 3)}  stock ${padStart(String(Math.round(stock)), 3)}  cash ${padStart(`$${Math.round(cash)}`, 7)}  ${'#'.repeat(Math.min(30, Math.round(m * 10)))}`;
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
    `  best buyer vs. next best buyer (median)     ${pct(s.medianSeatMargin)}`,
    '',
    '-- The crowd --',
    `  buyers served per show                      ${s.servedPerShow.toFixed(2)}`,
    `  buyers who walked                           ${pct(s.walkedShare)}`,
    `  sales that pleased the buyer                ${pct(s.pleasedShare)}`,
    `  Buzz at the average sale                    ${s.meanBuzz.toFixed(2)}`,
    `  peak Buzz in the average show               ${s.meanPeakBuzz.toFixed(2)}`,
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
    '-- House rules --',
    conditionTable(runs),
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
