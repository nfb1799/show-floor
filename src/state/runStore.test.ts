/**
 * Store-level guards.
 *
 * These exist because a playtest softlocked: the shop let the player spend down
 * past the next table fee, and the setup screen then had no legal action — the
 * run could neither start nor end.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useRun } from './runStore';
import { PRICE_GUIDE_MAX, SLEEVE_COST } from '../game/constants';
import { planShow, tableFeeForShow } from '../game/show/showEngine';
import { conditionsForShow, getConditions } from '../game/conditions/registry';
import { getUpgrades } from '../game/upgrades/registry';

const run = () => useRun.getState();

/** Puts the run in the shop after show `showIndex` with a known bankroll. */
function enterShop(showIndex: number, bankroll: number): void {
  run().newRun('store-test');
  useRun.setState({ phase: 'shop', showIndex, bankroll });
}

beforeEach(() => {
  run().newRun('store-test');
});

describe('the next table fee is held back', () => {
  it('reserves nothing outside the shop', () => {
    expect(run().phase).toBe('setup');
    expect(run().reservedForFee()).toBe(0);
    expect(run().spendable()).toBe(run().bankroll);
  });

  it('reserves the next fee while shopping', () => {
    enterShop(1, 1000);
    // Show 2's fee, not show 1's.
    expect(run().reservedForFee()).toBe(tableFeeForShow(2));
    expect(run().spendable()).toBe(1000 - tableFeeForShow(2));
  });

  it('refuses a purchase that would eat the reserve', () => {
    enterShop(1, 1000);
    const fee = tableFeeForShow(2);
    const before = run().bankroll;

    // Affordable against bankroll, but not against spendable.
    useRun.setState({ bankroll: fee + 10 });
    run().buyPack('hobby');

    expect(run().bankroll).toBe(fee + 10);
    expect(before).toBe(1000);
  });

  it('allows a purchase that leaves the reserve intact', () => {
    enterShop(1, 1000);
    run().buyPack('bulkLot');
    expect(run().bankroll).toBeLessThan(1000);
    expect(run().bankroll).toBeGreaterThanOrEqual(run().reservedForFee());
  });

  it('never lets the shop drop the bankroll under the next fee', () => {
    enterShop(1, 400);
    // Buy everything buyable, repeatedly.
    for (let i = 0; i < 30; i++) {
      run().buyPack('bulkLot');
      run().buyPack('retail');
      run().buyPriceGuide();
      run().rerollShop();
      run().buyCase();
      run().buyTable();
      for (const single of run().shop?.singles ?? []) run().buySingle(single.card.id);
      for (const upgrade of run().shop?.upgrades ?? []) run().buyUpgrade(upgrade.id);
    }
    expect(run().bankroll).toBeGreaterThanOrEqual(tableFeeForShow(2));
  });
});

describe('the run can always end', () => {
  it('ends the run when the table fee cannot be covered', () => {
    // The branch that does this was previously unreachable, because the setup
    // screen disabled the only button that calls startShow().
    useRun.setState({ phase: 'setup', showIndex: 4, bankroll: 0 });
    run().startShow();

    expect(run().phase).toBe('runOver');
    expect(run().runOverReason).toMatch(/table fee/i);
  });

  it('ends the run when there is nothing left to sell', () => {
    useRun.setState({ phase: 'setup', showIndex: 1, bankroll: 5000, inventory: [] });
    run().startShow();

    expect(run().phase).toBe('runOver');
    expect(run().runOverReason).toMatch(/nothing left/i);
  });
});

describe('price guides', () => {
  it('stops at the cap rather than selling unlimited copies', () => {
    enterShop(1, 5000);
    for (let i = 0; i < 6; i++) run().buyPriceGuide();
    expect(run().priceGuides).toBe(PRICE_GUIDE_MAX);
  });

  it('charges nothing once the cap is reached', () => {
    enterShop(1, 5000);
    run().buyPriceGuide();
    const afterFirst = run().bankroll;
    run().buyPriceGuide();
    expect(run().bankroll).toBe(afterFirst);
  });

  it('is consumed by the show it was bought for', () => {
    enterShop(1, 5000);
    run().buyPriceGuide();
    expect(run().priceGuides).toBe(1);

    run().leaveShop();
    expect(run().revealBuyerMix).toBe(true);
    expect(run().priceGuides).toBe(0);
  });
});

