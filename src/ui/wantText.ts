/** Player-facing phrasing for buyer demands. Presentation only. */

import { getSet } from '../game/cards/catalog';
import { VINTAGE_YEAR_CUTOFF } from '../game/constants';
import type { Turnoff, Want } from '../game/types';

const CONDITION_TEXT: Record<string, string> = {
  played: 'Played',
  lightlyPlayed: 'Lightly Played',
  nearMint: 'Near Mint',
  mint: 'Mint',
};

export function describeWant(want: Want): string {
  switch (want.kind) {
    case 'fromSets':
      // Naming the actual sets matters: "vintage" is meaningless unless the
      // player can tell which cards qualify. Card faces print the set year.
      return want.setIds.length === 1 && want.setIds[0] !== undefined
        ? `Cards from ${getSet(want.setIds[0]).name}`
        : `Anything printed ${VINTAGE_YEAR_CUTOFF} or earlier`;
    case 'subject':
      return `${want.subject} cards`;
    case 'rawMinCondition':
      return `Raw cards, ${CONDITION_TEXT[want.minCondition] ?? want.minCondition} or better`;
    case 'minGrade':
      return `Slabs graded ${want.minGrade}+`;
    case 'holo':
      return 'Anything holo';
    case 'volume':
      return `Pitches of ${want.minCards}+ cards`;
    case 'valueOnly':
      return 'Pays for the cards, not the pitch';
  }
}

export function wantBonus(want: Want): string {
  if (want.kind === 'valueOnly') return 'no bonus';
  return `+${want.interestPerCard} each`;
}

/** Long-form explanation, shown under the buyer where there is room. */
export function explainWant(want: Want): string | null {
  switch (want.kind) {
    case 'valueOnly':
      return 'He resells everything, so he pays for what the cards are worth and ignores the pitch type bonus entirely. Interest still applies — a clever pitch of good cards pays well, a clever pitch of junk does not.';
    case 'fromSets':
      return want.setIds.length > 1
        ? 'Every card face prints its set year — anything at or under the cutoff counts.'
        : null;
    default:
      return null;
  }
}

export function describeTurnoff(turnoff: Turnoff): string {
  return turnoff.kind === 'anyRaw'
    ? `Any raw card: x${turnoff.interestMult} Interest`
    : `Any slab: x${turnoff.interestMult} Interest`;
}
