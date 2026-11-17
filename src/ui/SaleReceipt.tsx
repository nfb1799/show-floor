/**
 * The receipt: a sale replayed line by line, so the player watches the number
 * get built rather than just seeing a total change.
 *
 * It lives above the screens rather than inside the table, because the last
 * sale of a show closes the table — and that one is usually the biggest.
 * It never takes a click: the board underneath is live the whole time.
 */

import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../game/cards/value';
import type { SaleRecord } from '../game/show/showEngine';
import { useRun } from '../state/runStore';
import styles from './table.module.css';

const LINE_GAP_MS = 260;
const COUNT_MS = 650;
const LINGER_MS = 1200;

function round(n: number, places = 0): string {
  return Number(n.toFixed(places)).toLocaleString('en-US');
}

/** Counts from zero to `target` once `delay` has passed. */
function useCountUp(target: number, delay: number, duration: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    let start = 0;
    const tick = (now: number): void => {
      if (start === 0) start = now;
      const t = Math.min(1, Math.max(0, (now - start - delay) / duration));
      // Ease out: fast at first, settling on the figure.
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // rAF is suspended in a background tab; this lands the figure regardless.
    const land = window.setTimeout(() => setValue(target), delay + duration + 60);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(land);
    };
  }, [target, delay, duration]);

  return value;
}

interface Line {
  readonly label: string;
  readonly value: string;
  readonly hot?: boolean;
}

function linesFor(sale: SaleRecord): Line[] {
  const r = sale.result;
  const lines: Line[] = [
    { label: `${r.pitchTypeLabel} + ${sale.cards.length} card${sale.cards.length === 1 ? '' : 's'}`, value: round(r.value) },
    { label: 'Interest', value: `×${round(r.interest, 2)}` },
  ];

  if (r.cappedByBudget) {
    lines.push({ label: `Their ${formatMoney(r.budget)} cash, plus trade`, value: formatMoney(r.baseOffer) });
  } else {
    lines.push({ label: 'Their offer', value: formatMoney(r.baseOffer) });
  }

  if (r.buzzMult > 1) {
    lines.push({ label: 'Buzz', value: `×${round(r.buzzMult, 2)}`, hot: true });
  }
  if (sale.bonus !== 0) {
    lines.push({ label: 'Gear', value: `+${formatMoney(sale.bonus)}` });
  }
  return lines;
}

function Receipt({ sale }: { sale: SaleRecord }) {
  const lines = linesFor(sale);
  const countDelay = lines.length * LINE_GAP_MS;
  const amount = useCountUp(sale.amount, countDelay, COUNT_MS);
  const footDelay = countDelay + COUNT_MS;
  const life = footDelay + LINGER_MS;

  const buzzDelta = sale.buzzAfter - sale.buzzBefore;

  return (
    <div
      className={styles.receipt}
      style={{ ['--receipt-ms' as string]: `${life}ms` }}
      data-tour="receipt"
    >
      <div className={styles.receiptHead}>
        <span>SOLD · {sale.pitchTypeLabel}</span>
        <span>{sale.buyerLabel}</span>
      </div>
      <div className={styles.receiptBody}>
        {lines.map((line, i) => (
          <div
            key={i}
            className={styles.receiptLine}
            data-tone={line.hot ? 'hot' : undefined}
            style={{ animationDelay: `${i * LINE_GAP_MS}ms` }}
          >
            <span>{line.label}</span>
            <strong>{line.value}</strong>
          </div>
        ))}

        <div className={styles.receiptTotal}>
          <span className={styles.receiptTotalLabel}>BANKED</span>
          <span className={styles.receiptAmount}>+{formatMoney(amount)}</span>
        </div>

        <div className={styles.receiptFoot} style={{ animationDelay: `${footDelay}ms` }}>
          {buzzDelta > 0 && (
            <span className={styles.stamp}>
              HAPPY BUYER · BUZZ UP TO {sale.buzzAfter}
            </span>
          )}
          {buzzDelta === 0 && sale.walked.length === 0 && !sale.result.pleased && (
            <span className={styles.stamp} data-tone="flat">
              NOTHING THEY CAME FOR · BUZZ HOLDS
            </span>
          )}
          {sale.walked.map((label, i) => (
            <span key={i} className={styles.stamp} data-tone="bad">
              {label.toUpperCase()} WALKED · BUZZ −1
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SaleReceiptLayer() {
  const sale = useRun((s) => s.show?.lastSale ?? null);
  const phase = useRun((s) => s.phase);
  const [showing, setShowing] = useState<SaleRecord | null>(null);
  // Whatever sale is already on record when this mounts happened before the
  // page loaded — a resumed save should not replay it.
  const seen = useRef<number | null>(sale?.id ?? null);

  useEffect(() => {
    if (!sale) {
      // Sale ids restart with each show, so a new show must not be mistaken
      // for the last one's final sale.
      seen.current = null;
      return;
    }
    if (sale.id === seen.current) return;
    seen.current = sale.id;
    setShowing(sale);
    const lineCount = linesFor(sale).length;
    const timer = window.setTimeout(
      () => setShowing(null),
      lineCount * LINE_GAP_MS + COUNT_MS + LINGER_MS,
    );
    return () => clearTimeout(timer);
  }, [sale]);

  if (!showing) return null;
  if (phase !== 'inShow' && phase !== 'showResult') return null;
  return <Receipt key={showing.id} sale={showing} />;
}
