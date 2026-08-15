/**
 * Your stock: grade a card, or list one online.
 *
 * Sleeves and toploaders are bought from the shop's Supplies panel and then
 * applied here, so this overlay owns everything that acts on a card you already
 * own.
 */

import { useState } from 'react';
import { cardValue, formatMoney } from '../game/cards/value';
import { SUPPLIES } from '../game/constants';
import { gradingFee, gradingOutcomeRange } from '../game/shop/grading';
import { onlineValue } from '../game/shop/shop';
import { useRun } from '../state/runStore';
import { CardView } from './card/CardView';
import { Band } from './kit';
import type { Card } from '../game/types';
import styles from './app.module.css';

type Tool = 'grade' | 'sell' | 'sleeve' | 'toploader';

const SLEEVE = SUPPLIES.find((s) => s.id === 'sleeve')!;
const TOPLOADER = SUPPLIES.find((s) => s.id === 'toploader')!;

const TOOL_HELP: Record<Tool, string> = {
  grade:
    'Sends a raw card away and returns it as a slab. Higher condition rolls higher grades. ' +
    'Slabs are worth far more, but Set Builders and Kids refuse them outright.',
  sell: 'Lists a card online below face value. Always available, never the best price.',
  sleeve: `${SLEEVE.text} Condition multiplies value, so this pays best on your dearest raw cards.`,
  toploader: TOPLOADER.text,
};

export function StockOverlay({ onClose }: { onClose: () => void }) {
  const inventory = useRun((s) => s.inventory);
  const spendable = useRun((s) => s.spendable());
  const submitForGrading = useRun((s) => s.submitForGrading);
  const applySupply = useRun((s) => s.applySupply);
  const sellOnline = useRun((s) => s.sellOnline);

  const [tool, setTool] = useState<Tool | null>(null);

  const costFor = (card: Card): number => {
    if (tool === 'sell') return 0;
    if (card.slabbed) return Infinity;
    if (tool === 'grade') return gradingFee(card);
    if (tool === 'sleeve') return SLEEVE.cost;
    if (tool === 'toploader') return TOPLOADER.cost;
    return Infinity;
  };

  const canUse = (card: Card): boolean => {
    if (tool === null) return false;
    if (tool === 'sell') return true; // anything can be listed
    return !card.slabbed && spendable >= costFor(card);
  };

  const apply = (cardId: string): void => {
    if (tool === 'grade') submitForGrading(cardId);
    else if (tool === 'sell') sellOnline(cardId);
    else if (tool) applySupply(tool, cardId);
    setTool(null);
  };

  const sorted = [...inventory].sort((a, b) => cardValue(b) - cardValue(a));
  const totalValue = inventory.reduce((sum, c) => sum + cardValue(c), 0);

  const toolButton = (id: Tool, label: string) => (
    <button
      key={id}
      className={styles.btnSm}
      data-active={tool === id}
      onClick={() => setTool(tool === id ? null : id)}
    >
      {label}
    </button>
  );

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.stockPanel} onClick={(e) => e.stopPropagation()}>
        <Band
          title={`Your stock · ${inventory.length} cards · ${formatMoney(totalValue)} on paper`}
          note={
            <button className={styles.btnSm} onClick={onClose} style={{ padding: '3px 10px' }}>
              CLOSE
            </button>
          }
          goldTitle
        />

        <div className={styles.stockTools}>
          {toolButton('grade', 'GRADE A CARD')}
          {toolButton('sell', 'SELL ONLINE')}
          {toolButton('sleeve', `${SLEEVE.name.toUpperCase()} ${formatMoney(SLEEVE.cost)}`)}
          {toolButton('toploader', `${TOPLOADER.name.toUpperCase()} ${formatMoney(TOPLOADER.cost)}`)}
          <span className={styles.stockBudget}>{formatMoney(spendable)} spendable</span>
        </div>

        {tool && (
          <div className={styles.stockHelp}>
            <strong>{TOOL_HELP[tool]}</strong> Pick a card below.
          </div>
        )}

        <div className={styles.stockGrid}>
          {inventory.length === 0 && (
            <p className={styles.dim}>Nothing in stock. Buy singles or a pack.</p>
          )}
          {sorted.map((card) => {
            const usable = canUse(card);
            const range = !card.slabbed && tool === 'grade' ? gradingOutcomeRange(card) : null;
            return (
              <div key={card.id} className={styles.shopItem}>
                <CardView
                  card={card}
                  size="small"
                  disabled={tool !== null && !usable}
                  {...(usable ? { onClick: () => apply(card.id) } : {})}
                />
                {tool === 'sell' && (
                  <span className={styles.toolNote}>+{formatMoney(onlineValue(card))}</span>
                )}
                {tool && tool !== 'sell' && !card.slabbed && (
                  <span className={styles.toolNote}>
                    {formatMoney(costFor(card))}
                    {range &&
                      (range.low === range.high
                        ? ` → ${formatMoney(range.low)}`
                        : ` → ${formatMoney(range.low)}–${formatMoney(range.high)}`)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
