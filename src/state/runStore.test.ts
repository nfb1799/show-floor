/**
 * Store-level guards.
 *
 * These exist because a playtest softlocked: the shop let the player spend down
 * past the next table fee, and the setup screen then had no legal action — the
 * run could neither start nor end.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useRun } from './runStore';
import { PRICE_GUIDE_MAX } from '../game/constants';
import { tableFeeForShow } from '../game/show/showEngine';

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
