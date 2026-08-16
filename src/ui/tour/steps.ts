/**
 * The walkthrough script.
 *
 * One or two short sentences per step. The spotlight is doing the pointing, so
 * the words only have to say the thing the player cannot see for themselves —
 * anything longer and it stops being a walkthrough and starts being a manual.
 *
 * Steps with an `until` predicate hand control back: only the highlighted
 * control is clickable, and the step ends when the game reaches the state it
 * asked for. Anchors are `data-tour` values on the real components.
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
  /** When true, the step is done and the tour moves on by itself. */
  readonly until?: (s: RunState) => boolean;
}

const sel = (s: RunState): readonly string[] => s.show?.selection ?? [];
const has = (s: RunState, id: string): boolean => sel(s).includes(id);

export const TOUR_STEPS: readonly TourStep[] = [
  // -- The table ------------------------------------------------------------
  {
    id: 'welcome',
    title: 'Your table, mid-show',
    text: 'A short show — two buyers instead of four. Everything here is the real game.',
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
    text: 'The pitch is worth more than they can pay, so the rest is wasted. Stop here and sell.',
  },
  {
    id: 'send',
    anchor: 'send',
    title: 'Sell it',
    text: 'No haggling — the price you see is the price you get.',
    action: 'Click SEND IT',
    until: (s) => s.show?.queueIndex === 1,
  },

  // -- Buyer two: the refusal ----------------------------------------------
  {
    id: 'sold',
    anchor: 'quota',
    title: 'Banked',
    text: 'Sold cards leave the run for good, and the case refilled from your stock.',
  },
  {
    id: 'grader',
    anchor: 'wants',
    title: 'A grader, and a warning',
    text: 'Green is what they want. Red is a refusal — one beaten card quarters the whole pitch.',
  },
  {
    id: 'pickClean',
    anchor: `card:${W.dell}`,
    title: 'Give them a clean one',
    text: 'Marcus Dell is raw and Near Mint.',
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
    anchor: `card:${W.ruiz}`,
    title: 'Now break it on purpose',
    text: 'Bobby Ruiz is worth real money, but he is Played.',
    action: 'Click Bobby Ruiz',
    until: (s) => has(s, W.ruiz),
  },
  {
    id: 'collapse',
    anchor: 'pay',
    title: '$302 to $169',
    text: 'One beaten card cost more than it was worth. Read the red chip before you build.',
  },
  {
    id: 'untrap',
    anchor: `card:${W.ruiz}`,
    title: 'Take him back out',
    text: 'Clicking a selected card removes it. Nothing commits until you send.',
    action: 'Click Bobby Ruiz again',
    until: (s) => !has(s, W.ruiz),
  },
  {
    id: 'dig',
    anchor: 'dig',
    title: 'Digging',
    text: 'Swaps a card with your stock without losing the buyer, for a goodwill pip.',
  },
  {
    id: 'sendTwo',
    anchor: 'send',
    title: 'Sell it',
    text: 'Two clean cards, no refusal, under their wallet.',
    action: 'Click SEND IT',
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
    text: 'Some of it is held back for the next table fee. That is why prices grey out.',
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
    text: 'Permanent scoring upgrades. Hover one to see what it does.',
  },
  {
    id: 'stock',
    anchor: 'stockBtn',
    title: 'Your box',
    text: 'Grade a card, sleeve one up a condition step, or sell anything online.',
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
