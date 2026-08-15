/**
 * Test fixtures. Kept out of the test files themselves so pitch type detection
 * and scoring tests build cards the same way.
 */

import type {
  Buyer,
  BuyerArchetypeId,
  Condition,
  Modifier,
  Rarity,
  RawCard,
  SlabCard,
  Turnoff,
  Want,
} from '../types';

let seq = 0;

export function resetIds(): void {
  seq = 0;
}

interface CardOverrides {
  id?: string;
  subject?: string;
  franchise?: string;
  setId?: string;
  setNumber?: number;
  rarity?: Rarity;
}

function base(o: CardOverrides) {
  seq += 1;
  return {
    id: o.id ?? `card-${seq}`,
    subject: o.subject ?? 'Emberclaw',
    franchise: o.franchise ?? 'pocketBeasts',
    setId: o.setId ?? 'pb-origin',
    setNumber: o.setNumber ?? 1,
    rarity: o.rarity ?? ('common' as Rarity),
  };
}

export function raw(o: CardOverrides & { condition?: Condition } = {}): RawCard {
  return { ...base(o), slabbed: false, condition: o.condition ?? 'nearMint' };
}

export function slab(o: CardOverrides & { grade?: number } = {}): SlabCard {
  return { ...base(o), slabbed: true, grade: o.grade ?? 9 };
}

interface BuyerOverrides {
  id?: string;
  archetype?: BuyerArchetypeId;
  label?: string;
  budget?: number;
  goodwill?: number;
  wants?: Want[];
  turnoff?: Turnoff;
  chaseCard?: string;
  marks?: string[];
}

/** Defaults to an inert buyer: no wants, no turnoff, effectively no budget cap. */
export function buyer(o: BuyerOverrides = {}): Buyer {
  return {
    id: o.id ?? 'buyer-1',
    archetype: o.archetype ?? 'bulkGuy',
    label: o.label ?? 'Test Buyer',
    budget: o.budget ?? 1_000_000,
    goodwill: o.goodwill ?? 3,
    wants: o.wants ?? [],
    ...(o.turnoff ? { turnoff: o.turnoff } : {}),
    ...(o.chaseCard !== undefined ? { chaseCard: o.chaseCard } : {}),
    ...(o.marks ? { marks: o.marks } : {}),
  };
}

/** Builds a modifier from a partial hook set. */
export function modifier(
  id: string,
  kind: 'upgrade' | 'condition',
  hooks: Modifier['hooks'],
): Modifier {
  return { id, name: id, kind, hooks };
}

/** Cards of one franchise with distinct subjects, for wide-pitch tests. */
export function franchiseSpread(
  franchise: string,
  subjects: readonly string[],
  o: { rarity?: Rarity; condition?: Condition } = {},
): RawCard[] {
  return subjects.map((subject, i) =>
    raw({
      franchise,
      subject,
      setNumber: i + 1,
      ...(o.rarity ? { rarity: o.rarity } : {}),
      ...(o.condition ? { condition: o.condition } : {}),
    }),
  );
}
