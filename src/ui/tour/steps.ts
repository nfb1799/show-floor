/**
 * The walkthrough script.
 *
 * One or two short sentences per step. The spotlight is doing the pointing, so
 * the words only have to say the thing the player cannot see for themselves —
 * anything longer and it stops being a walkthrough and starts being a manual.
 *
 * A step ends by itself when the game reaches the state it asked for: `until`
 * reads the run, `untilAnchor` waits for something to appear on screen (an
 * overlay opening), `untilGone` waits for it to close. Steps with none of those
 * advance on NEXT, and block the screen while they explain.
 */

import { W } from '../../game/run/walkthrough';
import type { RunState } from '../../state/runStore';

export interface TourStep {
  readonly id: string;
  /** `data-tour` value to spotlight. Omitted for centred, screen-wide beats. */
  readonly anchor?: string;
  readonly title: string;
  readonly text: string;
  /** Shown as the prompt when the player has to act. */
  readonly action?: string;
  /** Done when this reads true of the run. */
  readonly until?: (s: RunState) => boolean;
  /** Done when this anchor appears — an overlay opening. */
  readonly untilAnchor?: string;
  /** Done when this anchor disappears — an overlay closing. */
  readonly untilGone?: string;
}

const sel = (s: RunState): readonly string[] => s.show?.selection ?? [];
const has = (s: RunState, id: string): boolean => sel(s).includes(id);
const inCase = (s: RunState, id: string): boolean =>
  (s.show?.displayCase ?? []).some((c) => c.id === id);

