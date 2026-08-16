/**
 * Procedural card art, derived deterministically from franchise + rarity.
 *
 * The card prints its franchise as one flat ink block and codes rarity on a
 * spine down the left edge. Colour is keyed to the franchise rather than the
 * individual set because franchise is what the player is actually sorting by:
 * Full Case, Graded Run, collection depth and most Personal Collectors are all
 * franchise-shaped, so a case full of one colour is a case full of one pitch.
 *
 * This module and CardArt.tsx remain the entire visual layer for a card:
 * swapping in sprites means replacing CardArt inside CardView.
 */

import { isHolo } from '../../game/cards/value';
import type { Card, Condition, Rarity } from '../../game/types';

export interface CardArtSpec {
  /** Flat block colour behind the subject name. One per franchise. */
  readonly franchiseInk: string;
  /** Spine colour down the left edge. */
  readonly rarityInk: string;
  readonly rarityLabel: string;
  readonly foil: boolean;
}

/**
 * One ink per franchise, each picked for what the franchise is about rather
 * than for variety: hardwood floors and basketball leather are brown, an
 * outfield is green, arcana is purple, race liveries are red, and the pocket
 * monsters keep the electric blue their box art has always used. All five are
 * dark enough to carry white display type.
 */
const FRANCHISE_INK: Record<string, string> = {
  pocketBeasts: '#2a5fbc',
  hardwood: '#8a5423',
  diamondLeague: '#2f7d52',
  grimoire: '#7c3a94',
  chromeRacers: '#c3352a',
};

const RARITY_INK: Record<Rarity, { label: string; ink: string }> = {
  common: { label: 'COMMON', ink: '#5c5346' },
  uncommon: { label: 'UNCOMMON', ink: '#2f7d52' },
  rare: { label: 'RARE', ink: '#1f5fa8' },
  rareHolo: { label: 'RARE HOLO', ink: '#8e3b8f' },
  ultra: { label: 'ULTRA', ink: '#c8901f' },
};

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const FALLBACK_INKS = ['#1f7a6a', '#4a5db8', '#a02c4a', '#b8632a', '#2c7c9c'];

/** An unknown franchise still gets a stable ink rather than a fallback grey. */
function inkForFranchise(franchiseId: string): string {
  return (
    FRANCHISE_INK[franchiseId] ??
    FALLBACK_INKS[hash(franchiseId) % FALLBACK_INKS.length] ??
    '#5c5346'
  );
}

export function cardArtSpec(card: Card): CardArtSpec {
  const rarity = RARITY_INK[card.rarity];
  return {
    franchiseInk: inkForFranchise(card.franchise),
    rarityInk: rarity.ink,
    rarityLabel: rarity.label,
    foil: isHolo(card.rarity),
  };
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: RARITY_INK.common.label,
  uncommon: RARITY_INK.uncommon.label,
  rare: RARITY_INK.rare.label,
  rareHolo: RARITY_INK.rareHolo.label,
  ultra: RARITY_INK.ultra.label,
};

/** What the corner stamp prints. Two letters each, so they line up. */
export const CONDITION_LABEL: Record<Condition, string> = {
  played: 'HP',
  lightlyPlayed: 'LP',
  nearMint: 'NM',
  mint: 'MT',
};

/** Spelled out, for tooltips and anywhere with room for words. */
export const CONDITION_NAME: Record<Condition, string> = {
  played: 'Heavy Play',
  lightlyPlayed: 'Light Play',
  nearMint: 'Near Mint',
  mint: 'Mint',
};

/**
 * Slab stamp. The design mock used "PSA n" — a real company, and the doc
 * requires everything on a card to be invented — so the card just says what
 * the thing is.
 */
export const GRADER_MARK = 'GRADED';
