/**
 * The handful of chrome pieces every screen repeats: bordered sheets, coloured
 * header bands, progress tracks and pip rows. Presentation only.
 */

import type { ReactNode } from 'react';
import styles from './app.module.css';

export type Ink = 'ink' | 'red' | 'blue' | 'gold' | 'green';

export function Sheet({
  children,
  flat = false,
  className,
}: {
  children: ReactNode;
  flat?: boolean;
  className?: string | undefined;
}) {
  return (
    <div className={[flat ? styles.sheetFlat : styles.sheet, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export function Band({
  title,
  note,
  ink = 'ink',
  goldTitle = false,
}: {
  title: ReactNode;
  note?: ReactNode;
  ink?: Ink;
  goldTitle?: boolean;
}) {
  return (
    <div className={styles.band} data-ink={ink}>
      <span className={goldTitle ? `${styles.bandTitle} ${styles.bandTitleGold}` : styles.bandTitle}>
        {title}
      </span>
      {note !== undefined && <span className={styles.bandNote}>{note}</span>}
    </div>
  );
}

export function ScreenHead({
  n,
  title,
  note,
}: {
  n: string;
  title: string;
  note?: string;
}) {
  return (
    <div className={styles.screenHead}>
      <span className={styles.screenNum}>{n}</span>
      <span className={styles.screenTitle}>{title}</span>
      {note && <span className={styles.screenNote}>{note}</span>}
    </div>
  );
}

export function Track({
  pct,
  met = false,
  big = false,
}: {
  pct: number;
  met?: boolean;
  big?: boolean;
}) {
  return (
    <div className={big ? `${styles.track} ${styles.trackBig}` : styles.track}>
      <div
        className={styles.trackFill}
        data-met={met}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
      <div className={styles.trackHatch} />
    </div>
  );
}

/** `spent` pips render hollow; the rest are filled. */
export function Pips({
  total,
  filled,
  large = false,
}: {
  total: number;
  filled: number;
  large?: boolean;
}) {
  return (
    <div className={styles.pips}>
      {Array.from({ length: Math.max(0, total) }, (_, i) => (
        <span
          key={i}
          className={large ? styles.pipLg : styles.pip}
          data-spent={i >= filled}
        />
      ))}
    </div>
  );
}

/** Two-letter mark for a buyer, e.g. "Bulk Guy" -> "BG". */
export function initialsOf(label: string): string {
  const words = label.split(/[\s,]+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}
