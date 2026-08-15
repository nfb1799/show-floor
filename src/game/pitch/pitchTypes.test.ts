import { describe, expect, it } from 'vitest';
import { detectPitchTypes, pitchTypeLabel } from './pitchTypes';
import { buyer, raw, slab } from '../testing/factories';
import type { PitchTypeId } from '../types';

/** Every type the cards qualify as, minus the always-present floor type. */
function typesFor(cards: Parameters<typeof detectPitchTypes>[0], b = buyer()): PitchTypeId[] {
  return detectPitchTypes(cards, b).filter((t) => t !== 'looseCards');
}

describe('pitch size', () => {
  it('accepts 1 through 5 cards', () => {
    for (let n = 1; n <= 5; n++) {
      const cards = Array.from({ length: n }, (_, i) => raw({ subject: `S${i}`, rarity: 'rare' }));
      expect(detectPitchTypes(cards, buyer())).toContain('looseCards');
    }
  });

  it('rejects an empty pitch and a pitch of 6', () => {
    expect(detectPitchTypes([], buyer())).toEqual([]);
    const six = Array.from({ length: 6 }, (_, i) => raw({ subject: `S${i}` }));
    expect(detectPitchTypes(six, buyer())).toEqual([]);
  });
});

describe('Loose Cards / Loose Single', () => {
  it('is always available for a legally sized pitch', () => {
    // Nothing shared: different subject, franchise and set.
    const cards = [
      raw({ subject: 'Emberclaw', franchise: 'pocketBeasts', setId: 'pb-origin' }),
      raw({ subject: 'Ashen Lich', franchise: 'grimoire', setId: 'gr-codex', rarity: 'rare' }),
    ];
    expect(detectPitchTypes(cards, buyer())).toEqual(['looseCards']);
  });

  it('reads as "Loose Single" at exactly one card', () => {
    expect(pitchTypeLabel('looseCards', 1)).toBe('Loose Single');
    expect(pitchTypeLabel('looseCards', 3)).toBe('Loose Cards');
  });
});

describe('Pair', () => {
  it('matches two cards with the same subject', () => {
    const cards = [
      raw({ subject: 'Tidefin', setId: 'pb-origin' }),
      raw({ subject: 'Tidefin', setId: 'pb-storm', rarity: 'rare' }),
    ];
    expect(typesFor(cards)).toContain('pair');
  });

  it('matches two cards from the same set', () => {
    const cards = [
      raw({ subject: 'Tidefin', setId: 'pb-origin' }),
      raw({ subject: 'Voltmoth', setId: 'pb-origin', rarity: 'rare' }),
    ];
    expect(typesFor(cards)).toContain('pair');
  });

  it('does not match two unrelated cards', () => {
    const cards = [
      raw({ subject: 'Tidefin', franchise: 'pocketBeasts', setId: 'pb-origin' }),
      raw({ subject: 'Hal Brennan', franchise: 'diamondLeague', setId: 'dl-76', rarity: 'rare' }),
    ];
    expect(typesFor(cards)).not.toContain('pair');
  });
});

describe('Bundle', () => {
  it('matches three cards sharing a franchise', () => {
    const cards = [
      raw({ subject: 'Tidefin', franchise: 'pocketBeasts', setId: 'pb-origin', rarity: 'common' }),
      raw({ subject: 'Voltmoth', franchise: 'pocketBeasts', setId: 'pb-storm', rarity: 'rare' }),
      raw({ subject: 'Mossling', franchise: 'pocketBeasts', setId: 'pb-wildlands', rarity: 'uncommon' }),
    ];
    expect(typesFor(cards)).toContain('bundle');
  });

  it('does not treat shared rarity as a shared attribute', () => {
    // Three commons from three franchises. If rarity counted, this would be a
    // Bundle, which would make nearly any three cards score 25/x3.
    const cards = [
      raw({ subject: 'Tidefin', franchise: 'pocketBeasts', setId: 'pb-origin' }),
      raw({ subject: 'Hal Brennan', franchise: 'diamondLeague', setId: 'dl-76' }),
      raw({ subject: 'Ashen Lich', franchise: 'grimoire', setId: 'gr-codex' }),
    ];
    expect(typesFor(cards)).not.toContain('bundle');
  });

  it('does not treat shared raw-ness as a shared attribute', () => {
    const cards = [
      raw({ subject: 'Tidefin', franchise: 'pocketBeasts', setId: 'pb-origin', rarity: 'common' }),
      raw({ subject: 'Hal Brennan', franchise: 'diamondLeague', setId: 'dl-76', rarity: 'rare' }),
      raw({ subject: 'Ashen Lich', franchise: 'grimoire', setId: 'gr-codex', rarity: 'uncommon' }),
    ];
    expect(typesFor(cards)).not.toContain('bundle');
  });

  it('requires exactly three cards', () => {
    const four = Array.from({ length: 4 }, (_, i) =>
      raw({ subject: `S${i}`, franchise: 'grimoire', setId: 'gr-codex' }),
    );
    expect(typesFor(four)).not.toContain('bundle');
  });
});

