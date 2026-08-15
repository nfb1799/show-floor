# Show Floor — Game Design Document

**Genre:** Roguelike deckbuilder / score-attack
**Platform:** Browser (TypeScript + React). Desktop-first, mouse input.
**Session length:** Endless run, ~5-8 min per show.
**Reference point:** Balatro's structure, not its theme.

---

## 1. Premise

You are a vendor at trading card shows. Each show, buyers walk up to your table and you pitch them cards from your display case. Sell enough to clear the table fee and the show's revenue quota, restock at the shop, and set up for a bigger show. Cards you sell are gone forever, so the run is a constant race between your inventory draining and the quota climbing.

The base game is grounded — real card-show texture, plausible cards, plausible buyers. The **upgrades** are where it gets strange.

---

## 2. Structural Mapping

Everything maps cleanly onto a familiar skeleton. Build against this table when in doubt.

| Balatro | Show Floor |
|---|---|
| Blind | A **Show** with a revenue quota |
| Score | **Money earned** at that show |
| Hand of 8 cards | **Display Case** (8 slots) |
| Deck | **Inventory** (every card you own) |
| Play a hand (5 cards) | **Pitch** up to 5 cards to a buyer |
| Hands per blind (4) | **Buyers per show** (4) |
| Discards (3) | **Turn away buyer** (3), which also restocks the case |
| Poker hand type | **Pitch Type** |
| Chips | **Value** |
| Mult | **Interest** |
| Jokers (5 slots) | **Booth Upgrades** (slots from tables) |
| Boss Blind | **Show Conditions** |
| Shop | **Between-show shop** |

The single most important consequence: **money is the score.** There is no separate points currency. What you earn is what you bank, and what you bank is what you spend.

---

## 3. Card Data Model

```ts
type Rarity = 'common' | 'uncommon' | 'rare' | 'rareHolo' | 'ultra';
type Condition = 'played' | 'lightlyPlayed' | 'nearMint' | 'mint';

interface Card {
  id: string;
  subject: string;      // "Emberclaw"  — the character
  franchise: string;    // "Pocket Beasts" — the IP family
  set: string;          // "Origin Set"
  setNumber: number;    // for run-based pitch types
  rarity: Rarity;
  slabbed: boolean;
  condition?: Condition; // raw only
  grade?: number;        // slab only, 1-10
}
```

**Displayed on the card face:** subject name, set + number, rarity badge (holo rendered as a foil treatment, not a separate label), and either a condition tag or a grade slab frame. Value is shown as a price, computed — never authored.

### Value calculation

```
rarityBase = { common: 2, uncommon: 5, rare: 12, rareHolo: 35, ultra: 90 }

RAW:   value = rarityBase × conditionMult
       conditionMult = { played: 0.4, lightlyPlayed: 0.7, nearMint: 1.0, mint: 1.3 }

SLAB:  value = rarityBase × gradeMult
       gradeMult = { ≤6: 0.8, 7: 1.4, 8: 2.0, 9: 3.2, 10: 6.0 }
```

### Raw vs. Slab — the core distinction

| | Raw | Slab |
|---|---|---|
| Pitch types | All | All |
| Value ceiling | Low | High |
| Condition effects | Vulnerable to damage/upgrades | Immune |
| Set Builders / Kids | Preferred | **Refuse** (×0.25 Interest) |
| Investors / Whales | **Refuse** (×0.25 Interest) | Required |
| Can be graded | Yes | No |

Grading is the bridge and it is a gamble. At the shop, pay a fee to submit a raw card. It returns as a slab with a grade rolled against its condition:

```
played        → 1-6
lightlyPlayed → 5-8
nearMint      → 7-10, weighted toward 8
mint          → 8-10, weighted toward 9
```

The strategic hook: grading concentrates value into fewer cards and locks you out of half the buyer pool. A well-graded case can whiff badly against a casual crowd.

---

## 4. IP Handling

All franchises are fictional with legible analogs. Suggested families:

- **Pocket Beasts** — creature collecting; Emberclaw, Tidefin, Voltmoth
- **Hardwood '89** — basketball rookies; generated athlete names
- **Diamond League** — baseball
- **Grimoire** — fantasy TCG, tournament-play flavor
- **Chrome Racers** — 70s-80s motorsport insert sets

Card art is procedural: subject name typeset over a generated gradient/pattern keyed to franchise and rarity. No licensed marks, no real athlete or character names, no logo pastiche.

---

## 5. The Pitch — Core Mechanic

Each buyer is one "hand." Select 1-5 cards from your Display Case and pitch them.

