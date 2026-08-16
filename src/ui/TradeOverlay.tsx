/**
 * Sorting a buyer's binder.
 *
 * When a pitch is worth more than the cash a buyer brought, they make up the
 * difference out of their own collection. This is where that lands: keep what
 * you can sell on your own table, list the rest online for less than it is
 * worth. It is the same bargain the pack overlay offers, arriving from the
 * other direction — you did not choose these cards, and they are shaped by
 * whatever that particular buyer collects.
 */

import { useEffect, useState } from 'react';
import { cardValue, formatMoney } from '../game/cards/value';
import { onlineValue } from '../game/shop/shop';
import { useRun } from '../state/runStore';
import { CardView } from './card/CardView';
import { Band } from './kit';
import styles from './app.module.css';

export function TradeOverlay() {
  const trade = useRun((s) => s.show?.pendingTrade ?? null);
  const resolveTrade = useRun((s) => s.resolveTrade);

  const [kept, setKept] = useState<string[]>([]);

  const cards = trade?.cards ?? [];

  // Keep everything by default: face value beats the online rate, so keeping is
  // the better answer unless the player has a reason to want the cash now.
  useEffect(() => {
    setKept(cards.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade]);

  if (!trade) return null;

  const listed = cards.filter((c) => !kept.includes(c.id));
  const payout = listed.reduce((sum, c) => sum + onlineValue(c), 0);
  const keptValue = cards
    .filter((c) => kept.includes(c.id))
    .reduce((sum, c) => sum + cardValue(c), 0);

  const toggle = (id: string): void =>
    setKept((k) => (k.includes(id) ? k.filter((x) => x !== id) : [...k, id]));

  return (
    <div className={styles.scrim}>
      <div className={styles.packPanel} data-tour="tradePanel">
        <Band
          title={`${trade.buyerLabel} opens their binder`}
          note={`${formatMoney(trade.value)} THEY COULD NOT COVER IN CASH · CLICK A CARD TO LIST IT INSTEAD`}
          ink="gold"
        />

        <div className={styles.packGrid}>
          {cards.map((card) => {
            const keeping = kept.includes(card.id);
            return (
              <div key={card.id} className={styles.packSlot} data-shown data-sold={!keeping}>
                <CardView card={card} size="small" onClick={() => toggle(card.id)} />
                <span className={styles.packTag} data-sold={!keeping}>
                  {keeping ? 'KEEP' : `LIST ${formatMoney(onlineValue(card))}`}
                </span>
              </div>
            );
          })}
        </div>

        <div className={styles.packFoot}>
          <div className={styles.dim}>
            {/* Both halves shown, because the whole decision is that a card is
                worth more kept than listed only if you can actually move it. */}
            {listed.length === 0
              ? `Taking all ${cards.length} into stock — ${formatMoney(keptValue)} of cards.`
              : `Keeping ${formatMoney(keptValue)} of cards, listing ${listed.length} for ${formatMoney(payout)}.`}
          </div>
          <div className={styles.rowWrap}>
            <button
              className={styles.btnSm}
              onClick={() => setKept([])}
              disabled={listed.length === cards.length}
            >
              LIST ALL
            </button>
            <button
              className={styles.btnSm}
              onClick={() => setKept(cards.map((c) => c.id))}
              disabled={listed.length === 0}
            >
              KEEP ALL
            </button>
            <button className={styles.btn} data-ink="gold" onClick={() => resolveTrade(kept)}>
              DONE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
