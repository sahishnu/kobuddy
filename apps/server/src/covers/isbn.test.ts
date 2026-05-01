import { describe, expect, it } from 'vitest';
import { normalizeIsbnForStorage, pickPrimaryIsbnFromList } from './isbn.js';

describe('normalizeIsbnForStorage', () => {
  it('accepts ISBN-13', () => {
    expect(normalizeIsbnForStorage('978-0-306-40615-7')).toBe('9780306406157');
  });

  it('accepts ISBN-10 with check digit X', () => {
    expect(normalizeIsbnForStorage('0-8044-2957-X')).toBe('080442957X');
  });

  it('rejects garbage', () => {
    expect(normalizeIsbnForStorage('abc')).toBeNull();
    expect(normalizeIsbnForStorage('123')).toBeNull();
  });
});

describe('pickPrimaryIsbnFromList', () => {
  it('prefers 978… ISBN-13', () => {
    expect(
      pickPrimaryIsbnFromList(['080442957X', '9780306406157', '0306406152']),
    ).toBe('9780306406157');
  });
});