```
Appeal = (pitchValue + Σ cardValues) × (pitchInterest + Σ interestBonuses)
Offer  = min(Appeal × offerRatio, buyerBudget)
```

`offerRatio` starts at **0.70**.

### Pitch Types

| Pitch Type | Requirement | Value | Interest |
|---|---|---|---|
| Loose Single | 1 card | 5 | ×1 |
| Pair | 2 cards, same subject *or* same set | 12 | ×2 |
| Bundle | 3 cards sharing any one attribute | 25 | ×3 |
| Rainbow | 3+ cards, all different subjects, same rarity | 40 | ×4 |
| Playset | 4 cards, same subject | 55 | ×4 |
| Set Run | 3+ cards, same set, consecutive setNumbers | 70 | ×5 |
| Full Case | 5 cards, same franchise | 85 | ×5 |
| Graded Run | 3+ slabs, ascending grades | 100 | ×6 |
| Holo Wall | 5 cards, all rareHolo or better | 130 | ×8 |
| The Grail | Buyer's named chase card + 4 same franchise | 160 | ×10 |

Highest-scoring valid type is auto-selected and shown before the player commits.

### Buyers

```ts
interface Buyer {
  archetype: BuyerArchetype;
  budget: number;
  patience: number;      // 1-3
  wants: Want[];         // 1-2, grant Interest when satisfied
  turnoff?: Turnoff;     // penalty condition
  chaseCard?: string;    // subject name, if any
}
```

Archetypes, each with a distinct demand shape:

| Archetype | Shape | Budget | Wants |
|---|---|---|---|
| **Set Builder** | Want-list | Medium | Cards from one named set. +3 Interest each |
| **Personal Collector** | Single subject | Medium | One subject only. +4 Interest each |
| **Flipper** | Value hunter | High | Total value must be ≥2× offer, or ×0.5 Interest |
| **Grader** | Condition hunter | Medium | Raw NM/Mint only. +5 Interest each |
| **Investor** | Slab only | Very high | Grade 9+. Turnoff: any raw card |
| **Kid with $20** | Hard cap | $20 | Anything holo. +6 Interest. Turnoff: slabs |
| **Bulk Guy** | Volume | Low | Pitches of 4-5 cards. +2 Interest per card |
| **Nostalgia Buyer** | Era | High | Oldest set in the pool. +5 Interest each |

Buyer budget is a **hard cap on money received**, so reading the buyer matters as much as building the pitch. A $400 Appeal to a Kid pays $20.

### Haggle

After the pitch, the buyer makes an offer. The player may **Accept** or **Push**.

- Push: `offerRatio += 0.15`, `patience -= 1`
- At patience 0, a further Push means the buyer **walks** — no money, buyer slot consumed
- Patience is visible before pitching

### Turning Away a Buyer (discard analog)

3 per show. Dismisses the current buyer without a sale and lets you **swap any number of cards out of the Display Case**, redrawing from Inventory. This is your only mid-show mulligan, and it costs you a scoring opportunity.

---

## 6. Show Structure

### Setup Phase
Before each show you see a **rumor** — one partial fact about the crowd (e.g. *"Heavy vintage turnout expected"*, *"Word is the investors are out in force"*, *"Family day — expect a young crowd"*). You then equip Booth Upgrades from your owned pool, limited by available slots.

You own unlimited upgrades. You can only **equip** as many as your tables allow.

| Tables | Slots | Cost |
|---|---|---|
| 1 | 3 | starting |
| 2 | 5 | $400 |
| 3 | 7 | $1,200 |

### Show Phase
1. Pay table fee
2. Draw 8 cards from Inventory into the Display Case
3. Serve 4 buyers sequentially — pitch, haggle, resolve
4. Sold cards are **removed from Inventory permanently**
5. Clear quota → advance. Miss quota → **run over**

Bankroll cannot go negative. If you can't cover the table fee, the run ends.

