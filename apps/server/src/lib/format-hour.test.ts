import { formatHour12, formatHourRange12 } from '@kobuddy/common';
import { describe, expect, it } from 'vitest';

describe('formatHour12', () => {
  it('formats midnight and noon', () => {
    expect(formatHour12(0)).toBe('12am');
    expect(formatHour12(12)).toBe('12pm');
  });

  it('formats afternoon hours', () => {
    expect(formatHour12(14)).toBe('2pm');
    expect(formatHour12(23)).toBe('11pm');
  });
});

describe('formatHourRange12', () => {
  it('wraps midnight', () => {
    expect(formatHourRange12(23)).toBe('11pm–12am');
  });

  it('formats a daytime range', () => {
    expect(formatHourRange12(9)).toBe('9am–10am');
  });
});
