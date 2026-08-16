/**
 * Prints the balance report. Not a test — it asserts nothing, and it is skipped
 * by `npm test` because it takes seconds rather than milliseconds.
 *
 *   npm run sim
 *
 * The gate is vite's mode rather than an env var so the command is the same on
 * Windows and everywhere else.
 */

import { describe, it } from 'vitest';
import { report } from './report';

const ENABLED = import.meta.env.MODE === 'sim';

describe.runIf(ENABLED)('balance report', () => {
  it('plays 40 runs and prints what happened', () => {
    console.log(report(40));
  }, 120_000);
});
