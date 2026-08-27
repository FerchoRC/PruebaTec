import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/env.js';

const base = { DATABASE_URL: 'postgres://user:pass@db:5432/promociones' };

describe('loadConfig', () => {
  it('falla nombrando la variable que falta', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('trata una variable vacia como ausente', () => {
    expect(() => loadConfig({ DATABASE_URL: '   ' })).toThrow(/DATABASE_URL/);
  });

  it('aplica valores por defecto a lo opcional', () => {
    const config = loadConfig(base);
    expect(config.port).toBe(3001);
    expect(config.nodeEnv).toBe('development');
  });

  it('respeta el puerto indicado y rechaza uno invalido', () => {
    expect(loadConfig({ ...base, PORT: '8080' }).port).toBe(8080);
    expect(() => loadConfig({ ...base, PORT: 'no-es-un-puerto' })).toThrow(/PORT/);
  });
});