describe('Rainbow', () => {
  it('matches 3+ different subjects at one rarity', () => {
    const cards = [
      raw({ subject: 'Tidefin', rarity: 'rare', franchise: 'pocketBeasts' }),
      raw({ subject: 'Hal Brennan', rarity: 'rare', franchise: 'diamondLeague', setId: 'dl-76' }),
      raw({ subject: 'Ashen Lich', rarity: 'rare', franchise: 'grimoire', setId: 'gr-codex' }),
    ];
    expect(typesFor(cards)).toContain('rainbow');
  });

  it('rejects a repeated subject', () => {
    const cards = [
      raw({ subject: 'Tidefin', rarity: 'rare' }),
      raw({ subject: 'Tidefin', rarity: 'rare' }),
      raw({ subject: 'Voltmoth', rarity: 'rare' }),
    ];
    expect(typesFor(cards)).not.toContain('rainbow');
  });

  it('rejects mixed rarities', () => {
    const cards = [
      raw({ subject: 'Tidefin', rarity: 'rare' }),
      raw({ subject: 'Voltmoth', rarity: 'common' }),
      raw({ subject: 'Mossling', rarity: 'rare' }),
    ];
    expect(typesFor(cards)).not.toContain('rainbow');
  });
});

describe('Playset', () => {
  it('matches exactly four of one subject', () => {
    const cards = Array.from({ length: 4 }, (_, i) =>
      raw({ subject: 'Emberclaw', setNumber: i + 1 }),
    );
    expect(typesFor(cards)).toContain('playset');
  });

  it('rejects three of one subject', () => {
    const cards = Array.from({ length: 3 }, () => raw({ subject: 'Emberclaw' }));
    expect(typesFor(cards)).not.toContain('playset');
  });
});

describe('Set Run', () => {
  it('matches 3+ consecutive numbers in one set', () => {
    const cards = [
      raw({ setId: 'pb-origin', setNumber: 12, subject: 'A' }),
      raw({ setId: 'pb-origin', setNumber: 14, subject: 'B' }),
      raw({ setId: 'pb-origin', setNumber: 13, subject: 'C' }),
    ];
    expect(typesFor(cards)).toContain('setRun');
  });

  it('rejects a gap in the run', () => {
    const cards = [
      raw({ setId: 'pb-origin', setNumber: 12, subject: 'A' }),
      raw({ setId: 'pb-origin', setNumber: 13, subject: 'B' }),
      raw({ setId: 'pb-origin', setNumber: 15, subject: 'C' }),
    ];
    expect(typesFor(cards)).not.toContain('setRun');
  });

  it('rejects duplicate numbers', () => {
    const cards = [
      raw({ setId: 'pb-origin', setNumber: 12, subject: 'A' }),
      raw({ setId: 'pb-origin', setNumber: 12, subject: 'B' }),
      raw({ setId: 'pb-origin', setNumber: 13, subject: 'C' }),
    ];
    expect(typesFor(cards)).not.toContain('setRun');
  });

  it('rejects consecutive numbers across two sets', () => {
    const cards = [
      raw({ setId: 'pb-origin', setNumber: 12, subject: 'A' }),
      raw({ setId: 'pb-storm', setNumber: 13, subject: 'B' }),
      raw({ setId: 'pb-origin', setNumber: 14, subject: 'C' }),
    ];
    expect(typesFor(cards)).not.toContain('setRun');
  });
});

describe('Full Case', () => {
  it('matches five cards of one franchise', () => {
    const cards = Array.from({ length: 5 }, (_, i) =>
      raw({ franchise: 'grimoire', setId: 'gr-codex', subject: `S${i}`, setNumber: i * 3 }),
    );
    expect(typesFor(cards)).toContain('fullCase');
  });

  it('rejects four cards of one franchise', () => {
    const cards = Array.from({ length: 4 }, (_, i) =>
      raw({ franchise: 'grimoire', subject: `S${i}`, setNumber: i * 3 }),
    );
    expect(typesFor(cards)).not.toContain('fullCase');
  });
});

