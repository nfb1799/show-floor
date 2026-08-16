/**
 * The spotlight.
 *
 * Four opaque panels are drawn around the highlighted element rather than one
 * scrim with a transparent hole, which means the hole is a genuine gap: the
 * real control underneath takes the click, and everything else is physically
 * unreachable. That is what keeps a scripted walkthrough on script without any
 * of the screens knowing a tour exists.
 *
 * Steps that only explain something block the whole screen — the ring is there
 * to point, not to invite a click.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRun } from '../../state/runStore';
import { TOUR_STEPS } from './steps';
import { useTour } from './tourStore';
import styles from './tour.module.css';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const CALLOUT_WIDTH = 340;
/** Enough for a title, three lines of text and the footer. */
const CALLOUT_HEIGHT = 190;

function same(a: Box | null, b: Box | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

export function TourLayer() {
  const active = useTour((s) => s.active);
  const index = useTour((s) => s.index);
  const next = useTour((s) => s.next);
  const quit = useTour((s) => s.quit);

  const step = TOUR_STEPS[index];
  const [box, setBox] = useState<Box | null>(null);
  const frame = useRef(0);

  // Measured immediately, then tracked: the board animates (sale flash, case
  // refill) and a spotlight that lags its target looks broken. The interval is
  // not redundant with the frame loop — rAF is suspended while the tab is in
  // the background, and the step can change while it is.
  useLayoutEffect(() => {
    if (!active || !step) {
      setBox(null);
      return;
    }

    const measure = (): void => {
      const el = step.anchor ? document.querySelector(`[data-tour="${step.anchor}"]`) : null;
      const next = el ? boxOf(el) : null;
      setBox((prev) => (same(prev, next) ? prev : next));
    };

    measure();

    const loop = (): void => {
      measure();
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
    const timer = window.setInterval(measure, 200);

    return () => {
      cancelAnimationFrame(frame.current);
      clearInterval(timer);
    };
  }, [active, step]);

  // Anchors in the shop live inside a scrolling pane and can start off-screen.
  useEffect(() => {
    if (!active || !step?.anchor) return;
    const el = document.querySelector(`[data-tour="${step.anchor}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [active, step]);

  // Action steps end themselves when the game reaches the state they asked
  // for, so the player never has to confirm what they just did.
  useEffect(() => {
    if (!active || !step?.until) return;
    const done = step.until;
    if (done(useRun.getState())) {
      next();
      return;
    }
    return useRun.subscribe((s) => {
      if (done(s)) next();
    });
  }, [active, step, next]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') quit();
      if ((e.key === 'Enter' || e.key === ' ') && step && !step.until) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, step, next, quit]);

  if (!active || !step) return null;

  const interactive = step.until !== undefined && box !== null;
  const last = index === TOUR_STEPS.length - 1;

  // Below the target where there is room, above it otherwise; centred when the
  // step has no anchor at all.
  const callout = ((): { top: number; left: number } => {
    if (!box) {
      return {
        top: window.innerHeight / 2 - CALLOUT_HEIGHT / 2,
        left: window.innerWidth / 2 - CALLOUT_WIDTH / 2,
      };
    }
    const below = box.top + box.height + 14;
    const fitsBelow = below + CALLOUT_HEIGHT < window.innerHeight - 8;
    const top = fitsBelow ? below : Math.max(8, box.top - CALLOUT_HEIGHT - 14);
    const left = Math.min(
      Math.max(12, box.left + box.width / 2 - CALLOUT_WIDTH / 2),
      window.innerWidth - CALLOUT_WIDTH - 12,
    );
    return { top, left };
  })();

  return (
    <div className={styles.root}>
      {interactive && box ? (
        <>
          <div className={styles.block} style={{ top: 0, left: 0, right: 0, height: box.top }} />
          <div
            className={styles.block}
            style={{ top: box.top + box.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className={styles.block}
            style={{ top: box.top, left: 0, width: box.left, height: box.height }}
          />
          <div
            className={styles.block}
            style={{
              top: box.top,
              left: box.left + box.width,
              right: 0,
              height: box.height,
            }}
          />
        </>
      ) : (
        <div className={styles.blockAll} />
      )}

      {box && (
        <div
          className={styles.ring}
          data-live={interactive}
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}

      <div className={styles.callout} style={{ top: callout.top, left: callout.left }}>
        <div className={styles.calloutHead}>
          <span className={styles.count}>
            {index + 1}/{TOUR_STEPS.length}
          </span>
          <span className={styles.title}>{step.title}</span>
        </div>

        <p className={styles.text}>{step.text}</p>

        <div className={styles.foot}>
          <button className={styles.skip} onClick={quit}>
            {last ? 'CLOSE' : 'SKIP'}
          </button>
          {step.until ? (
            <span className={styles.prompt}>{step.action ?? 'Your turn'}</span>
          ) : (
            <button className={styles.next} onClick={next}>
              {last ? 'START A REAL RUN' : 'NEXT →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
