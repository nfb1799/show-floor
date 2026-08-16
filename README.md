# Show Floor

Browser roguelike deckbuilder about vending at trading card shows.

**▶ Play: https://nfb1799.github.io/show-floor/**

See `show-floor-design-doc.md` for the full design.

```bash
npm install
npm run dev
npm test
```

The dev server runs at http://localhost:5173/show-floor/ — the base path is
fixed rather than build-only so dev, `npm run preview` and the deployed site all
resolve assets identically.

## Deploying

Pushing to `main` builds and publishes via
[.github/workflows/deploy.yml](.github/workflows/deploy.yml). Tests gate the
deploy, so a red suite never reaches players.

Pages itself was enabled once, out of band — the workflow token cannot create
the site:

```bash
gh api --method POST repos/OWNER/REPO/pages -f build_type=workflow
```

Runs save to `localStorage`, so each playtester's progress is per-browser and
nothing is shared or collected.

## Build state

All seven steps of section 9 are done: card model, `resolvePitch`, the show
loop, the shop with localStorage persistence, the upgrade hook system with 40
upgrades, all 10 show conditions with endless scaling, and run stats.

## Layout

```
src/game/          pure game layer — no React imports anywhere below this line
  constants.ts     every tunable number in the game
  types.ts         data model + the modifier hook interfaces
  rng.ts           seeded RNG, always injected
  cards/           catalog, generation, value calculation
  buyers/          archetypes as data, buyer generation
  pitch/           pitch type detection, hook runners, resolvePitch
  upgrades/        40 booth upgrades across three tiers
  conditions/      the 10 show conditions + scheduling
  shop/            shop stock, packs, grading
  show/            the show loop as pure state transitions
  run/             run state, rumours, save/load
src/state/         Zustand shell; delegates every transition to game/
src/ui/            React. card/ splits layout from visuals — see below
```

## The modifier system

Booth Upgrades and Show Conditions are the same type (`Modifier`) and register
against the same seven hooks: `onShowStart`, `onDraw`, `onBuyerArrive`,
`onPitchScore`, `onOfferFinalize`, `onSale`, `onShowEnd`. Nothing in scoring or
the show engine knows any modifier id exists — callers only fold what the hooks
report, which is what keeps a 40-upgrade pool from turning `resolvePitch` into a
switch statement.

Two upgrades need a decision made when a buyer arrives to still hold when the
pitch is scored (Uncle Gary's coin flip, the Rival Vendor's pitch). They write a
tag with `fx.mark` and read it later, so no modifier holds mutable state and
every one stays a plain data object.

Every hook runner forks the RNG per modifier id, so equipping an unrelated
upgrade never shifts another one's luck.

`resolvePitch` takes an options object rather than the doc's four positional
arguments, because it also needs the live `offerRatio` (haggling mutates it),
the show index, and an injected RNG (some upgrades roll dice at score time).
It only ever *forks* from that RNG, so the caller's stream is never advanced and
the same input always produces the same result.

### Swapping card art for sprites

`ui/card/` is split three ways: `CardFrame` owns geometry and text, `CardArt`
owns every pixel of the procedural look, and `CardView` composes them. Moving to
sprites means changing the one line in `CardView.tsx` and deleting `CardArt.tsx`
and `art.module.css`. No layout or game code refers to either.

That boundary paid off during the price-guide redesign: the art went from
per-franchise gradients to one flat ink per *set* with rarity coded on a spine,
and the change was confined to `artSpec.ts` + `CardArt.tsx`.

## The price-guide look

The UI implements `Show Floor Redesign.dc.html` from the Claude Design project:
a printed pricing-annual aesthetic — flat ink blocks, 3px black rules, hard
offset shadows with no blur, square corners throughout. Bungee sets numerals and
display type, Barlow Semi Condensed the labels, Barlow the body.

Tokens live at the top of [styles.css](src/styles.css); the repeated chrome
(sheets, coloured bands, tracks, pip rows) is in [kit.tsx](src/ui/kit.tsx).

A show is one screen with overlays: **The Table** carries the board, and
haggling is a dismissible panel over it rather than a separate screen. The
mock's dedicated "Sold" screen is gone — a sale animates the board in place.

Two deliberate departures from the mock:

- The mock stamps slabs `PSA n`. PSA is a real grading company, and the doc
  requires everything on a card to be invented, so slabs read `GRADED n`.
- The mock's HUD labels the undrawn-stock counter `CASE` while the card grid is
  also called `THE CASE`. The counter reads `STOCK` here.

