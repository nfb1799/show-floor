import { describe, expect, it } from 'vitest';
import {
  ALL_CONDITIONS,
  conditionCountForShow,
  getCondition,
  isConditionShow,
  rollConditions,
} from './registry';
import { resolvePitch } from '../pitch/resolvePitch';
import { runShowEndHooks } from '../pitch/hooks';
import { createShow, planShow } from '../show/showEngine';
import { generateCards } from '../cards/generate';
import { createRng } from '../rng';
import { buyer, franchiseSpread, raw, slab } from '../testing/factories';
import { DISPLAY_CASE_SIZE } from '../constants';
import type { Buyer, Card, Modifier, RawCard } from '../types';

function score(cards: Card[], conditions: Modifier[], b: Buyer = buyer()) {
  return resolvePitch({
    cards,
    buyer: b,
    upgrades: [],
    conditions,
    rng: createRng('condition-test'),
  });
}

const c = (id: string) => getCondition(id);

describe('the condition pool', () => {
  it('ships the ten conditions from the design doc', () => {
    expect(ALL_CONDITIONS).toHaveLength(10);
    const ids = ALL_CONDITIONS.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const cond of ALL_CONDITIONS) {
      expect(cond.kind).toBe('condition');
      expect(cond.text.length, cond.id).toBeGreaterThan(10);
      expect(Object.keys(cond.hooks).length, `${cond.id} registers no hooks`).toBeGreaterThan(0);
    }
  });
});

describe('scheduling', () => {
  it('applies a condition every third show', () => {
    expect(isConditionShow(1)).toBe(false);
    expect(isConditionShow(3)).toBe(true);
    expect(isConditionShow(6)).toBe(true);
    expect(isConditionShow(7)).toBe(false);
  });

  it('stacks two conditions in the late run', () => {
    expect(conditionCountForShow(3)).toBe(1);
    expect(conditionCountForShow(6)).toBe(1);
    expect(conditionCountForShow(9)).toBe(2);
    expect(conditionCountForShow(12)).toBe(2);
    expect(conditionCountForShow(10)).toBe(0); // not a condition show
  });

  it('never draws a condition before its minimum show', () => {
    for (let showIndex = 3; showIndex <= 30; showIndex += 3) {
      for (const rolled of rollConditions(createRng(`roll-${showIndex}`), showIndex)) {
        expect(rolled.minShow, `${rolled.id} at show ${showIndex}`).toBeLessThanOrEqual(showIndex);
      }
    }
  });

  it('does not draw the same condition twice in one show', () => {
    const rolled = rollConditions(createRng('stack'), 12);
    expect(rolled).toHaveLength(2);
    expect(rolled[0]!.id).not.toBe(rolled[1]!.id);
  });
});

describe('scoring conditions', () => {
  it('Snob Crowd halves interest on any pitch holding a raw card', () => {
    const rawCards = [raw({ rarity: 'rare' })];
    const slabs = [slab({ rarity: 'rare', grade: 9 })];

    expect(score(rawCards, [c('snobCrowd')]).interest).toBe(score(rawCards, []).interest * 0.5);
    expect(score(slabs, [c('snobCrowd')]).interest).toBe(score(slabs, []).interest);
  });

  it('No Bulk Bins zeroes small pitches and leaves big ones alone', () => {
    const two = [raw({ subject: 'A', rarity: 'rare' }), raw({ subject: 'B', rarity: 'rare' })];
    const four = franchiseSpread('grimoire', ['A', 'B', 'C', 'D'], { rarity: 'rare' });

    expect(score(two, [c('noBulkBins')]).offer).toBe(0);
    expect(score(four, [c('noBulkBins')]).offer).toBeGreaterThan(0);
  });

  it('Grail Hunters halves a pitch that misses the named card', () => {
    const cards = franchiseSpread('grimoire', ['A', 'B', 'C'], { rarity: 'rare' });
    const withGrail = buyer({ chaseCard: 'A' });
    const without = buyer({ chaseCard: 'Z' });

    expect(score(cards, [c('grailHunters')], withGrail).interest).toBe(
      score(cards, [], withGrail).interest,
    );
    expect(score(cards, [c('grailHunters')], without).interest).toBe(
      score(cards, [], without).interest * 0.5,
    );
  });
});

describe('show-shape conditions', () => {
  const deps = (conditionIds: string[]) => ({
    rng: createRng('cond-show'),
    upgrades: [],
    conditions: conditionIds.map(c),
  });

  it('Slow Saturday removes a buyer', () => {
    expect(planShow(3, 40, deps(['slowSaturday'])).buyerCount).toBe(
      planShow(3, 40, deps([])).buyerCount - 1,
    );
  });

  it('Convention Center triples the table fee', () => {
    expect(planShow(3, 40, deps(['conventionCenter'])).tableFee).toBe(
      planShow(3, 40, deps([])).tableFee * 3,
    );
  });

  it('Case Inspection cuts the case to five slots', () => {
    expect(planShow(3, 40, deps(['caseInspection'])).caseSize).toBe(DISPLAY_CASE_SIZE - 3);
  });

  it('Undercutter starts the haggle lower', () => {
    expect(planShow(3, 40, deps(['undercutter'])).startingOfferRatio).toBeCloseTo(0.5);
  });

  it('Impatient Floor squeezes the show-wide goodwill pool', () => {
    const show = createShow(3, generateCards(createRng('inv'), 30, 'inv'), deps(['impatientFloor']));
    expect(show.config.goodwill).toBe(2);
    expect(show.goodwill).toBe(2);
  });
});

describe('Damp Hall', () => {
  function closeDoorsOn(cards: Card[]) {
    return runShowEndHooks([c('dampHall')], {
      showIndex: 9,
      rng: createRng('damp'),
      unsoldCase: cards,
    });
  }

  it('drops unsold raw cards one condition step', () => {
    const card = raw({ id: 'damp-1', rarity: 'rare', condition: 'nearMint' });
    const replacement = closeDoorsOn([card]).replacements.get('damp-1');

    expect(replacement).toBeDefined();
    expect(replacement!.slabbed).toBe(false);
    expect((replacement as RawCard).condition).toBe('lightlyPlayed');
  });

  it('leaves slabs alone', () => {
    const card = slab({ id: 'damp-slab', rarity: 'rare', grade: 9 });
    expect(closeDoorsOn([card]).replacements.has('damp-slab')).toBe(false);
  });

  it('cannot push a card below the worst condition', () => {
    const card = raw({ id: 'damp-worst', rarity: 'rare', condition: 'played' });
    expect(closeDoorsOn([card]).replacements.has('damp-worst')).toBe(false);
  });

  it('spends a toploader instead of taking the condition step', () => {
    const card: RawCard = {
      ...raw({ id: 'damp-top', rarity: 'rare', condition: 'nearMint' }),
      toploaded: true,
    };
    const replacement = closeDoorsOn([card]).replacements.get('damp-top') as RawCard;

    expect(replacement.condition).toBe('nearMint');
    expect(replacement.toploaded).toBe(false);
  });
});
