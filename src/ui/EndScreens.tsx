import { useEffect, useState } from 'react';
import { formatMoney } from '../game/cards/value';
import {
  hasSeenTutorial,
  loadBest,
  loadRun,
  markTutorialSeen,
  type BestRun,
} from '../game/run/persistence';
import { useRun } from '../state/runStore';
import { Band, Track } from './kit';
import { useTour } from './tour/tourStore';
import styles from './app.module.css';

function Masthead() {
  return (
    <div className={styles.masthead}>
      <div className={styles.mastheadName}>
        <span>SHOW&nbsp;FLOOR</span>
      </div>
      <div className={styles.mastheadTag}>
        <span style={{ color: 'var(--gold)' }}>CARD-SHOW</span>
        <span style={{ color: 'var(--paper)' }}>PRICE GUIDE</span>
      </div>
    </div>
  );
}

export function ShowResultScreen() {
  const show = useRun((s) => s.show);
  const collect = useRun((s) => s.collectShow);
  if (!show) return null;

  const cleared = show.outcome === 'cleared';
  const pct = (show.earned / show.config.quota) * 100;

  return (
    <div className={styles.center}>
      <div className={styles.centerSheet}>
        <Band
          title={cleared ? 'Quota cleared' : 'Short of quota'}
          note={`SHOW ${String(show.config.showIndex).padStart(2, '0')}`}
          ink={cleared ? 'green' : 'red'}
        />
        <div style={{ paddingTop: 26 }}>
          <div className={styles.bigTitle} data-tone={cleared ? undefined : 'bad'}>
            {formatMoney(show.earned)}
          </div>
          <p className={styles.sub}>
            against a {formatMoney(show.config.quota)} quota, selling {show.stats.cardsSold} card
            {show.stats.cardsSold === 1 ? '' : 's'}.
            {show.stats.buyersWalked > 0 &&
              ` ${show.stats.buyersWalked} buyer${show.stats.buyersWalked === 1 ? '' : 's'} walked.`}
          </p>

          <div style={{ margin: '22px 0' }}>
            <Track pct={pct} met={cleared} big />
          </div>

          <button className={styles.btn} onClick={collect} data-tour="collect">
            {cleared ? 'PACK UP · HIT THE SHOP' : 'SEE THE DAMAGE'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RunOverScreen() {
  const reason = useRun((s) => s.runOverReason);
  const bankroll = useRun((s) => s.bankroll);
  const showIndex = useRun((s) => s.showIndex);
  const seed = useRun((s) => s.seed);
  const stats = useRun((s) => s.stats);
  const newRun = useRun((s) => s.newRun);
  const [best, setBest] = useState<BestRun | null>(null);

  useEffect(() => setBest(loadBest()), []);

  const rows: [string, string][] = [
    ['Shows cleared', `${stats.showsCleared}`],
    ['Total earned', formatMoney(stats.totalEarned)],
    ['Biggest single sale', formatMoney(stats.biggestSale)],
    ['Cards sold', `${stats.cardsSold}`],
    ['Cards bought', `${stats.cardsBought}`],
    ['Packs opened', `${stats.packsOpened}`],
    ['Cards graded', `${stats.cardsGraded}`],
    ['Gear bought', `${stats.upgradesBought}`],
    ['Buyers walked', `${stats.buyersWalked}`],
  ];

  return (
    <div className={styles.center}>
      <div className={styles.centerSheet}>
        <Band title="Run over" note={`SHOW ${showIndex}`} ink="red" />
        <div style={{ paddingTop: 26 }}>
          <div className={styles.bigTitle} data-tone="bad">
            PACKED UP
          </div>
          <p className={styles.sub}>{reason}</p>
          <p className={styles.sub}>
            You made it to show #{showIndex} with {formatMoney(bankroll)} banked.
          </p>

          <div className={styles.statsTable}>
            {rows.map(([label, value]) => (
              <div key={label} className={styles.statsRow}>
                <span>{label}</span>
                <span className={styles.statsValue}>{value}</span>
              </div>
            ))}
          </div>

          {best && (
            <p className={styles.sub} style={{ fontSize: 14 }}>
              Best run so far: {best.showsCleared} show{best.showsCleared === 1 ? '' : 's'} cleared,{' '}
              {formatMoney(best.totalEarned)} earned.
            </p>
          )}

          <p className={styles.seedLine} style={{ marginTop: 14 }}>
            seed: {seed}
          </p>
          <button className={styles.btn} style={{ marginTop: 8 }} onClick={() => newRun()}>
            NEW RUN
          </button>
        </div>
      </div>
    </div>
  );
}

export function TitleScreen() {
  const newRun = useRun((s) => s.newRun);
  const resume = useRun((s) => s.resume);
  const [hasSave, setHasSave] = useState(false);
  const [seedInput, setSeedInput] = useState('');
  const startTour = useTour((s) => s.start);
  const [offerTour, setOfferTour] = useState(false);

  useEffect(() => {
    const save = loadRun();
    setHasSave(save !== null);
    // No save and no history: they have never seen any of this, so offer the
    // tutorial rather than hoping they find the button.
    if (save === null && !hasSeenTutorial()) setOfferTour(true);
  }, []);

  const declineTour = (): void => {
    markTutorialSeen();
    setOfferTour(false);
  };

  return (
    <div className={styles.center}>
      <Masthead />

      <div className={styles.centerSheet} style={{ marginTop: 8 }}>
        <p className={styles.sub} style={{ margin: 0, fontSize: 17 }}>
          One booth, one quota, four buyers a show. Read the room, pull the right cards from the
          case, and move volume before the aisle empties. Every card you sell is gone for good.
        </p>

        {offerTour && (
          <div className={styles.tourOffer}>
            <div className={styles.tourOfferText}>
              <strong>First time?</strong> Play one short show with the game explaining itself as
              you go. Three buyers, then the shop — about three minutes.
            </div>
            <div className={styles.tourOfferButtons}>
              <button className={styles.btn} data-ink="gold" onClick={startTour}>
                SHOW ME
              </button>
              <button className={styles.btnSm} onClick={declineTour}>
                NO THANKS
              </button>
            </div>
          </div>
        )}

        <div className={styles.titleActions}>
          {hasSave && (
            <button className={styles.btn} data-ink="gold" onClick={() => resume()}>
              RESUME RUN
            </button>
          )}
          <button className={styles.btn} onClick={() => newRun(seedInput.trim() || undefined)}>
            {hasSave ? 'START OVER' : 'OPEN THE DOORS'}
          </button>
        </div>

        <input
          className={styles.seedInput}
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          placeholder="OPTIONAL SEED"
          aria-label="Run seed"
        />

        <button className={styles.btnSm} style={{ marginTop: 10 }} onClick={startTour}>
          TUTORIAL
        </button>
      </div>
    </div>
  );
}