The mock also shows the whole waiting queue with wants exposed, labelled as
Price Guide Binder output. That made the binder reveal the *entire* remaining
line rather than just the next buyer — a modest buff to a $120 tier-1 upgrade,
and its rules text was updated to match.

## Decisions taken against the doc

The doc left these open or self-contradictory. Each is tunable in `constants.ts`.

| Item | Resolution |
|---|---|
| 2-card and 4-card pitches matching no row in the table | `Loose Cards` is valid for any 1–5 cards (labelled "Loose Single" at one), so no selection is ever unscoreable |
| Interest written as `×N` but summed in the Appeal formula | Two channels: additive bonuses summed and floored at 1, then multiplicative modifiers |
| Flipper's "value ≥ 2× offer" is unsatisfiable, not just circular | Archetype cut and replaced with the Type Collector — see below |
| "Bundle: 3 cards sharing any one attribute" | Attributes are subject, franchise, set only — including rarity or slabbed would make almost any 3 cards a Bundle |
| Graded Run trivially satisfiable at 100/×6 | Also requires one franchise |
| Display case never refilled in the doc | Refills to 8 after each resolved buyer |
| Turning a buyer away consumes the buyer slot | It does not; it replaces them. Consuming the slot leaves 1 sale against a hard quota |
| Nostalgia Buyer's "oldest set in the pool" | Sets carry a release year; vintage is a cutoff resolved at buyer generation |
| `condition?` and `grade?` both optional on one interface | Discriminated union on `slabbed` |
| Set Builder's slab refusal present in §3, absent in §5 | Kept the refusal |
| Investor's want has no Interest number | +5, in line with every other archetype |
| Buyer budgets given only as "Medium"/"High" | Concrete starting numbers in `constants.ts` |
| Kid's budget is "$20" but all budgets scale | It scales like everything else; the archetype is labelled "Kid" rather than "Kid with $20" |
| Setup shows a rumour before the crowd exists | The buyer queue comes from a per-show RNG fork, so the rumour is a truthful peek rather than a guess |
| Doc lists 18 upgrades but asks for ~40 | 22 more written in the same three-tier spirit |

## The Flipper was impossible, and is now gone

The doc's Flipper wants "total card value ≥ 2× the offer, or ×0.5 Interest".
That is unsatisfiable. The offer *contains* the card value, so with the weakest
possible pitch the test reduces to:

```
V >= 2 * (P + V) * 1 * 0.7   ->   -0.4V >= 1.4P   ->   no solution
```

The ceiling is `1/(ratio × offerRatio)` = 71% of the bar, and any pitch type
with interest above 1 pushes it further away — so building a good pitch made him
*harder*. A simulation across shows 1–12 confirmed it: 0/40 seeds satisfied at
every show, best attainable 70%, flat forever. He sat permanently at ×0.5.
Gating him to later shows would not have helped.

A per-card value bar kept him playable for a while, but he never earned his slot:
"expensive cards are worth more" is what the value formula already says, so he
asked for nothing the player was not doing anyway. He is replaced by the **Type
Collector**, who pays **+4 Interest per *distinct* franchise in the pitch** and
nothing for repeats.

That gives the archetype an actual decision behind it. Collection depth rewards
holding many cards of one franchise; the Type Collector is the only buyer who
wants the opposite, so a box tuned for depth reads badly to them and a spread
hand reads badly to a Full Case. Both are countable straight off the faces.

The **Personal Collector** moved the same direction: they now collect a
*franchise* rather than one named subject. A specific subject was a lottery — you
either happened to hold that one card or you did not, and there was no play in
between. A franchise is something a box can be built toward, and it shares its
vocabulary with the Full Case pitch type and collection depth.

## Playtest fixes, round two

**The shop could softlock the run.** Spending below the next table fee left the
player unable to open the show *and* unable to end the run. `startShow()` had
always handled it — a `bankroll < fee` branch that ends the run — but
`SetupScreen` disabled the only button that calls it, so the branch was
unreachable dead code. Two guards for the same condition, and the outer one
silently disabled the inner one.

Fixed at both ends. The shop now holds the next fee back: `spendable()` is
bankroll minus a reserve, and every purchase checks against that, with the
reserve shown in the shop header so greyed-out prices have a visible reason.
Next show's fee is knowable at shop time because conditions come from a pure RNG
fork, so a tripled Convention Center is priced in. And the setup button is never
disabled — when the fee cannot be covered it reads *Pack up · end the run* and
takes the existing branch, which also rescues saves already stuck.
[runStore.test.ts](src/state/runStore.test.ts) covers both halves.

