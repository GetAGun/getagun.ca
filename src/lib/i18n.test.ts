import { describe, expect, it } from 'vitest';
import { STRINGS } from './i18n';

describe('i18n dictionary', () => {
  it('en and fr have identical keys', () => {
    expect(Object.keys(STRINGS.fr).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });
  it('no empty strings', () => {
    for (const lang of ['en', 'fr'] as const)
      for (const [k, v] of Object.entries(STRINGS[lang])) expect(v, `${lang}.${k}`).not.toBe('');
  });
});
