import { useMemo, useState } from 'react';
import { formatMoney } from '../game/cards/value';
import { PACK_TIERS, PRICE_GUIDE_COST, PRICE_GUIDE_MAX } from '../game/constants';
import { nextCaseCost, nextTableCost, rerollCost, upgradeSlotsFor } from '../game/shop/shop';
import { conditionsForShow } from '../game/conditions/registry';
import { useRun } from '../state/runStore';
import { CardView } from './card/CardView';
import { GradedOverlay } from './GradedOverlay';
import { PackOverlay } from './PackOverlay';
import { StockOverlay } from './StockOverlay';
import { Band, ScreenHead, Sheet } from './kit';
import styles from './app.module.css';


export function ShopScreen() {
  const shop = useRun((s) => s.shop);
  const bankroll = useRun((s) => s.bankroll);
  const spendable = useRun((s) => s.spendable());
  const reserved = useRun((s) => s.reservedForFee());
  const inventory = useRun((s) => s.inventory);
  const owned = useRun((s) => s.ownedUpgradeIds);
  const tableTier = useRun((s) => s.tableTier);
  const casesBought = useRun((s) => s.casesBought);
  const priceGuides = useRun((s) => s.priceGuides);
  const showIndex = useRun((s) => s.showIndex);
  const seed = useRun((s) => s.seed);

  const buySingle = useRun((s) => s.buySingle);
  const rerollShop = useRun((s) => s.rerollShop);
  const buyPack = useRun((s) => s.buyPack);
  const buyUpgrade = useRun((s) => s.buyUpgrade);
  const buyPriceGuide = useRun((s) => s.buyPriceGuide);
  const buyTable = useRun((s) => s.buyTable);
  const buyCase = useRun((s) => s.buyCase);
  const leaveShop = useRun((s) => s.leaveShop);

  const [overlay, setOverlay] = useState<'stock' | null>(null);

  // Computed here rather than through a store selector: a selector returning a
  // fresh array fails Zustand's Object.is check every render and loops React.
  const nextConditions = useMemo(
    () => conditionsForShow(seed, showIndex + 1),
    [seed, showIndex],
  );

  if (!shop) return null;

  const tableCost = nextTableCost(tableTier);
  const caseCost = nextCaseCost(casesBought);
  const reroll = rerollCost(shop);
  const guidesFull = priceGuides >= PRICE_GUIDE_MAX;

  return (
    <div className={`${styles.shell} ${styles.wide}`}>
      <ScreenHead
        n="05"
        title="BETWEEN SHOWS"
        note="Restock and upgrade the booth. Then back to the floor."
      />

      <Sheet className={styles.fillSheet}>
        <div className={styles.hallBand}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <span className={styles.hallName}>THE BACK ROOM</span>
            <span className={styles.hallWhen}>AFTER SHOW {String(showIndex).padStart(2, '0')}</span>
          </div>
          <div style={{ display: 'flex', gap: 26, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div className={styles.hallStatLabel}>BANKROLL</div>
              <div className={styles.hallStatValue}>{formatMoney(bankroll)}</div>
            </div>
            {/* The reserve is why some prices are greyed out; say so plainly. */}
            <div>
              <div className={styles.hallStatLabel}>HELD FOR NEXT TABLE</div>
              <div className={styles.hallStatValue} style={{ color: 'var(--gold)' }}>
                −{formatMoney(reserved)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={styles.hallStatLabel}>SPENDABLE</div>
              <div className={styles.hallStatValue} style={{ color: '#8ee0a8' }}>
                {formatMoney(spendable)}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.scrollPane} style={{ padding: 18 }}>
          {/* The next show's house rules can move the table fee — a tripled
              Convention Center fee is the difference between a comfortable
              shop and a dead run — so they are announced before you spend. */}
          {nextConditions.length > 0 && (
            <div className={styles.conditionStrip} style={{ marginBottom: 16 }}>
              {nextConditions.map((c) => (
                <div key={c.id} className={styles.conditionCard}>
                  <Band title={`Next show · ${c.name}`} ink="red" />
                  <div className={styles.conditionBody}>
                    <div className={styles.conditionText}>{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.shopCols}>
            {/* Left column ------------------------------------------- */}
            <div className={styles.stack}>
              <div className={styles.sheetFlat}>
                <Band
                  title="Singles &amp; slabs"
                  note={
                    <button
                      className={styles.btnSm}
                      onClick={rerollShop}
                      disabled={spendable < reroll}
                      style={{ padding: '4px 10px' }}
                    >
                      REROLL {formatMoney(reroll)}
                    </button>
                  }
                  goldTitle
                />
                <div className={styles.pad}>
                  <div className={styles.shopShelf}>
                    {shop.singles.map((single) => (
                      <div key={single.card.id} className={styles.shopItem} data-sold={single.sold}>
                        <CardView card={single.card} showPrice={false} />
                        <button
                          className={styles.btnSm}
                          disabled={single.sold || spendable < single.price}
                          onClick={() => buySingle(single.card.id)}
                        >
                          {single.sold ? 'SOLD' : formatMoney(single.price)}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.sheetFlat}>
                <Band title="Packs" note="SEALED — YOU SEE WHAT YOU PULL" goldTitle />
                <div className={styles.pad}>
                  <div className={styles.rowWrap}>
                    {PACK_TIERS.map((tier) => (
                      <div key={tier.id} className={styles.packCard}>
                        <div className={styles.gearName}>{tier.name}</div>
                        <div className={styles.gearText}>{tier.blurb}</div>
                        <button
                          className={styles.btnSm}
                          disabled={spendable < tier.cost}
                          onClick={() => buyPack(tier.id)}
                        >
                          {formatMoney(tier.cost)}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right column ------------------------------------------ */}
            <div className={styles.stack}>
              <div className={styles.sheetFlat}>
                <Band title="Booth gear" note={`${owned.length} OWNED`} goldTitle />
                <div className={styles.pad}>
                  <div className={styles.gearGrid} style={{ padding: 0 }}>
                    {shop.upgrades.map((def) => {
                      const bought =
                        shop.purchasedUpgradeIds.includes(def.id) || owned.includes(def.id);
                      return (
                        <div
                          key={def.id}
                          className={`${styles.gearCard} ${styles.tip} ${styles.tipBelow}`}
                          style={{ cursor: 'default' }}
                          data-tip={def.text}
                        >
                          <div className={styles.gearTag} data-state={bought ? 'bench' : undefined}>
                            TIER {def.tier}
                          </div>
                          <div className={styles.gearBody}>
                            <div className={styles.gearName}>{def.name}</div>
                            <div className={styles.gearText}>{def.text}</div>
                          </div>
                          <div style={{ padding: '0 14px 12px' }}>
                            <button
                              className={styles.btnSm}
                              disabled={bought || spendable < def.cost}
                              onClick={() => buyUpgrade(def.id)}
                            >
                              {bought ? 'OWNED' : formatMoney(def.cost)}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>

              <div className={styles.sheetFlat}>
                <Band
                  title="Table, cases &amp; guide"
                  note={`${upgradeSlotsFor(tableTier)} GEAR SLOTS`}
                  goldTitle
                />
                <div className={styles.pad}>
                  <div className={styles.rowWrap}>
                    <button
                      className={styles.btnSm}
                      disabled={tableCost === null || spendable < tableCost}
                      onClick={buyTable}
                    >
                      {tableCost === null
                        ? 'TABLES MAXED'
                        : `ANOTHER TABLE · ${upgradeSlotsFor(tableTier + 1)} SLOTS · ${formatMoney(tableCost)}`}
                    </button>
                    <button
                      className={styles.btnSm}
                      disabled={caseCost === null || spendable < caseCost}
                      onClick={buyCase}
                    >
                      {caseCost === null ? 'CASE MAXED' : `+1 CASE SLOT · ${formatMoney(caseCost)}`}
                    </button>
                    {/* The guide is the one consumable left now that sleeving
                        is priced against a specific card in your stock. */}
                    <button
                      className={styles.btnSm}
                      disabled={guidesFull || spendable < PRICE_GUIDE_COST}
                      onClick={buyPriceGuide}
                      title="Reveals the next show's four buyers - their budgets and what they want - before you pay the table fee. Spent on that show."
                    >
                      {guidesFull
                        ? 'PRICE GUIDE · HELD'
                        : `PRICE GUIDE · ${formatMoney(PRICE_GUIDE_COST)}`}
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.shopActions}>
                <button className={styles.btn} data-ink="gold" onClick={() => setOverlay('stock')}>
                  YOUR STOCK · {inventory.length}
                </button>
                <button className={styles.btn} onClick={leaveShop}>
                  ON TO SHOW {String(showIndex + 1).padStart(2, '0')} →
                </button>
              </div>
            </div>
          </div>
        </div>
      </Sheet>

      {overlay === 'stock' && <StockOverlay onClose={() => setOverlay(null)} />}
      <PackOverlay />
      <GradedOverlay />
    </div>
  );
}