**Supplies and stock moved out of the shop's main flow.** Grading, sleeves and
toploaders are all card-targeted, so they live in a stock overlay behind a
*Your stock* button; the shop sells, the overlay works on what you own. Supplies
also carry a `why` alongside their rules text, surfaced through a `?` explainer —
previously nothing said why you would ever buy one.

**Price Guides are capped at one.** They are consumed one per show, so
stockpiling only drained money. The button now reads *held* while you have one.

**Packs are opened, not absorbed.** Buying a pack stages the cards rather than
banking them: they flip in one at a time and the player sorts the pull, keeping
what is worth carrying and listing the rest online at 70% of face value. Any
card in stock can be listed the same way — always available, never the best
price. The pending pack is persisted, so a paid-for pack survives a reload.

**Grading reveals what came back.** Submitting a card opens a reveal that holds
on "waiting on the grader" before showing the grade and what it did to the
card's value. No decision here — the slab is already yours.

**Supplies stopped being a shop section at all.** A panel of consumables you
bought blind and applied later was one hop too many, so it is gone. Sleeving is
now an action on a card in your stock, priced against that card's condition:
$15 out of Played, $30 out of Lightly Played, $65 out of Near Mint. The steps
are not worth the same — Near Mint to Mint adds 0.3x of a card already worth
2.5x as much — so a flat fee made the top step an automatic buy and the bottom
step a waste. Toploaders are cut entirely; the only thing they protected against
was one show condition, and paying up front against a maybe was never a real
decision. The Price Guide, the one remaining consumable, sits with the tables
and cases.

**There is an optional tutorial.** Six pages, opened automatically for anyone
with no save and no history, and reachable from the title screen afterwards. It
teaches with the real widgets — a real `CardView`, a real `BuyerPanel`, and a
real `Tally` fed by an actual `resolvePitch` call — so a scoring change updates
the worked example rather than silently invalidating it. The pitch-type table is
printed straight out of `PITCH_TYPES`, which is the one thing the game never
showed anywhere: ten types the player was expected to discover by accident.

The worked example is deliberately a Pair. Anything stronger multiplies several
times past a plausible buyer's wallet, and a first example ending in "$1,282
left on the table" teaches that the numbers are broken rather than that the cap
is real. A Pair overshoots by $42, which is the actual lesson — build to the
wallet, not past it.

**Gear explains itself on hover, and a full booth swaps.** Everywhere a piece of
gear appears it carries its rules text as a tooltip, including on the bench where
only the name fits. Clicking a benched piece with no free slot used to do
nothing; it now goes on the front and the oldest piece falls off the end.

**Assorted clarity.** *Toploader Stack* is now *Box of Toploaders*, and its
rules text says what it does — "every raw card sells as if it were Near Mint,
however beaten it actually is" — rather than referring to "condition penalties"
the player has never seen named. The page is off-white newsprint rather than green felt, so
the quota track (darker bed, 3px rule) and the queue hint (ink on paper, and it
now says what the binder reveals) both read. Slabs stamp `GRADED n` rather than
an invented grading house, since it just says what the thing is. The haggle overlay is
centred. The word "gamble" is gone.

## Playtest fixes, round one

