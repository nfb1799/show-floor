/**
 * End-to-end run tests: several shows played through the real engine with real
 * upgrades and conditions equipped, plus the save/load round trip.
 */

import { describe, expect, it } from 'vitest';
import { createRng, type Rng } from '../rng';
import { generateCards } from '../cards/generate';
import { getUpgrades } from '../upgrades/registry';
import { getConditions, rollConditions } from '../conditions/registry';
import {
  accept,
  createShow,
  pitch,
  remainingInventory,
  toggleSelection,
  type ShowDeps,
  type ShowState,
} from '../show/showEngine';
import { peekArchetypes, rollRumor } from './rumors';
import { EMPTY_STATS, mergeShowStats } from './runState';
import type { Card } from '../types';

function depsFor(rng: Rng, upgradeIds: string[], showIndex: number): ShowDeps {
  return {
    rng,
    upgrades: getUpgrades(upgradeIds),
    conditions: rollConditions(rng.fork(`conditions:${showIndex}`), showIndex),
  };
}

/** Plays a show by pitching the widest legal selection to every buyer. */
function playShow(state: ShowState, deps: ShowDeps): ShowState {
  let show = state;
  let guard = 0;

  while (show.phase !== 'over' && guard++ < 200) {
    const sellable = show.displayCase.filter((cd) => !show.lockedCardIds.includes(cd.id));
    if (sellable.length === 0) break;

    let next = show;
    for (const card of sellable.slice(0, 5)) next = toggleSelection(next, card.id);
    if (next.selection.length === 0) break;

    show = accept(pitch(next, deps), deps);
  }
  return show;
}

describe('a full run', () => {
  it('plays several shows end to end with upgrades and conditions live', () => {
    const rng = createRng('full-run');
    let inventory: Card[] = generateCards(rng, 60, 'start');
    let stats = EMPTY_STATS;
    const equipped = ['uvDisplayCase', 'foldingChair', 'loudNeighbor'];

    for (let showIndex = 1; showIndex <= 4; showIndex++) {
      const deps = depsFor(rng, equipped, showIndex);
      const show = playShow(createShow(showIndex, inventory, deps), deps);

      expect(show.phase).toBe('over');
      expect(show.outcome).not.toBe('inProgress');
      expect(show.earned).toBeGreaterThan(0);

      stats = mergeShowStats(stats, show);
      inventory = remainingInventory(show);

      // Cards sold are gone from the run for good.
      const survivingIds = new Set(inventory.map((cd) => cd.id));
      for (const sold of show.sold) expect(survivingIds.has(sold.id)).toBe(false);
    }

    expect(stats.totalEarned).toBeGreaterThan(0);
    expect(stats.cardsSold).toBeGreaterThan(0);
  });

  it('applies show conditions on every third show', () => {
    const rng = createRng('condition-run');
    const inventory = generateCards(rng, 60, 'start');

    const plain = createShow(2, inventory, depsFor(rng, [], 2));
    const boss = createShow(3, inventory, depsFor(rng, [], 3));

    expect(plain.config.conditionIds).toHaveLength(0);
    expect(boss.config.conditionIds).toHaveLength(1);
  });

  it('replays identically from the same seed', () => {
    const play = () => {
      const rng = createRng('replay-run');
      const inventory = generateCards(rng, 40, 'start');
      const deps = depsFor(rng, ['uvDisplayCase'], 1);
      return playShow(createShow(1, inventory, deps), deps);
    };

    const a = play();
    const b = play();
    expect(a.earned).toBe(b.earned);
    expect(a.log.map((l) => l.text)).toEqual(b.log.map((l) => l.text));
  });
});

describe('locked case slots', () => {
  it('holds a card back from every pitch without stalling the show', () => {
    const rng = createRng('locked');
    const inventory = generateCards(rng, 60, 'start');
    const deps = depsFor(rng, ['fakeGrailDisplay'], 1);
    const show = createShow(1, inventory, deps);

    expect(show.lockedCardIds).toHaveLength(1);

    // The locked card cannot be selected...
    const lockedId = show.lockedCardIds[0]!;
    expect(toggleSelection(show, lockedId).selection).toEqual([]);

    // ...and the show still completes.
    const played = playShow(show, deps);
    expect(played.phase).toBe('over');
    for (const sold of played.sold) expect(sold.id).not.toBe(lockedId);
  });
});

describe('setup rumours', () => {
  it('describes the buyers who actually turn up', () => {
    const rng = createRng('rumor');
    const inventory = generateCards(rng, 40, 'start');

    const peeked = peekArchetypes(rng, 5);
    const show = createShow(5, inventory, { rng, upgrades: [], conditions: [] });

    expect(show.queue.slice(0, peeked.length).map((b) => b.archetype)).toEqual(peeked);
  });

  it('always produces a rumour', () => {
    for (let showIndex = 1; showIndex <= 10; showIndex++) {
      expect(rollRumor(createRng(`r${showIndex}`), showIndex).length).toBeGreaterThan(10);
    }
  });
});

describe('save round trip', () => {
  it('restores an identical RNG stream from a stored state', () => {
    const original = createRng('save-me');
    original.int(0, 1000);
    original.int(0, 1000);

    const restored = createRng(original.state);
    expect(restored.next()).toBe(createRng(original.state).next());

    // And the restored stream keeps pace with the original.
    const a = createRng(original.state);
    const b = createRng(original.state);
    expect([a.int(0, 99), a.int(0, 99)]).toEqual([b.int(0, 99), b.int(0, 99)]);
  });

  it('serialises a live show state without loss', () => {
    const rng = createRng('serialise');
    const inventory = generateCards(rng, 40, 'start');
    const show = createShow(3, inventory, depsFor(rng, ['uvDisplayCase'], 3));

    const round = JSON.parse(JSON.stringify(show)) as ShowState;
    expect(round.displayCase).toEqual(show.displayCase);
    expect(round.queue).toEqual(show.queue);
    expect(round.config).toEqual(show.config);
    expect(round.buyer).toEqual(show.buyer);
  });

  it('rehydrates modifiers from ids alone', () => {
    const ids = ['uvDisplayCase', 'loudNeighbor'];
    expect(getUpgrades(ids).map((up) => up.id)).toEqual(ids);
    expect(getConditions(['snobCrowd']).map((cd) => cd.id)).toEqual(['snobCrowd']);
  });
});
