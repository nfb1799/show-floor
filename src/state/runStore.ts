/**
 * Zustand shell over the pure game layer. Every transition delegates to the
 * game modules; nothing here computes a number the game layer could compute.
 */

import { create } from 'zustand';
import {
  CONDITION_ORDER,
  DISPLAY_CASE_SIZE,
  PRICE_GUIDE_MAX,
  STARTING_BANKROLL,
  STARTING_INVENTORY_SIZE,
  SLEEVE_COST,
  PRICE_GUIDE_COST,
} from '../game/constants';
import { conditionRank } from '../game/cards/value';
import { generateCards } from '../game/cards/generate';
import { createRng, type Rng } from '../game/rng';
import { conditionsForShow, getConditions } from '../game/conditions/registry';
import { getUpgrade, getUpgrades } from '../game/upgrades/registry';
import { gradeCard, gradingFee } from '../game/shop/grading';
import {
  getPackTier,
  markSingleSold,
  markUpgradePurchased,
  nextCaseCost,
  nextTableCost,
  openPack,
  onlineValue,
  onlineValueOf,
  openShop,
  rerollCost,
  rerollSingles,
  upgradeSlotsFor,
  type ShopStock,
} from '../game/shop/shop';
import { collectionModifiers } from '../game/run/collection';
import { rollRumor } from '../game/run/rumors';
import {
  EMPTY_STATS,
  mergeShowStats,
  type RunSnapshot,
  type RunStats,
} from '../game/run/runState';
import { clearRun, loadRun, recordBest, saveRun } from '../game/run/persistence';
import {
  walkthroughShow,
  WALKTHROUGH_BANKROLL,
  WALKTHROUGH_SEED,
} from '../game/run/walkthrough';
import type { Card, PitchResult, RawCard } from '../game/types';
import {
  createShow,
  digFromStock,
  planShow,
  previewPitch,
  pitch as enginePitch,
  remainingInventory,
  toggleSelection,
  turnAway as engineTurnAway,
  type ShowDeps,
  type ShowState,
} from '../game/show/showEngine';

export interface RunState extends Omit<RunSnapshot, 'rngState'> {
  rng: Rng;
  /** Revealed by a Price Guide bought at the previous shop. */
  revealBuyerMix: boolean;
  /** The card that just came back from grading, for the reveal. */
  lastGraded: { before: Card; after: Card } | null;
  /** True while the scripted walkthrough is driving the run. Never saved. */
  walkthrough: boolean;

  newRun: (seed?: string) => void;
  resume: () => boolean;
  abandonRun: () => void;
  /** Installs the scripted show the walkthrough teaches on. */
  startWalkthrough: () => void;
  endWalkthrough: () => void;

  equip: (upgradeId: string) => void;
  unequip: (upgradeId: string) => void;
  startShow: () => void;

  toggleCard: (cardId: string) => void;
  /** Sells the current selection to the buyer at the table. */
  pitch: () => void;
  turnAway: () => void;
  /** Swap a case card for a named card from stock, for a goodwill pip. */
  dig: (outCardId: string, inCardId: string) => void;
  preview: () => PitchResult | null;

  collectShow: () => void;
  leaveShop: () => void;

  buySingle: (cardId: string) => void;
  rerollShop: () => void;
  buyPack: (tierId: string) => void;
  /** Keeps the named cards, lists the rest online. */
  resolvePack: (keepIds: readonly string[]) => void;
  sellOnline: (cardId: string) => void;
  dismissGraded: () => void;
  buyUpgrade: (upgradeId: string) => void;
  submitForGrading: (cardId: string) => void;
  sleeveCard: (cardId: string) => void;
  buyPriceGuide: () => void;
  buyTable: () => void;
  buyCase: () => void;

