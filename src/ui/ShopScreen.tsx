import { useState } from 'react';
import { formatMoney } from '../game/cards/value';
import { PACK_TIERS, PRICE_GUIDE_MAX, SUPPLIES } from '../game/constants';
import { getUpgrade, sellbackValue } from '../game/upgrades/registry';
import { nextCaseCost, nextTableCost, rerollCost, upgradeSlotsFor } from '../game/shop/shop';
import { useRun } from '../state/runStore';
import { CardView } from './card/CardView';
import { GradedOverlay } from './GradedOverlay';
import { PackOverlay } from './PackOverlay';
import { StockOverlay } from './StockOverlay';
import { SuppliesOverlay } from './SuppliesOverlay';
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

  const buySingle = useRun((s) => s.buySingle);
  const rerollShop = useRun((s) => s.rerollShop);
  const buyPack = useRun((s) => s.buyPack);
  const buyUpgrade = useRun((s) => s.buyUpgrade);
  const sellUpgrade = useRun((s) => s.sellUpgrade);
  const buyPriceGuide = useRun((s) => s.buyPriceGuide);
  const buyTable = useRun((s) => s.buyTable);
  const buyCase = useRun((s) => s.buyCase);
  const leaveShop = useRun((s) => s.leaveShop);

  const [overlay, setOverlay] = useState<'stock' | 'supplies' | null>(null);

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
                        <div key={def.id} className={styles.gearCard} style={{ cursor: 'default' }}>
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

                  {owned.length > 0 && (
                    <>
                      <div className={styles.benchLabel} style={{ margin: '16px 0 8px' }}>
                        SELL BACK — HALF PRICE
                      </div>
                      <div className={styles.rowWrap}>
                        {owned.map((id) => {
                          const def = getUpgrade(id);
                          return (
                            <button
                              key={id}
                              className={styles.btnSm}
                              onClick={() => sellUpgrade(id)}
                              title={def.text}
                            >
                              {def.name} · +{formatMoney(sellbackValue(def))}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.sheetFlat}>
                <Band
                  title="Supplies"
                  note={
                    <button
                      className={styles.helpBtn}
                      onClick={() => setOverlay('supplies')}
                      aria-label="What are supplies for?"
                      title="What are supplies for?"
                    >
                      ?
                    </button>
                  }
                  goldTitle
                />
                <div className={styles.pad}>
                  <div className={styles.rowWrap}>
                    {SUPPLIES.map((supply) =>
                      supply.id === 'priceGuide' ? (
                        <button
                          key={supply.id}
                          className={styles.btnSm}
                          disabled={guidesFull || spendable < supply.cost}
                          onClick={buyPriceGuide}
                        >
                          {guidesFull
                            ? 'PRICE GUIDE · HELD'
                            : `${supply.name.toUpperCase()} ${formatMoney(supply.cost)}`}
                        </button>
                      ) : (
                        // Card-targeted, so buying happens against a card in
                        // the stock overlay rather than here.
                        <button
                          key={supply.id}
                          className={styles.btnSm}
                          onClick={() => setOverlay('stock')}
                        >
                          {supply.name.toUpperCase()} {formatMoney(supply.cost)}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.sheetFlat}>
                <Band
                  title="Tables &amp; cases"
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
      {overlay === 'supplies' && <SuppliesOverlay onClose={() => setOverlay(null)} />}
      <PackOverlay />
      <GradedOverlay />
    </div>
  );
}