### Shop Phase
- **Singles & slabs** — 5 offered, rerollable
- **Packs** — random cards weighted by pack tier, the gamble restock
- **Booth Upgrades** — 2 offered
- **Grading submissions** — convert raw → slab
- **Supplies** — consumables: sleeve a card (+1 condition), price guide (peek at next show's buyer mix), toploader (protect a card from a show condition)
- **Tables & cases** — permanent capacity

---

## 7. Escalation & Endless Scaling

```
quota(n)    = 250 × 1.55^(n-1)        // soften to 1.35 after show 12
tableFee(n) = 50  × 1.40^(n-1)
buyerBudgetScale(n) = 1.0 × 1.35^(n-1)
```

Budgets scale **slower** than quota. Raw card value cannot keep up alone — the player must build an Interest engine to survive past roughly show 8. This is the intended pressure and the reason upgrades exist.

### Show Conditions (the "boss")

Every 3rd show applies a show-wide condition, announced during Setup. Draw from a pool that grows as the run progresses:

- **Snob Crowd** — raw cards ×0.5 Interest
- **Slow Saturday** — 3 buyers instead of 4
- **Convention Center** — table fee tripled
- **No Bulk Bins** — pitches of 1-2 cards score $0
- **Undercutter** — the booth next door forces `offerRatio` to start at 0.50
- **Impatient Floor** — all buyers have patience 1
- **Cash Only** — all budgets halved
- **Damp Hall** — every unsold raw card in the case loses one condition step at show's end
- **Case Inspection** — Display Case reduced to 5 slots
- **Grail Hunters** — every buyer has a chaseCard, and pitches without it are ×0.5

Later shows may stack two conditions.

---

## 8. Booth Upgrades

Three weirdness tiers. Ship roughly 40 for a first pass.

### Tier 1 — Gear (grounded)
- **UV Display Case** — rareHolo and ultra cards: +2 Interest each
- **Toploader Stack** — raw cards ignore condition penalties on value
- **Price Guide Binder** — see the next buyer's wants before pitching
- **Backup Showcase** — Display Case +2 slots
- **Card Ladder Subscription** — +$15 flat per slab sold
- **Folding Chair** — +1 turn-away per show

### Tier 2 — Booth (odd)
- **Free Candy Bowl** — +1 buyer per show, but all budgets −10%
- **Nostalgia Playlist** — Nostalgia Buyers and Personal Collectors: +4 Interest
- **Loud Neighbor** — all buyers −1 patience, all offers +50%
- **Fake Grail Display** — hold one unsellable card in the case; every pitch gains +1 Interest
- **Handwritten Signage** — Kid and Bulk Guy budgets doubled
- **Half-Price Bin** — pitches of 5 cards gain +3 Interest, pitches of 1 lose 2

### Tier 3 — People (weird)
- **Uncle Gary** — 25% chance to scare off a buyer entirely; if he doesn't, the sale is ×2
- **The Regular** — every 4th buyer is replaced by a guaranteed Personal Collector matched to your most-held subject
- **Guy Who Only Asks About Grading** — every raw card sold has a 20% chance to return to Inventory as a slab
- **Rival Vendor** — you see their pitch first; match the pitch type for +5 Interest, differ for −2
- **Mall Kid With A Binder** — after each sale, swap one case card for a random Inventory card, free
- **Show Promoter's Nephew** — table fee halved, quota +15%

Upgrades can be sold back at 50% of purchase price.

---

## 9. Technical Notes

**Stack:** Vite + React 19 + TypeScript. Zustand for game state. No backend — runs and meta-progression persist to localStorage.

**Architecture priorities:**
- Scoring must be a **pure function**: `resolvePitch(cards, buyer, upgrades, conditions) → PitchResult`. Fully unit-testable with no React dependency. This is the single most important boundary in the codebase.
- Upgrades are **data + hook handlers**, not special cases in the scoring function. Define lifecycle hooks (`onPitchScore`, `onSale`, `onShowStart`, `onBuyerArrive`, `onDraw`) and let each upgrade register against them.
- Seeded RNG throughout so runs are reproducible and bugs are repeatable.
- Card art is procedural — CSS gradients and generated patterns keyed to `franchise` + `rarity`. **Structure the card component so the visual layer is swappable for sprites later without touching layout or game logic.**

**Build order:**
1. Card model, value calculation, pitch type detection
2. `resolvePitch` + unit tests. Tune numbers here before any UI exists
3. Single show loop: draw, pitch, haggle, resolve, quota check
4. Shop and inventory persistence between shows
5. Upgrade hook system + first 10 upgrades
6. Show conditions + endless scaling
7. Remaining upgrades, run stats, polish

---

## 10. Open Items

Flagged as assumptions I made rather than decisions you gave me:

- **4 buyers per show** — may be too few for pitch variety to breathe. Test 5.
- **Grading resolves instantly.** A multi-show turnaround is more authentic and adds planning tension, but complicates the shop UI. Instant for v1.
- **Inventory is the deck and you draw randomly.** The alternative — hand-picking which cards to bring to each show — is more strategic but becomes tedious once inventory passes ~40 cards.
- **Pitch types are auto-detected.** Manual declaration would add bluffing depth but hurts readability.
- Endless has no meta-progression yet. Consider unlockable starting inventories or franchise-specific run modifiers once the core loop is fun.
