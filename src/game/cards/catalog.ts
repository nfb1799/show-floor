/**
 * Every franchise, set and subject in the game. All fictional by design —
 * legible analogs, no licensed marks, no real athletes or characters.
 */

import { VINTAGE_YEAR_CUTOFF } from '../constants';
import type { FranchiseDefinition, SetDefinition } from '../types';

export const FRANCHISES: readonly FranchiseDefinition[] = [
  {
    id: 'pocketBeasts',
    name: 'Pocket Beasts',
    subjects: [
      'Emberclaw',
      'Tidefin',
      'Voltmoth',
      'Bramblepup',
      'Cinderfox',
      'Glacierhorn',
      'Mossling',
      'Sparkmite',
      'Dunewyrm',
      'Nimbustag',
    ],
  },
  {
    id: 'hardwood',
    // The family name, distinct from its "Hardwood '89" set — cards print both.
    name: 'Hardwood',
    subjects: [
      'Marcus Dell',
      'Tyrone Vance',
      'Bobby Ruiz',
      'Andre Kimble',
      'Deshawn Ford',
      'Rickey Malloy',
      'Curtis Lyle',
      'Ellis Trammell',
    ],
  },
  {
    id: 'diamondLeague',
    name: 'Bullpen',
    subjects: [
      'Hal Brennan',
      'Sonny Petrosian',
      'Duke Alvarez',
      'Whitey Kroll',
      'Ramon Cruz',
      'Buster Nagy',
      'Lefty Doran',
      'Chip Kowalczyk',
    ],
  },
  {
    id: 'grimoire',
    name: 'Grimoire',
    subjects: [
      'Ashen Lich',
      'Verdant Warden',
      'Tidecaller',
      'Rune Golem',
      'Oathbreaker',
      'Hollow Saint',
      'Gravebloom',
      'Sable Herald',
    ],
  },
  {
    id: 'chromeRacers',
    name: 'Slipstream',
    subjects: [
      'Meridian GT',
      'Falcon Twelve',
      'Vance Ryder',
      'Nico Barsanti',
      'Sunstrip 500',
      'Kestrel Turbo',
      'Deke Lambert',
      'Halcyon Nine',
    ],
  },
];

export const SETS: readonly SetDefinition[] = [
  // Pocket Beasts
  { id: 'pb-origin', name: 'Origin Set', franchise: 'pocketBeasts', year: 1997, size: 64 },
  { id: 'pb-wildlands', name: 'Wildlands', franchise: 'pocketBeasts', year: 1999, size: 72 },
  { id: 'pb-storm', name: 'Storm Cycle', franchise: 'pocketBeasts', year: 2003, size: 80 },

  // Hardwood
  { id: 'hw-89', name: "Hardwood '89", franchise: 'hardwood', year: 1989, size: 132 },
  { id: 'hw-92', name: "Courtside '92", franchise: 'hardwood', year: 1992, size: 110 },

  // Bullpen
  { id: 'dl-76', name: "Bullpen '76", franchise: 'diamondLeague', year: 1976, size: 120 },
  { id: 'dl-84', name: "Bullpen '84", franchise: 'diamondLeague', year: 1984, size: 140 },

  // Grimoire
  { id: 'gr-codex', name: 'First Codex', franchise: 'grimoire', year: 1994, size: 90 },
  { id: 'gr-ledger', name: 'Blood Ledger', franchise: 'grimoire', year: 2001, size: 100 },

  // Slipstream
  { id: 'cr-s1', name: 'Series One', franchise: 'chromeRacers', year: 1978, size: 66 },
  { id: 'cr-turbo', name: 'Turbo Series', franchise: 'chromeRacers', year: 1983, size: 55 },
];

const SETS_BY_ID = new Map(SETS.map((s) => [s.id, s]));
const FRANCHISES_BY_ID = new Map(FRANCHISES.map((f) => [f.id, f]));

export function getSet(setId: string): SetDefinition {
  const found = SETS_BY_ID.get(setId);
  if (!found) throw new Error(`Unknown set: ${setId}`);
  return found;
}

export function getFranchise(franchiseId: string): FranchiseDefinition {
  const found = FRANCHISES_BY_ID.get(franchiseId);
  if (!found) throw new Error(`Unknown franchise: ${franchiseId}`);
  return found;
}

export function setsForFranchise(franchiseId: string): SetDefinition[] {
  return SETS.filter((s) => s.franchise === franchiseId);
}

/**
 * Sets a Nostalgia Buyer counts as old. Resolved from the global registry so
 * "oldest set in the pool" means the same thing regardless of what the player
 * happens to be holding.
 */
export function vintageSetIds(): string[] {
  return SETS.filter((s) => s.year <= VINTAGE_YEAR_CUTOFF).map((s) => s.id);
}