describe('the reserve survives a house rule that moves the fee', () => {
  it('holds back the tripled fee, not the base one', () => {
    // Convention Center triples the table fee. Find a seed where the next show
    // draws it, then check the shop reserves the real number.
    const seed = (() => {
      for (let i = 0; i < 200; i++) {
        const candidate = `fee-${i}`;
        if (conditionsForShow(candidate, 3).some((c) => c.id === 'conventionCenter')) {
          return candidate;
        }
      }
      throw new Error('no seed drew Convention Center');
    })();

    run().newRun(seed);
    useRun.setState({ phase: 'shop', showIndex: 2, bankroll: 5000 });

    expect(run().nextShowConditionIds()).toContain('conventionCenter');
    expect(run().reservedForFee()).toBe(tableFeeForShow(3) * 3);
  });

  it('never lets the shop spend below a fee the next show will actually charge', () => {
    // The old bug: conditions were forked off the live RNG, so spending in the
    // shop changed which conditions the prediction saw. Buying things must not
    // move the reserve.
    for (let i = 0; i < 24; i++) {
      const seed = `drift-${i}`;
      run().newRun(seed);
      useRun.setState({ phase: 'shop', showIndex: 2, bankroll: 4000 });

      const predicted = run().reservedForFee();
      for (let n = 0; n < 8; n++) {
        run().buyPack('bulkLot');
        run().resolvePack([]);
        run().rerollShop();
      }
      expect(run().reservedForFee(), seed).toBe(predicted);

      run().leaveShop();
      const actual = planShow(3, run().inventory.length, {
        rng: run().rng,
        upgrades: getUpgrades(run().equippedUpgradeIds),
        conditions: getConditions(run().conditionIds),
        extraCaseSlots: run().casesBought,
      }).tableFee;

      expect(actual, seed).toBe(predicted);
      expect(run().bankroll, seed).toBeGreaterThanOrEqual(actual);
    }
  });
});

describe('sleeving', () => {
  /** Puts one raw card of a known condition in stock, in the shop. */
  function stockOne(condition: 'played' | 'nearMint' | 'mint') {
    enterShop(1, 4000);
    const card = run().inventory.find((c) => !c.slabbed)!;
    useRun.setState({ inventory: [{ ...card, slabbed: false, condition }] });
    return run().inventory[0]!.id;
  }

  it('charges by the step it buys, not a flat fee', () => {
    const id = stockOne('played');
    const before = run().bankroll;
    run().sleeveCard(id);

    expect(run().bankroll).toBe(before - SLEEVE_COST.played!);
    expect(run().inventory[0]).toMatchObject({ condition: 'lightlyPlayed' });
  });

  it('charges more at the top of the ladder than the bottom', () => {
    expect(SLEEVE_COST.nearMint!).toBeGreaterThan(SLEEVE_COST.played!);
  });

  it('refuses a Mint card rather than charging for nothing', () => {
    const id = stockOne('mint');
    const before = run().bankroll;
    run().sleeveCard(id);

    expect(run().bankroll).toBe(before);
    expect(run().inventory[0]).toMatchObject({ condition: 'mint' });
  });
});

describe('equipping gear', () => {
  it('swaps the oldest piece out when the booth is full', () => {
    const slots = run().upgradeSlots();
    const owned = ['uvDisplayCase', 'pennySleeves', 'toploaderStack', 'halfPriceBin'];
    useRun.setState({
      ownedUpgradeIds: owned,
      equippedUpgradeIds: owned.slice(0, slots),
    });

    const bumped = run().equippedUpgradeIds[slots - 1]!;
    const benched = owned.find((id) => !run().equippedUpgradeIds.includes(id))!;
    run().equip(benched);

    expect(run().equippedUpgradeIds).toHaveLength(slots);
    expect(run().equippedUpgradeIds[0]).toBe(benched);
    expect(run().equippedUpgradeIds).not.toContain(bumped);
  });

  it('just adds when there is room', () => {
    useRun.setState({ ownedUpgradeIds: ['uvDisplayCase'], equippedUpgradeIds: [] });
    run().equip('uvDisplayCase');
    expect(run().equippedUpgradeIds).toEqual(['uvDisplayCase']);
  });
});
