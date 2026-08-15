import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../game/cards/value';
import { MAX_PITCH_CARDS } from '../game/constants';
import { getConditions } from '../game/conditions/registry';
import { remainingQueue, type SaleRecord } from '../game/show/showEngine';
import { useRun } from '../state/runStore';
import { BuyerPanel } from './BuyerPanel';
import { BuyerQueue } from './BuyerQueue';
import { HaggleOverlay } from './HaggleOverlay';
import { Tally } from './Tally';
import { CardView } from './card/CardView';
import { Pips, Track } from './kit';
import styles from './app.module.css';

/**
 * Fires once per sale. The receipt is the board updating in place — the quota
 * bar slides, the figures bump, and a stamp rises — rather than a screen the
 * player has to click through.
 */
function useSaleFlash(sale: SaleRecord | null): SaleRecord | null {
  const [flash, setFlash] = useState<SaleRecord | null>(null);
  const seen = useRef<number | null>(null);

  useEffect(() => {
    if (!sale || sale.id === seen.current) return;
    seen.current = sale.id;
    setFlash(sale);
    const timer = setTimeout(() => setFlash(null), 1900);
    return () => clearTimeout(timer);
  }, [sale]);

  return flash;
}

export function ShowScreen() {
  const show = useRun((s) => s.show);
  const bankroll = useRun((s) => s.bankroll);
  const preview = useRun((s) => s.preview);
  const toggleCard = useRun((s) => s.toggleCard);
  const pitch = useRun((s) => s.pitch);
  const turnAway = useRun((s) => s.turnAway);

  const flash = useSaleFlash(show?.lastSale ?? null);

  if (!show || !show.buyer) return null;

  const haggling = show.phase === 'haggling';
  const result = haggling ? show.pending : preview();
  const quotaPct = (show.earned / show.config.quota) * 100;
  const quotaMet = show.earned >= show.config.quota;
  const conditions = getConditions(show.config.conditionIds);
  const queue = remainingQueue(show);
  const latest = show.log[show.log.length - 1];

  return (
    <div className={styles.fixed}>
      {/* Top strip: identity, house rules, and the latest floor note --- */}
      <div className={styles.topBar}>
        <div className={styles.topBarTitle}>
          <span className={styles.screenNum}>
            {String(show.config.showIndex).padStart(2, '0')}
          </span>
          <span className={styles.screenTitle}>THE TABLE</span>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {conditions.map((c) => (
            <span key={c.id} className={styles.conditionChip} title={c.text}>
              <strong>{c.name}</strong> — {c.text}
            </span>
          ))}
          {latest && <span className={styles.ticker}>{latest.text}</span>}
        </div>
      </div>

      <div className={styles.tableGrid}>
        {/* Box score ------------------------------------------------- */}
        <div className={styles.hud}>
          <div className={styles.hudGrow}>
            <div className={styles.quotaHead}>
              <span className={styles.lbl}>Quota progress</span>
              <span className={styles.quotaFigure}>
                <span key={show.earned} className={flash ? styles.bump : undefined}>
                  {formatMoney(show.earned)}
                </span>
                <em> / {formatMoney(show.config.quota)}</em>
              </span>
            </div>
            <Track pct={quotaPct} met={quotaMet} />
          </div>
          <div className={styles.hudCell}>
            <div className={styles.lbl}>Bankroll</div>
            <div className={styles.hudValue}>{formatMoney(bankroll)}</div>
          </div>
          <div className={styles.hudCell}>
            <div className={styles.lbl}>Stock</div>
            <div className={styles.hudValue}>{show.inventory.length}</div>
          </div>
          <div className={styles.hudCell}>
            <div className={styles.lbl}>Buyers</div>
            <div className={styles.hudValue}>
              {show.queueIndex + 1}/{show.config.buyerCount}
            </div>
          </div>
          <div className={styles.hudCell}>
            <div className={styles.lbl} style={{ marginBottom: 6 }}>
              Passes
            </div>
            <Pips total={show.config.turnAways} filled={show.turnAwaysLeft} />
          </div>
        </div>

        {/* Buyer + queue --------------------------------------------- */}
        <div className={styles.buyerRow}>
          <BuyerPanel
            buyer={show.buyer}
            position={show.queueIndex + 1}
            total={show.config.buyerCount}
          />
          <BuyerQueue
            queue={queue}
            startIndex={show.queueIndex + 2}
            revealed={show.config.revealNextBuyer}
          />
        </div>

        {/* The case --------------------------------------------------- */}
        <div className={styles.caseRow}>
          {show.displayCase.length === 0 ? (
            <div className={styles.caseEmpty}>The case is empty. Nothing left to sell.</div>
          ) : (
            show.displayCase.map((card) => {
              const index = show.selection.indexOf(card.id);
              const selected = index >= 0;
              const locked = show.lockedCardIds.includes(card.id);
              return (
                <div key={card.id} className={styles.caseSlot}>
                  <CardView
                    card={card}
                    fill
                    selected={selected}
                    {...(selected ? { selectIndex: index + 1 } : {})}
                    locked={locked}
                    disabled={
                      haggling ||
                      locked ||
                      (!selected && show.selection.length >= MAX_PITCH_CARDS)
                    }
                    onClick={() => toggleCard(card.id)}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* The tally -------------------------------------------------- */}
        <Tally
          result={result}
          turnAwaysLeft={show.turnAwaysLeft}
          canPitch={show.selection.length > 0 && !haggling}
          canTurnAway={show.turnAwaysLeft > 0 && !haggling}
          onPitch={pitch}
          onTurnAway={turnAway}
        />
      </div>

      {haggling && <HaggleOverlay />}

      {flash && (
        <div className={styles.saleToast}>
          <span className={styles.saleToastAmount}>+{formatMoney(flash.amount)}</span>
          <span className={styles.saleToastNote}>
            {flash.pitchTypeLabel} · {flash.cards.length} card
            {flash.cards.length === 1 ? '' : 's'} to {flash.buyerLabel}
          </span>
        </div>
      )}
    </div>
  );
}