export const TOUR_STEPS: readonly TourStep[] = [
  // -- Buyer one: pitch types and the budget cap ----------------------------
  {
    id: 'welcome',
    title: 'Your table, mid-show',
    text: 'A short show — three buyers. Everything here is the real game.',
  },
  {
    id: 'quota',
    anchor: 'quota',
    title: 'The number that ends runs',
    text: 'Clear the quota by closing time or the run is over.',
  },
  {
    id: 'buyer',
    anchor: 'buyer',
    title: 'Who is at your table',
    text: 'Buyers come one at a time, and there are only ever a handful.',
  },
  {
    id: 'budget',
    anchor: 'budget',
    title: 'What they brought',
    text: 'A hard ceiling. No pitch gets a dollar more than this.',
  },
  {
    id: 'wants',
    anchor: 'wants',
    title: 'What wins them',
    text: 'This one collects Grimoire. Every Grimoire card in the pitch adds Interest.',
  },
  {
    id: 'case',
    anchor: 'case',
    title: 'Your display case',
    text: 'Eight cards. You can pitch up to five of them at once.',
  },
  {
    id: 'pickOne',
    anchor: `card:${W.lich}`,
    title: 'Start with one card',
    text: 'Ashen Lich is Grimoire — exactly what they collect.',
    action: 'Click Ashen Lich',
    until: (s) => has(s, W.lich),
  },
  {
    id: 'math',
    anchor: 'math',
    title: 'How the offer is built',
    text: 'Pitch value plus card value, times Interest. One card is the weakest pitch there is.',
  },
  {
    id: 'pickTwo',
    anchor: `card:${W.golem}`,
    title: 'Now add a second',
    text: 'Two cards sharing a franchise make a Pair. Watch the offer.',
    action: 'Click Rune Golem',
    until: (s) => has(s, W.golem),
  },
  {
    id: 'jumped',
    anchor: 'pay',
    title: '$59 to $210',
    text: 'Cards that go together are worth far more than the same cards sold loose.',
  },
  {
    id: 'capped',
    anchor: 'budget',
    title: 'And the wallet bites',
    text: 'The pitch is worth more than they can pay, so the rest is wasted. Sell now.',
  },
  {
    id: 'send',
    anchor: 'send',
    title: 'Sell it',
    text: 'No haggling — the price you see is the price you get.',
    action: 'Click SELL',
    until: (s) => s.show?.queueIndex === 1,
  },

  // -- Buyer two: condition, slabs and refusals -----------------------------
  {
    id: 'sold',
    anchor: 'quota',
    title: 'Banked',
    text: 'Sold cards leave the run for good, and the case refilled from your stock.',
  },
  {
    id: 'grader',
    anchor: 'wants',
    title: 'A grader',
    text: 'Green is what they pay for: raw cards, Near Mint or better. Red is what they refuse.',
  },
  {
    id: 'conditions',
    anchor: `card:${W.ruiz}`,
    title: 'Condition, corner stamp',
    text: 'PL, LP, NM, MINT. Condition multiplies price — Played pays 0.4x, Mint 1.3x.',
  },
  {
    id: 'pickClean',
    anchor: `card:${W.dell}`,
    title: 'Give them a clean one',
    text: 'Marcus Dell is raw and Near Mint, so he counts.',
    action: 'Click Marcus Dell',
    until: (s) => has(s, W.dell),
  },
  {
    id: 'pickClean2',
    anchor: `card:${W.vance}`,
    title: 'And a second',
    text: 'Tyrone Vance, also Near Mint.',
    action: 'Click Tyrone Vance',
    until: (s) => has(s, W.vance),
  },
  {
    id: 'trap',
    anchor: `card:${W.slab}`,
    title: 'Now break it on purpose',
    text: 'A slab is a card sealed and scored out of 10. Worth more, but already graded.',
    action: 'Click Ramon Cruz',
    until: (s) => has(s, W.slab),
  },
  {
    id: 'collapse',
    anchor: 'pay',
    title: '$302 to $87',
    text: 'Grading it is the one thing they wanted to do. Read the red chip before you build.',
  },
  {
    id: 'untrap',
    anchor: `card:${W.slab}`,
    title: 'Take it back out',
    text: 'Clicking a selected card removes it. Nothing commits until you send.',
    action: 'Click Ramon Cruz again',
    until: (s) => !has(s, W.slab),
  },
  {
    id: 'sendTwo',
    anchor: 'send',
    title: 'Sell it',
    text: 'Two clean cards, no refusal, under their wallet.',
    action: 'Click SELL',
    until: (s) => s.show?.queueIndex === 2,
  },

  // -- Buyer three: passing, and digging ------------------------------------
  {
    id: 'setBuilder',
    anchor: 'wants',
    title: 'A set builder',
    text: 'They only want cards from one set — and there is nothing from it in your case.',
  },
  {
    id: 'pass',
    anchor: 'pass',
    title: 'You could wave them off',
    text: 'Three passes a show, and you do not get to choose who walks up next.',
  },
  {
    id: 'digButton',
    anchor: 'dig',
    title: 'Better: go and look',
    text: 'Digging swaps a card with your stock while the buyer waits.',
    action: 'Click DIG',
    untilAnchor: 'digPanel',
  },
  {
    id: 'digPanel',
    anchor: 'digPanel',
    title: 'Put one back, bring one out',
    text: 'Hand back the Bramblepup, then fetch Emberclaw — the one card from their set.',
    action: 'Swap in Emberclaw',
    until: (s) => inCase(s, W.origin),
  },
  {
    id: 'digCost',
    anchor: 'goodwill',
    title: 'That cost a goodwill pip',
    text: 'Six a show. Every dig is one you cannot make later.',
  },
  {
    id: 'sendThree',
    anchor: 'send',
    title: 'Sell it',
    text: 'A card they actually want, fetched from a box they cannot see.',
    action: 'Click SELL',
    until: (s) => s.phase === 'showResult',
  },

  // -- Between shows --------------------------------------------------------
  {
    id: 'result',
    anchor: 'collect',
    title: 'Doors closed',
    text: 'Over the quota, so the run continues.',
    action: 'Click through to the shop',
    until: (s) => s.phase === 'shop',
  },
  {
    id: 'money',
    anchor: 'money',
    title: 'What you can spend',
    text: 'Some is held back for the next table fee. That is why prices grey out.',
  },
  {
    id: 'singles',
    anchor: 'singles',
    title: 'Restocking',
    text: 'You sold your best cards. This is where they get replaced.',
  },
  {
    id: 'packs',
    anchor: 'packs',
    title: 'Or gamble on sealed',
    text: 'Cheaper per card. You open them here and keep what is worth carrying.',
  },
  {
    id: 'gear',
    anchor: 'gear',
    title: 'Gear changes the rules',
    text: 'Permanent upgrades. Each one prints exactly what it does to your pitches.',
  },
  {
    id: 'openStock',
    anchor: 'stockBtn',
    title: 'Everything you own',
    text: 'The case is only what fits on the table. This is the whole box.',
    action: 'Click YOUR STOCK',
    untilAnchor: 'stockPanel',
  },
  {
    id: 'depth',
    anchor: 'depth',
    title: 'Depth pays',
    text: 'Hold eight of one franchise and every one of them pitches harder.',
  },
  {
    id: 'pickStockCard',
    // The card handed back during the dig: raw, so it has every action on it.
    anchor: `stockCard:${W.pup}`,
    title: 'Cards act one at a time',
    text: 'The Bramblepup you handed back is in here. Click it.',
    action: 'Click Bramblepup',
    untilAnchor: 'cardActions',
  },
  {
    id: 'grade',
    anchor: 'grade',
    title: 'Grading',
    text: 'Seals it and scores it. A high grade multiplies the price; a low one wastes the fee.',
  },
  {
    id: 'sleeve',
    anchor: 'sleeve',
    title: 'Sleeving',
    text: 'Lifts a raw card one condition step. Priced by the step it buys.',
  },
  {
    id: 'sellOnline',
    anchor: 'sellOnline',
    title: 'Selling online',
    text: 'Always available, never the best price: 70% of face, no buyer needed.',
  },
  {
    id: 'closeStock',
    anchor: 'stockClose',
    title: 'Back to the shop',
    text: 'Nothing here is urgent — the box keeps.',
    action: 'Close your stock',
    untilGone: 'stockPanel',
  },
  {
    id: 'next',
    anchor: 'next',
    title: 'Back to the floor',
    text: 'The next show wants more money, and starts adding house rules.',
  },
  {
    id: 'done',
    title: 'That is the loop',
    text: 'Read the buyer, build the best pitch you can, stop when the wallet caps.',
  },
];