  upgradeSlots: () => number;
  caseSize: () => number;
  /** The equipped modifiers, for UI that needs to run a pure engine preview. */
  showDeps: () => ShowDeps;
  /** Table fee for the *next* show, held back from shop spending. */
  reservedForFee: () => number;
  /** Bankroll minus the reserve. What the shop may actually take. */
  spendable: () => number;
  /** House rules the next show will impose, knowable while still shopping. */
  nextShowConditionIds: () => readonly string[];
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

let packSeq = 0;

export const useRun = create<RunState>((set, get) => {
  /** Everything the player owns right now, wherever it currently sits. */
  const collection = (): Card[] => {
    const { inventory, show } = get();
    return show ? [...show.inventory, ...show.displayCase] : [...inventory];
  };

  const deps = (): ShowDeps => {
    const { rng, equippedUpgradeIds, conditionIds, casesBought } = get();
    return {
      rng,
      // Collection depth rides the same hook as any upgrade, so scoring needs
      // no concept of a collection at all.
      upgrades: [...getUpgrades(equippedUpgradeIds), ...collectionModifiers(collection())],
      conditions: getConditions(conditionIds),
      extraCaseSlots: casesBought,
    };
  };

  const snapshot = (): RunSnapshot => {
    const s = get();
    return {
      seed: s.seed,
      rngState: s.rng.state,
      bankroll: s.bankroll,
      inventory: s.inventory,
      ownedUpgradeIds: s.ownedUpgradeIds,
      equippedUpgradeIds: s.equippedUpgradeIds,
      tableTier: s.tableTier,
      casesBought: s.casesBought,
      priceGuides: s.priceGuides,
      showIndex: s.showIndex,
      conditionIds: s.conditionIds,
      rumor: s.rumor,
      show: s.show,
      shop: s.shop,
      pendingPack: s.pendingPack,
      phase: s.phase,
      runOverReason: s.runOverReason,
      stats: s.stats,
    };
  };

  const persist = (): void => {
    const s = get();
    if (s.phase === 'title') return;
    // The walkthrough is a sandbox. Saving it would overwrite a real run, and
    // its scripted cards would then be loose in the player's stock.
    if (s.walkthrough) return;
    saveRun(snapshot());
  };

  /** Applies an engine transition and syncs the derived run phase. */
  const applyShow = (fn: (state: ShowState, d: ShowDeps) => ShowState): void => {
    const { show } = get();
    if (!show) return;
    const next = fn(show, deps());
    set({ show: next, phase: next.phase === 'over' ? 'showResult' : 'inShow' });
    persist();
  };

  /**
   * Shop spending is capped at `spendable`, not `bankroll`, so the player can
   * never buy their way out of affording the next table fee. Without this it is
   * possible to leave the shop unable to open the next show — and the setup
   * screen then has no legal action at all.
   */
  const spend = (amount: number): boolean => {
    const { bankroll } = get();
    if (get().spendable() < amount) return false;
    set({ bankroll: bankroll - amount });
    return true;
  };

  const bumpStats = (fn: (s: RunStats) => RunStats): void => {
    set({ stats: fn(get().stats) });
  };

  /** Moves to the setup phase for `showIndex`, rolling conditions and a rumour. */
  const enterSetup = (showIndex: number): void => {
    const { rng, seed } = get();
    const conditions = conditionsForShow(seed, showIndex);
    set({
      showIndex,
      conditionIds: conditions.map((c) => c.id),
      rumor: rollRumor(rng, showIndex),
      show: null,
      shop: null,
      phase: 'setup',
    });
    persist();
  };

  return {
    seed: '',
    rng: createRng('unstarted'),
    bankroll: STARTING_BANKROLL,
    inventory: [],
    ownedUpgradeIds: [],
    equippedUpgradeIds: [],
    tableTier: 0,
    casesBought: 0,
    priceGuides: 0,
    showIndex: 1,
    conditionIds: [],
    rumor: '',
    show: null,
    shop: null,
    pendingPack: null,
    phase: 'title',
    runOverReason: null,
    stats: EMPTY_STATS,
    revealBuyerMix: false,
    lastGraded: null,
    walkthrough: false,

    // -- Run lifecycle ------------------------------------------------------

    newRun: (seed) => {
      const runSeed = seed ?? randomSeed();
      const rng = createRng(runSeed);
      set({
        seed: runSeed,
        rng,
        bankroll: STARTING_BANKROLL,
        inventory: generateCards(rng, STARTING_INVENTORY_SIZE, 'start'),
        ownedUpgradeIds: [],
        equippedUpgradeIds: [],
        tableTier: 0,
        casesBought: 0,
        priceGuides: 0,
        showIndex: 1,
        conditionIds: [],
        rumor: '',
        show: null,
        shop: null,
        pendingPack: null,
        phase: 'setup',
        runOverReason: null,
        stats: EMPTY_STATS,
        revealBuyerMix: false,
        lastGraded: null,
        walkthrough: false,
      });
      enterSetup(1);
    },

    startWalkthrough: () => {
      const rng = createRng(WALKTHROUGH_SEED);
      set({
        seed: WALKTHROUGH_SEED,
        rng,
        bankroll: WALKTHROUGH_BANKROLL,
        inventory: [],
        ownedUpgradeIds: [],
        equippedUpgradeIds: [],
        tableTier: 0,
        casesBought: 0,
        priceGuides: 0,
        showIndex: 1,
        conditionIds: [],
        rumor: '',
        shop: null,
        pendingPack: null,
        runOverReason: null,
        stats: EMPTY_STATS,
        revealBuyerMix: false,
        lastGraded: null,
        walkthrough: true,
        show: walkthroughShow({ rng, upgrades: [], conditions: [] }),
        phase: 'inShow',
      });
    },

    /** Drops the sandbox without touching whatever real run is on disk. */
    endWalkthrough: () => {
      set({
        walkthrough: false,
        phase: 'title',
        seed: '',
        show: null,
        shop: null,
        pendingPack: null,
        lastGraded: null,
      });
    },

    resume: () => {
      const saved = loadRun();
      if (!saved) return false;
      const { rngState, ...rest } = saved;
      set({
        ...rest,
        rng: createRng(rngState),
        revealBuyerMix: false,
        lastGraded: null,
        walkthrough: false,
      });
      return true;
    },

    abandonRun: () => {
      clearRun();
      set({ phase: 'title', seed: '', show: null, shop: null });
    },

    // -- Setup --------------------------------------------------------------

    equip: (upgradeId) => {
      const { equippedUpgradeIds, ownedUpgradeIds } = get();
      if (!ownedUpgradeIds.includes(upgradeId)) return;
      if (equippedUpgradeIds.includes(upgradeId)) return;

      // A full booth swaps instead of refusing: the new piece goes on the front
      // and the oldest falls off the end, so equipping is one click rather than
      // unequip-then-equip.
      const slots = get().upgradeSlots();
      const kept =
        equippedUpgradeIds.length >= slots
          ? equippedUpgradeIds.slice(0, Math.max(0, slots - 1))
          : equippedUpgradeIds;
      set({ equippedUpgradeIds: [upgradeId, ...kept] });
      persist();
    },

    unequip: (upgradeId) => {
      set({
        equippedUpgradeIds: get().equippedUpgradeIds.filter((id) => id !== upgradeId),
      });
      persist();
    },

    startShow: () => {
      const { bankroll, inventory, showIndex } = get();
      const d = deps();

      // Upgrades and conditions can move the fee, so it has to be resolved
      // before we know what the player owes. planShow does that without
      // drawing, so the RNG is untouched if they cannot afford it.
      const fee = planShow(showIndex, inventory.length, d).tableFee;

      if (bankroll < fee) {
        set({
          phase: 'runOver',
          runOverReason: `You could not cover the $${fee} table fee.`,
        });
        persist();
        return;
      }
      if (inventory.length === 0) {
        set({ phase: 'runOver', runOverReason: 'Nothing left to sell.' });
        persist();
        return;
      }

      set({
        bankroll: bankroll - fee,
        inventory: [],
        show: createShow(showIndex, inventory, d),
        phase: 'inShow',
        revealBuyerMix: false,
      });
      persist();
    },

    // -- In show ------------------------------------------------------------

    toggleCard: (cardId) => applyShow((s) => toggleSelection(s, cardId)),
    pitch: () => applyShow(enginePitch),
    turnAway: () => applyShow(engineTurnAway),
    dig: (outCardId, inCardId) => applyShow((st) => digFromStock(st, outCardId, inCardId)),

    preview: () => {
      const { show } = get();
      return show ? previewPitch(show, deps()) : null;
    },

    collectShow: () => {
      const { show, bankroll, showIndex, stats, rng, ownedUpgradeIds, seed } = get();
      if (!show || show.phase !== 'over') return;

      const nextStats = mergeShowStats(stats, show);

      if (show.outcome === 'failed') {
        recordBest({
          showsCleared: nextStats.showsCleared,
          totalEarned: nextStats.totalEarned,
          seed,
        });
        set({
          bankroll: bankroll + show.earned,
          inventory: remainingInventory(show),
          stats: nextStats,
          phase: 'runOver',
          runOverReason: `You brought in $${Math.round(show.earned)} against a $${show.config.quota} quota.`,
        });
        persist();
        return;
      }

      set({
        bankroll: bankroll + show.earned,
        inventory: remainingInventory(show),
        stats: nextStats,
        shop: openShop(rng, showIndex, ownedUpgradeIds),
        show,
        phase: 'shop',
      });
      persist();
    },

    leaveShop: () => {
      const { showIndex, priceGuides } = get();
      set({ revealBuyerMix: priceGuides > 0, priceGuides: Math.max(0, priceGuides - 1) });
      enterSetup(showIndex + 1);
    },

    // -- Shop ---------------------------------------------------------------

    buySingle: (cardId) => {
      const { shop, inventory } = get();
      if (!shop) return;
      const single = shop.singles.find((s) => s.card.id === cardId);
      if (!single || single.sold) return;
      if (!spend(single.price)) return;

      set({
        inventory: [...inventory, single.card],
        shop: markSingleSold(shop, cardId),
      });
      bumpStats((s) => ({ ...s, cardsBought: s.cardsBought + 1 }));
      persist();
    },

    rerollShop: () => {
      const { shop, rng } = get();
      if (!shop) return;
      if (!spend(rerollCost(shop))) return;
      set({ shop: rerollSingles(shop, rng) });
      persist();
    },

    buyPack: (tierId) => {
      const { rng } = get();
      const tier = getPackTier(tierId);
      if (get().pendingPack) return; // one pack open at a time
      if (!spend(tier.cost)) return;

      packSeq += 1;
      // Staged, not banked: the player sorts the pull before it hits stock.
      set({ pendingPack: { tierName: tier.name, cards: openPack(tier, rng, `pack${packSeq}`) } });
      bumpStats((s) => ({ ...s, packsOpened: s.packsOpened + 1 }));
      persist();
    },

    resolvePack: (keepIds) => {
      const { pendingPack, inventory, bankroll } = get();
      if (!pendingPack) return;

      const kept = pendingPack.cards.filter((c) => keepIds.includes(c.id));
      const listed = pendingPack.cards.filter((c) => !keepIds.includes(c.id));

      set({
        inventory: [...inventory, ...kept],
        bankroll: bankroll + onlineValueOf(listed),
        pendingPack: null,
      });
      bumpStats((s) => ({ ...s, cardsBought: s.cardsBought + kept.length }));
      persist();
    },

    sellOnline: (cardId) => {
      const { inventory, bankroll } = get();
      const card = inventory.find((c) => c.id === cardId);
      if (!card) return;

      set({
        inventory: inventory.filter((c) => c.id !== cardId),
        bankroll: bankroll + onlineValue(card),
      });
      persist();
    },

    dismissGraded: () => set({ lastGraded: null }),

    buyUpgrade: (upgradeId) => {
      const { shop, ownedUpgradeIds, equippedUpgradeIds } = get();
      if (!shop || ownedUpgradeIds.includes(upgradeId)) return;
      const def = getUpgrade(upgradeId);
      if (!spend(def.cost)) return;

      const owned = [...ownedUpgradeIds, upgradeId];
      // Auto-equip while there is room; otherwise it waits in the owned pool.
      const equipped =
        equippedUpgradeIds.length < get().upgradeSlots()
          ? [...equippedUpgradeIds, upgradeId]
          : equippedUpgradeIds;

      set({
        ownedUpgradeIds: owned,
        equippedUpgradeIds: equipped,
        shop: markUpgradePurchased(shop, upgradeId),
      });
      bumpStats((s) => ({ ...s, upgradesBought: s.upgradesBought + 1 }));
      persist();
    },

    submitForGrading: (cardId) => {
      const { inventory, rng } = get();
      const card = inventory.find((c) => c.id === cardId);
      if (!card || card.slabbed) return;
      if (!spend(gradingFee(card))) return;

      const slab = gradeCard(card, rng);
      set({
        inventory: inventory.map((c) => (c.id === cardId ? slab : c)),
        lastGraded: { before: card, after: slab },
      });
      bumpStats((s) => ({ ...s, cardsGraded: s.cardsGraded + 1 }));
      persist();
    },

    sleeveCard: (cardId) => {
      const { inventory } = get();
      const card = inventory.find((c) => c.id === cardId);
      if (!card || card.slabbed) return;

      const cost = SLEEVE_COST[card.condition];
      const next = CONDITION_ORDER[conditionRank(card.condition) + 1];
      // Mint has no step above it, so it has no price either.
      if (cost === undefined || next === undefined) return;
      if (!spend(cost)) return;

      const updated: RawCard = { ...card, condition: next };
      set({ inventory: inventory.map((c) => (c.id === cardId ? updated : c)) });
      persist();
    },

    buyPriceGuide: () => {
      // One is spent per show, so stockpiling them did nothing but drain money.
      if (get().priceGuides >= PRICE_GUIDE_MAX) return;
      if (!spend(PRICE_GUIDE_COST)) return;
      set({ priceGuides: get().priceGuides + 1 });
      persist();
    },

    buyTable: () => {
      const { tableTier } = get();
      const cost = nextTableCost(tableTier);
      if (cost === null || !spend(cost)) return;
      set({ tableTier: tableTier + 1 });
      persist();
    },

    buyCase: () => {
      const { casesBought } = get();
      const cost = nextCaseCost(casesBought);
      if (cost === null || !spend(cost)) return;
      set({ casesBought: casesBought + 1 });
      persist();
    },

    // -- Derived ------------------------------------------------------------

    upgradeSlots: () => upgradeSlotsFor(get().tableTier),
    caseSize: () => DISPLAY_CASE_SIZE + get().casesBought,
    showDeps: deps,

    reservedForFee: () => {
      const { rng, seed, equippedUpgradeIds, casesBought, inventory, showIndex, phase } = get();
      // Only the shop holds money back; during a show the fee is already paid.
      if (phase !== 'shop') return 0;

      const next = showIndex + 1;
      // Conditions come from a pure fork, so next show's fee — including a
      // tripled Convention Center or a halved Promoter's Nephew — is knowable
      // here without advancing the run's stream.
      return planShow(next, inventory.length, {
        rng,
        upgrades: getUpgrades(equippedUpgradeIds),
        conditions: conditionsForShow(seed, next),
        extraCaseSlots: casesBought,
      }).tableFee;
    },

    spendable: () => Math.max(0, get().bankroll - get().reservedForFee()),

    nextShowConditionIds: () => {
      const { seed, showIndex, phase } = get();
      if (phase !== 'shop') return [];
      return conditionsForShow(seed, showIndex + 1).map((c) => c.id);
    },
  };
});

export type { ShopStock };