describe('Graded Run', () => {
  it('matches 3+ slabs of one franchise with distinct grades', () => {
    const cards = [
      slab({ franchise: 'grimoire', grade: 7, subject: 'A' }),
      slab({ franchise: 'grimoire', grade: 9, subject: 'B' }),
      slab({ franchise: 'grimoire', grade: 8, subject: 'C' }),
    ];
    expect(typesFor(cards)).toContain('gradedRun');
  });

  it('rejects repeated grades', () => {
    const cards = [
      slab({ franchise: 'grimoire', grade: 8, subject: 'A' }),
      slab({ franchise: 'grimoire', grade: 8, subject: 'B' }),
      slab({ franchise: 'grimoire', grade: 9, subject: 'C' }),
    ];
    expect(typesFor(cards)).not.toContain('gradedRun');
  });

  it('rejects a raw card in the run', () => {
    const cards = [
      slab({ franchise: 'grimoire', grade: 7, subject: 'A' }),
      slab({ franchise: 'grimoire', grade: 8, subject: 'B' }),
      raw({ franchise: 'grimoire', subject: 'C' }),
    ];
    expect(typesFor(cards)).not.toContain('gradedRun');
  });

  it('rejects slabs from different franchises', () => {
    const cards = [
      slab({ franchise: 'grimoire', grade: 7, subject: 'A' }),
      slab({ franchise: 'pocketBeasts', grade: 8, subject: 'B' }),
      slab({ franchise: 'grimoire', grade: 9, subject: 'C' }),
    ];
    expect(typesFor(cards)).not.toContain('gradedRun');
  });
});

describe('Holo Wall', () => {
  it('matches five cards at rareHolo or better', () => {
    const cards = [
      raw({ rarity: 'rareHolo', subject: 'A' }),
      raw({ rarity: 'ultra', subject: 'B' }),
      raw({ rarity: 'rareHolo', subject: 'C' }),
      raw({ rarity: 'ultra', subject: 'D' }),
      raw({ rarity: 'rareHolo', subject: 'E' }),
    ];
    expect(typesFor(cards)).toContain('holoWall');
  });

  it('rejects a single non-holo card', () => {
    const cards = [
      raw({ rarity: 'rareHolo', subject: 'A' }),
      raw({ rarity: 'rareHolo', subject: 'B' }),
      raw({ rarity: 'rareHolo', subject: 'C' }),
      raw({ rarity: 'rareHolo', subject: 'D' }),
      raw({ rarity: 'rare', subject: 'E' }),
    ];
    expect(typesFor(cards)).not.toContain('holoWall');
  });

  it('rejects four holo cards', () => {
    const cards = Array.from({ length: 4 }, (_, i) =>
      raw({ rarity: 'rareHolo', subject: `S${i}` }),
    );
    expect(typesFor(cards)).not.toContain('holoWall');
  });
});

describe('The Grail', () => {
  const grailCards = () => [
    raw({ franchise: 'grimoire', subject: 'Ashen Lich', setNumber: 1 }),
    raw({ franchise: 'grimoire', subject: 'Tidecaller', setNumber: 4 }),
    raw({ franchise: 'grimoire', subject: 'Rune Golem', setNumber: 7 }),
    raw({ franchise: 'grimoire', subject: 'Oathbreaker', setNumber: 9 }),
    raw({ franchise: 'grimoire', subject: 'Gravebloom', setNumber: 12 }),
  ];

  it('matches the chase card plus four of the same franchise', () => {
    const b = buyer({ chaseCard: 'Ashen Lich' });
    expect(typesFor(grailCards(), b)).toContain('grail');
  });

  it('does not match when the buyer names no chase card', () => {
    expect(typesFor(grailCards(), buyer())).not.toContain('grail');
  });

  it('does not match when the chase card is absent', () => {
    const b = buyer({ chaseCard: 'Sable Herald' });
    expect(typesFor(grailCards(), b)).not.toContain('grail');
  });

  it('does not match when the franchise is mixed', () => {
    const cards = grailCards();
    cards[4] = raw({ franchise: 'pocketBeasts', subject: 'Tidefin' });
    const b = buyer({ chaseCard: 'Ashen Lich' });
    expect(typesFor(cards, b)).not.toContain('grail');
  });
});
