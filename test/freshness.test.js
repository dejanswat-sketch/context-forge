import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ttlZa, danaStarosti, ocijeni, ocijeniSve, ucitajPolitiku } from '../src/freshness.js';

const SADA = Date.parse('2026-10-14T12:00:00Z');
const prije = (dana) => new Date(SADA - dana * 86400000).toISOString();
const politika = ucitajPolitiku();

test('TTL comes from policy.json per type', () => {
  assert.equal(ttlZa('price', politika), 30);
  assert.equal(ttlZa('ticket', politika), 30);
  assert.equal(ttlZa('api', politika), 60);
  assert.equal(ttlZa('docs', politika), 180);
  assert.equal(ttlZa('contract', politika), 365);
  assert.equal(ttlZa('nepoznat-tip', politika), politika.defaultTtlDays);
});

test('age in days is measured, not guessed', () => {
  assert.equal(danaStarosti(prije(10), SADA), 10);
  assert.equal(danaStarosti(null, SADA), null);
  assert.equal(danaStarosti('nije-datum', SADA), null);
});

test('fresh / stale / expired follow the ratio in the policy', () => {
  assert.equal(ocijeni({ id: 'a', tip: 'docs', updatedAt: prije(10) }, { sada: SADA, politika }).status, 'fresh');
  assert.equal(ocijeni({ id: 'b', tip: 'docs', updatedAt: prije(140) }, { sada: SADA, politika }).status, 'stale');
  assert.equal(ocijeni({ id: 'c', tip: 'docs', updatedAt: prije(200) }, { sada: SADA, politika }).status, 'expired');
});

test('a source without a date cannot prove freshness (status unknown)', () => {
  const o = ocijeni({ id: 'x', tip: 'docs', updatedAt: null }, { sada: SADA, politika });
  assert.equal(o.status, 'unknown');
  assert.equal(o.score, 0);
  assert.match(o.reason, /nema datuma/);
});

test('score decays linearly: 1 at day 0, 0 at TTL', () => {
  assert.equal(ocijeni({ id: 'a', tip: 'price', updatedAt: prije(0) }, { sada: SADA, politika }).score, 1);
  assert.equal(ocijeni({ id: 'b', tip: 'price', updatedAt: prije(30) }, { sada: SADA, politika }).score, 0);
  assert.equal(ocijeni({ id: 'c', tip: 'price', updatedAt: prije(15) }, { sada: SADA, politika }).score, 0.5);
});

test('summary reports counts, percentage over 90 days and owners missing', () => {
  const izvori = [
    { id: 'a', tip: 'docs', owner: 'x@firma', updatedAt: prije(5) },
    { id: 'b', tip: 'docs', owner: null, updatedAt: prije(120) },
    { id: 'c', tip: 'price', owner: 'y@firma', updatedAt: prije(200) },
    { id: 'd', tip: 'docs', owner: null, updatedAt: null },
  ];
  const { sazetak } = ocijeniSve(izvori, { sada: SADA, politika });
  assert.equal(sazetak.izvora, 4);
  assert.equal(sazetak.fresh, 1);
  assert.equal(sazetak.stale, 1);        // 120 dana / TTL 180 = stale (ne isteklo)
  assert.equal(sazetak.expired, 1);      // price 200 dana / TTL 30 = isteklo
  assert.equal(sazetak.unknown, 1);
  assert.equal(sazetak.procenatPreko90, 50);
  assert.equal(sazetak.bezVlasnika, 2);
  assert.ok(sazetak.prosjecanScore >= 0 && sazetak.prosjecanScore <= 1);
});
