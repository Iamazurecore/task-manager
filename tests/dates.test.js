// Issue #7 (A4): due dates are calendar days, so they must show the same date
// and become overdue only after that day ends, in every time zone.
// The bug only appears in time zones behind UTC, so these tests switch the
// time zone to Los Angeles (UTC-8 in November) and Tokyo (UTC+9).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import utils from '../js/utils.js';

const { formatDate, isOverdue } = utils;
const originalTZ = process.env.TZ;

function inTimeZone(tz) {
  beforeEach(() => {
    process.env.TZ = tz;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTZ;
  });
}

// The day number shown by formatDate, whatever the locale's word order.
const dayShown = (text) => text.match(/\b(\d{1,2})\b/)[1];

describe('due dates in a time zone behind UTC (Los Angeles) (#7)', () => {
  inTimeZone('America/Los_Angeles');

  it('shows the same calendar day that was picked', () => {
    expect(dayShown(formatDate('2026-11-21'))).toBe('21');
  });

  it('a task due today is not overdue in the morning', () => {
    vi.setSystemTime(new Date(2026, 10, 21, 9, 0)); // 21 Nov, 09:00 local
    expect(isOverdue('2026-11-21')).toBe(false);
  });

  it('a task due today is not overdue late in the evening', () => {
    vi.setSystemTime(new Date(2026, 10, 21, 23, 30)); // 21 Nov, 23:30 local
    expect(isOverdue('2026-11-21')).toBe(false);
  });

  it('a task due yesterday is overdue', () => {
    vi.setSystemTime(new Date(2026, 10, 21, 9, 0));
    expect(isOverdue('2026-11-20')).toBe(true);
  });
});

describe('due dates in a time zone ahead of UTC (Tokyo) (#7)', () => {
  inTimeZone('Asia/Tokyo');

  it('shows the same calendar day that was picked', () => {
    expect(dayShown(formatDate('2026-11-21'))).toBe('21');
  });

  it('a task due today is not overdue, and yesterday is', () => {
    vi.setSystemTime(new Date(2026, 10, 21, 1, 0)); // 21 Nov, 01:00 local
    expect(isOverdue('2026-11-21')).toBe(false);
    expect(isOverdue('2026-11-20')).toBe(true);
  });
});