**The first run was unwinnable, and the numbers said so.**
[balance.test.ts](src/game/run/balance.test.ts) plays real shows with a
brute-force best-pitch player — the ceiling a human approaches but never beats.
Under the doc's numbers that ceiling produced per-buyer offers of `78, 95, 87,
86`: *every* buyer capped at their budget from show 1. Pitch quality was already
irrelevant, only the cap mattered, and quota grew 1.55× against a 1.35× budget
curve, so show 3 cleared 5 times in 24 even at perfect play.

Quota now starts at 180 and grows 1.38× — just above budgets rather than far
above — and base budgets rose so a good pitch has room to beat a mediocre one.
Shows 1–3 clear reliably at every skill level; the pressure comes from inventory
drain, which is what the doc actually asks for.

**Patience was a dominated choice, and is now Goodwill.** Pushing cost a pip and
raised the ratio, with the walk only at zero — so the optimal line was always
"push to zero, then accept". No decision. Pushing now also shrinks the buyer's
wallet by 15%, which means it pays against an uncapped buyer and *costs* you
against a capped one. The overlay prints the projected offer on the button, so
the read is visible rather than guessed. Renamed to Goodwill because "patience"
implied a clock the game does not have.

**Vintage is now readable.** Every card face prints its set year, highlighted in
gold when it is at or under the cutoff, and the want reads "Anything printed 1990
or earlier" instead of "Vintage sets".

**The board never scrolls.** Every screen is a fixed 100vh; the case row takes
the leftover height and cards scale to fill it. Long panels (shop stock, end-run
stats) scroll inside themselves rather than handing a scrollbar to the page.

**Card faces are sized to be read.** Type is set in `cqw` against the card's own
width, so a bigger card is genuinely more legible rather than just larger. The
year was previously `float: right`, which let it drop out of its row and shove
the price sideways; the data block is flex rows now. On short viewports the
buyer panel becomes a horizontal strip so the case keeps the height.

**The card face is ordered by decision value, not by identity.** The subject
name used to be the largest element on the card in display type, despite driving
only three things (Playset, Personal Collector, The Grail). Worse, **franchise
was not printed at all** — even though Full Case, Graded Run and The Grail all
key on it, so the player could not see the attribute three pitch types depend on.

The face now reads as a price-guide entry, in priority order:

| Element | Size | Why it matters |
|---|---|---|
| **Price** | 30px Bungee | the number every pitch is judged on |
| Rarity | 12px, in rarity ink | Rainbow, Holo Wall, Kid |
| Franchise | 13px | Full Case, Graded Run, The Grail, Bundle |
| Year | 13px, gold when vintage | Nostalgia Buyer |
| Set + number | 13px | Pair, Bundle, Set Run, Set Builder |
| Condition / grade | stamp on the art | Grader, Investor, and value itself |
| Subject | 15px condensed, on the art | Playset, Personal Collector, The Grail |

The set name drops its franchise prefix since the franchise sits directly above
it — `Bullpen / '76 #1` rather than `Bullpen '76 #1` twice over.

**Haggling is an overlay, not a screen.** It sits over the table and collapses to
a bar so the case, queue and quota stay readable while deciding. Pitched cards
render at full case fidelity.

**The sold screen is gone.** A sale updates the board in place: the quota bar
slides, the earned figure bumps, and a stamp rises and fades.

## The budget wall, and what carries the run past it

Budget is a hard cap on money received, so maximum show revenue is
`buyers × avgBudget × 1.35^(n-1)` while quota is `250 × 1.55^(n-1)`. No amount
of Interest crosses a hard cap — once a buyer is capped, marginal Interest is
worth exactly zero — so these numbers set a wall skill alone cannot pass.

**Cap-breaking upgrades are the answer.** `onOfferFinalize` runs after the cap
and is the only channel that can pay past a buyer's budget. Budget growth stays
deliberately below quota growth to create that demand.

After the playtest retune, quota growth (1.38) only slightly outpaces budget
growth (1.35), so cap-breaking is no longer a survival tax — the arithmetic
requirement peaks around 0.41× of the theoretical ceiling at show 12 and falls
after that, since the softened quota growth (1.30) is *below* budget growth.

That makes cap-breaking a build choice rather than a toll: it is how a strong
run pulls ahead, not how an average run avoids death. A six-upgrade stack still
reaches about 3.5×, which
[upgrades.test.ts](src/game/upgrades/upgrades.test.ts) guards, so the ceiling on
a dedicated build stays high.

The real late-game pressure is inventory drain — cards sold are gone, and the
quota keeps climbing, so shop spending competes directly with banked score.
Tuning shows past ~5 properly needs a full-run simulation that models shop
behaviour; the current guards only cover the opening.

## Other things worth knowing before tuning

**Additive interest penalties vanish at the floor.** `MIN_INTEREST` clamps
`base + adds` at 1 before multipliers, so Half-Price Bin's "-2 Interest on
single-card pitches" does nothing to a bare Loose Single, which is already at 1.
The downside only bites once a want or another upgrade has lifted interest off
the floor. Same applies to any future additive penalty.

**Grading a `played` card is not a gamble.** `played` rolls grades 1–6 and
`GRADE_MULT_FLOOR_AT` flattens all six to ×0.8, so the outcome is deterministic:
a guaranteed doubling from ×0.4 raw. Only the fee keeps it in check, and at the
top end it is marginally profitable. If grading is meant to be a gamble at every
condition, the floor needs to move.

**Consignment Deal is bounded on purpose.** Recovering 25% of the budget-cap gap
is unbounded in principle, and late on the gap is enormous, so it is capped at
one more budget's worth. Without that bound it single-handedly answers the wall.
