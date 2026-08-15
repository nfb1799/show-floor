/**
 * Your stock. Click a card to act on it.
 *
 * The tool-first version put a toolbar on top and made you pick a mode before
 * picking a card, which meant the card you were deciding about was the thing
 * you could not see properly. This is card-first: choose the card, then see
 * every option priced against it.
 */

import { useState } from 'react';
import { cardValue, formatMoney } from '../game/cards/value';
import { CONDITION_ORDER, SLEEVE_COST } from '../game/constants';
import { collectionDepth } from '../game/run/collection';
import { gradingFee, gradingOutcomeRange } from '../game/shop/grading';
import { onlineValue } from '../game/shop/shop';
import { useRun } from '../state/runStore';
import { CardView } from './card/CardView';
import { Band } from './kit';
import type { Card } from '../game/types';
import styles from './app.module.css';

/** Spelled out here: the card face prints the abbreviation, a price needs words. */
const CONDITION_NAME: Record<string, string> = {
  played: 'Played',
  lightlyPlayed: 'Lightly Played',
  nearMint: 'Near Mint',
  mint: 'Mint',
};

function CardActions({ card, onDone }: { card: Card; onDone: () => void }) {
  const spendable = useRun((s) => s.spendable());
  const submitForGrading = useRun((s) => s.submitForGrading);
  const sleeveCard = useRun((s) => s.sleeveCard);
  const sellOnline = useRun((s) => s.sellOnline);

  const raw = !card.slabbed;
  const fee = raw ? gradingFee(card) : 0;
  const range = raw ? gradingOutcomeRange(card) : null;

  // Sleeving is priced by the step it buys, and Mint has no step left.
  const sleeveCost = card.slabbed ? undefined : SLEEVE_COST[card.condition];
  const sleeveTo = card.slabbed
    ? undefined
    : CONDITION_ORDER[CONDITION_ORDER.indexOf(card.condition) + 1];

  const act = (fn: () => void): void => {
    fn();
    onDone();
  };

  return (
    <div className={styles.cardDetail}>
      <div className={styles.cardDetailArt}>
        <CardView card={card} />
      </div>

      <div className={styles.cardDetailActions}>
        <div>
          <div className={styles.lbl}>Face value</div>
          <div className={styles.num} style={{ fontSize: 30 }}>
            {formatMoney(cardValue(card))}
          </div>
        </div>

        {raw ? (
          <button
            className={styles.btnSm}
            disabled={spendable < fee}
            onClick={() => act(() => submitForGrading(card.id))}
          >
            GRADE · {formatMoney(fee)}
            {range && (
              <span className={styles.actionHint}>
                {range.low === range.high
                  ? ` → ${formatMoney(range.low)}`
                  : ` → ${formatMoney(range.low)}–${formatMoney(range.high)}`}
              </span>
            )}
          </button>
        ) : (
          <div className={styles.dim}>Already slabbed — grading is done.</div>
        )}

        {raw &&
          (sleeveCost !== undefined && sleeveTo !== undefined ? (
            <button
              className={styles.btnSm}
              disabled={spendable < sleeveCost}
              onClick={() => act(() => sleeveCard(card.id))}
            >
              SLEEVE · {formatMoney(sleeveCost)}
              <span className={styles.actionHint}>
                {' '}
                {CONDITION_NAME[card.condition]} to {CONDITION_NAME[sleeveTo]}
              </span>
            </button>
          ) : (
            <div className={styles.dim}>Mint already — sleeving has nothing to add.</div>
          ))}

        <button className={styles.btnSm} onClick={() => act(() => sellOnline(card.id))}>
          SELL ONLINE · +{formatMoney(onlineValue(card))}
        </button>

        <button className={styles.btn} data-ink="paper" onClick={onDone}>
          BACK
        </button>
      </div>
    </div>
  );
}

export function StockOverlay({ onClose }: { onClose: () => void }) {
  const inventory = useRun((s) => s.inventory);
  const spendable = useRun((s) => s.spendable());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = [...inventory].sort((a, b) => cardValue(b) - cardValue(a));
  const totalValue = inventory.reduce((sum, c) => sum + cardValue(c), 0);
  const selected = inventory.find((c) => c.id === selectedId) ?? null;
  // Depth lives here rather than on the setup screen: this is the only place
  // it is actionable, because this is where you buy and sell.
  const depth = collectionDepth(inventory);

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.stockPanel} onClick={(e) => e.stopPropagation()}>
        <Band
          title={`Your stock · ${inventory.length} cards · ${formatMoney(totalValue)} on paper`}
          note={
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span>{formatMoney(spendable)} SPENDABLE</span>
              <button className={styles.btnSm} onClick={onClose} style={{ padding: '3px 10px' }}>
                CLOSE
              </button>
            </span>
          }
          goldTitle
        />

        {selected ? (
          <CardActions card={selected} onDone={() => setSelectedId(null)} />
        ) : (
          <>
            {depth.length > 0 && (
              <div className={styles.depthStrip}>
                <span className={styles.lbl}>Depth</span>
                {depth.map((entry) => (
                  <span
                    key={entry.franchiseId}
                    className={styles.depthChip}
                    data-active={entry.interestPerCard > 0}
                    title={
                      entry.interestPerCard > 0
                        ? `Every ${entry.name} card in a pitch adds +${entry.interestPerCard} Interest.`
                        : `Hold ${entry.nextAt} ${entry.name} cards to make them pitch harder.`
                    }
                  >
                    {entry.name} <strong>{entry.count}</strong>
                    {entry.interestPerCard > 0 ? (
                      <em className={styles.depthChipBonus}>+{entry.interestPerCard}/card</em>
                    ) : (
                      entry.nextAt !== null && (
                        <em className={styles.depthChipNext}>{entry.nextAt - entry.count} to go</em>
                      )
                    )}
                  </span>
                ))}
              </div>
            )}

            <div className={styles.stockGrid}>
              {inventory.length === 0 && (
                <p className={styles.dim}>Nothing in stock. Buy singles or a pack.</p>
              )}
              {sorted.map((card) => (
                <CardView
                  key={card.id}
                  card={card}
                  size="small"
                  onClick={() => setSelectedId(card.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
