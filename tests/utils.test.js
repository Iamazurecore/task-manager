/* Baseline tests for js/utils.js.
   These describe how the ORIGINAL code behaves, so we can prove later
   changes do not break anything (regression tests). */
import { describe, it, expect, vi, afterEach } from 'vitest';
import utils from '../js/utils.js';

const {
  generateId,
  nowISO,
  escapeHTML,
  formatDate,
  isOverdue,
  debounce,
  capitalize,
  clamp,
} = utils;

describe('generateId', () => {
  it('starts with "task_"', () => {
    expect(generateId()).toMatch(/^task_\d+_[a-z0-9]+$/);
  });

  it('gives a different ID each time', () => {
    const ids = new Set(Array.from({ length: 500 }, generateId));
    expect(ids.size).toBe(500);
  });
});

describe('nowISO', () => {
  it('returns a valid ISO timestamp', () => {
    const value = nowISO();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Number.isNaN(new Date(value).getTime())).toBe(false);
  });
});

describe('escapeHTML', () => {
  it('escapes every HTML special character', () => {
    expect(escapeHTML(`<b>"Tom" & 'Jerry'</b>`)).toBe(
      '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;'
    );
  });

  it('turns null and undefined into an empty string', () => {
    expect(escapeHTML(null)).toBe('');
    expect(escapeHTML(undefined)).toBe('');
  });

  it('converts numbers to text', () => {
    expect(escapeHTML(42)).toBe('42');
  });
});

describe('formatDate', () => {
  it('returns an empty string for missing or invalid dates', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });

  it('includes the year for a valid date', () => {
    expect(formatDate('2026-06-12')).toContain('2026');
  });
});

describe('isOverdue (time zone fixed to UTC)', () => {
  afterEach(() => vi.useRealTimers());

  it('is false when there is no due date', () => {
    expect(isOverdue('')).toBe(false);
  });

  it('is true for a date before today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));
    expect(isOverdue('2026-11-09')).toBe(true);
  });

  it('is false for today and for future dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));
    expect(isOverdue('2026-11-10')).toBe(false);
    expect(isOverdue('2026-11-11')).toBe(false);
  });
});

describe('debounce', () => {
  it('only runs once after rapid calls', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 200);
    debounced('a');
    debounced('b');
    debounced('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
    vi.useRealTimers();
  });
});

describe('capitalize and clamp', () => {
  it('capitalizes the first letter', () => {
    expect(capitalize('high')).toBe('High');
    expect(capitalize('')).toBe('');
  });

  it('keeps a number inside its range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});
