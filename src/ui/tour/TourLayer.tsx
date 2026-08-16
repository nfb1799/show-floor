/**
 * The spotlight.
 *
 * Two ways of cutting the dim, for two different jobs:
 *
 * An action step draws four opaque panels *around* one element, so the gap
 * between them is a real gap and the control underneath takes the click.
 *
 * An explaining step paints one dim and punches a hole per anchor through an
 * SVG mask, because it may be pointing at two things at opposite corners of
 * the board — a single cutout spanning both would light half the screen and
 * highlight nothing. Clicks are blocked everywhere on these, holes included.
 *
 * The panel is docked, not floating: it holds the bottom of the screen and the
 * board is made shorter by exactly its height (see --tour-dock), so it never
 * moves and never covers what it is pointing at.
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
  /** One per anchor: each is cut out of the dim and gets its own ring. */
  const [boxes, setBoxes] = useState<readonly Box[]>([]);
  const frame = useRef(0);

  // Shrinks every screen by the dock's height for as long as the tour runs.
  useEffect(() => {
    if (!active) return;
    document.documentElement.dataset.tourOpen = 'true';
    return () => {
      delete document.documentElement.dataset.tourOpen;
    };
  }, [active]);

  // Measured immediately, then tracked: the board animates (sale flash, case
  // refill) and a spotlight that lags its target looks broken. The interval is
  // not redundant with the frame loop — rAF is suspended while the tab is in
  // the background, and the step can change while it is.
  useLayoutEffect(() => {
    if (!active || !step) {
      setBoxes([]);
      return;
    }

    const anchors = step.anchor === undefined ? [] : [step.anchor].flat();

    const measure = (): void => {
      const found = anchors
        .map((a) => document.querySelector(`[data-tour="${a}"]`))
        .filter((el): el is Element => el !== null)
        .map(boxOf);

      setBoxes((prev) =>
        prev.length === found.length && prev.every((b, i) => same(b, found[i] ?? null))
          ? prev
          : found,
      );
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
    if (!active || step?.anchor === undefined) return;
    const first = [step.anchor].flat()[0];
    if (first === undefined) return;
    document
      .querySelector(`[data-tour="${first}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

  // Overlays open and close in local component state rather than the run, so
  // those steps watch the screen instead: the panel appearing *is* the event.
  useEffect(() => {
    if (!active || !step) return;
    if (!step.untilAnchor && !step.untilGone) return;

    const check = (): void => {
      const found = (a: string): boolean => document.querySelector(`[data-tour="${a}"]`) !== null;
      const appeared = step.untilAnchor ? found(step.untilAnchor) : true;
      const vanished = step.untilGone ? !found(step.untilGone) : true;
      if (appeared && vanished) next();
    };

    // Watched rather than polled: the overlay appearing is a DOM mutation, so
    // the step ends on the same tick the panel opens instead of up to a poll
    // interval later. The interval stays as a backstop for anything that
    // changes without touching the tree we observe.
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(check, 250);

    return () => {
      observer.disconnect();
      clearInterval(timer);
    };
  }, [active, step, next]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') quit();
      const waits =
        step?.until !== undefined ||
        step?.untilAnchor !== undefined ||
        step?.untilGone !== undefined;
      if ((e.key === 'Enter' || e.key === ' ') && step && !waits) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, step, next, quit]);

  if (!active || !step) return null;

  const waiting =
    step.until !== undefined || step.untilAnchor !== undefined || step.untilGone !== undefined;
  // Only one target can be made clickable, so only a single-anchor step opens.
  const target = waiting && boxes.length === 1 ? boxes[0]! : null;
  const last = index === TOUR_STEPS.length - 1;

  return (
    <>
      <div className={styles.root}>
        {target ? (
          <>
            <div
              className={styles.block}
              style={{ top: 0, left: 0, right: 0, height: target.top }}
            />
            <div
              className={styles.block}
              style={{ top: target.top + target.height, left: 0, right: 0, bottom: 0 }}
            />
            <div
              className={styles.block}
              style={{ top: target.top, left: 0, width: target.left, height: target.height }}
            />
            <div
              className={styles.block}
              style={{
                top: target.top,
                left: target.left + target.width,
                right: 0,
                height: target.height,
              }}
            />
          </>
        ) : (
          <svg className={styles.dim} aria-hidden>
            <defs>
              <mask id="tourHoles">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {boxes.map((b, i) => (
                  <rect
                    key={i}
                    x={b.left}
                    y={b.top}
                    width={b.width}
                    height={b.height}
                    fill="black"
                  />
                ))}
              </mask>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" mask="url(#tourHoles)" />
          </svg>
        )}

        {boxes.map((b, i) => (
          <div
            key={i}
            className={styles.ring}
            data-live={target !== null}
            style={{ top: b.top, left: b.left, width: b.width, height: b.height }}
          />
        ))}
      </div>

      <div className={styles.dock}>
        <div className={styles.dockText}>
          <button className={styles.skip} onClick={quit}>
            {last ? 'CLOSE TUTORIAL' : 'SKIP TUTORIAL'}
          </button>
          <div className={styles.title}>{step.title}</div>
          <p className={styles.text}>{step.text}</p>
        </div>

        <div className={styles.dockActions}>
          {waiting ? (
            <span className={styles.prompt}>{step.action ?? 'Your turn'}</span>
          ) : (
            <button className={styles.next} onClick={next}>
              {last ? 'START A REAL RUN' : 'NEXT →'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
