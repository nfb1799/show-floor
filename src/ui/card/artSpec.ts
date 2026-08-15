/**
 * Procedural card art, derived deterministically from set + rarity.
 *
 * The price-guide redesign prints each set as one flat ink block and codes
 * rarity on a spine down the left edge, rather than the earlier per-franchise
 * gradient. This module and CardArt.tsx remain the entire visual layer for a
 * card: swapping in sprites means replacing CardArt inside CardView.
 */

import { isHolo } from '../../game/cards/value';
import type { Card, Condition, Rarity } from '../../game/types';

export interface CardArtSpec {
  /** Flat block colour behind the subject name. */
  readonly setInk: string;
  /** Spine colour down the left edge. */
  readonly rarityInk: string;
  readonly rarityLabel: string;
  readonly foil: boolean;
}

/**
 * One ink per set. Six come straight from the design; the rest extend the same
 * press palette, chosen so white display type stays legible on every one.
 */
const SET_INK: Record<string, string> = {
  'pb-origin': '#1f7a6a',
  'pb-wildlands': '#2f7d52',
  'pb-storm': '#4a5db8',
  'hw-89': '#a8801f',
  'hw-92': '#b8632a',
  'dl-76': '#1f5fa8',
  'dl-84': '#2c7c9c',
  'gr-codex': '#8e3b8f',
  'gr-ledger': '#a02c4a',
  'cr-s1': '#cf3a2e',
  'cr-turbo': '#d97b1e',
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

/** An unknown set still gets a stable ink rather than a fallback grey. */
function inkForSet(setId: string): string {
  return SET_INK[setId] ?? FALLBACK_INKS[hash(setId) % FALLBACK_INKS.length] ?? '#5c5346';
}

export function cardArtSpec(card: Card): CardArtSpec {
  const rarity = RARITY_INK[card.rarity];
  return {
    setInk: inkForSet(card.setId),
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

export const CONDITION_LABEL: Record<Condition, string> = {
  played: 'PL',
  lightlyPlayed: 'LP',
  nearMint: 'NM',
  mint: 'MINT',
};

/**
 * Slab stamp. The design mock used "PSA n" — a real company, and the doc
 * requires everything on a card to be invented — so the card just says what
 * the thing is.
 */
export const GRADER_MARK = 'GRADED';
