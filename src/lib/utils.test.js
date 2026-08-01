import { describe, expect, it } from 'vitest';
import { money, prettyDate } from './utils';

describe('formatting helpers', () => {
  it('formats dates consistently', () => expect(prettyDate('2026-07-02')).toBe('02 Jul 2026'));
  it('formats a numeric currency value', () => expect(money(1250, 'USD')).toContain('1,250'));
});
