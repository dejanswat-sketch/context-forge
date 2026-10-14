import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nadjiTacneDuplikate, nadjiSlicne, slicnost, nadjiKonflikte, sazetak } from '../src/deduper.js';
import { usisajListu } from '../src/ingestor.js';

const izvori = (lista) => usisajListu(lista);

test('exact duplicates are grouped and the newest copy is canonical', () => {
  const s = izvori([
    { id: 'a.md', tekst: 'isti tekst', updatedAt: '2026-01-01T00:00:00Z' },
    { id: 'b.md', tekst: 'isti tekst', updatedAt: '2026-06-01T00:00:00Z' },
    { id: 'c.md', tekst: 'drugi tekst' },
  ]);
  const grupe = nadjiTacneDuplikate(s);
  assert.equal(grupe.length, 1);
  assert.equal(grupe[0].kanonski, 'b.md');
  assert.deepEqual(grupe[0].clanovi.sort(), ['a.md', 'b.md']);
});

test('no duplicates -> no groups', () => {
  assert.equal(nadjiTacneDuplikate(izvori([{ id: 'a.md', tekst: 'x' }, { id: 'b.md', tekst: 'y' }])).length, 0);
});

test('similarity is 1 for the same tokens and 0 for unrelated text', () => {
  assert.equal(slicnost('kako radi refund sistem', 'refund sistem kako radi'), 1);
  assert.equal(slicnost('potpuno razlicit tekst ovdje', 'nesto drugo sasvim'), 0);
  assert.ok(slicnost('cena proizvoda je 100 eura mesecno', 'cena proizvoda je 100 eura godisnje') > 0.6);
});

test('near duplicates are found above the threshold only', () => {
  const s = izvori([
    { id: 'a.md', tekst: 'cena proizvoda starter je 29 eura mesecno za standardni paket' },
    { id: 'b.md', tekst: 'cena proizvoda starter je 29 eura mesecno za standardni paket i podrsku' },
    { id: 'c.md', tekst: 'potpuno drugacija tema o necemu sasvim desetom' },
  ]);
  const blizu = nadjiSlicne(s, 0.8);
  assert.equal(blizu.length, 1);
  assert.deepEqual([blizu[0].a, blizu[0].b].sort(), ['a.md', 'b.md']);
  assert.equal(nadjiSlicne(s, 0.99).length, 0);
});

test('conflicts: same key, different value', () => {
  const s = izvori([
    { id: 'a.md', tekst: 'ponuda A', facts: [{ key: 'cijena:starter', value: '29' }] },
    { id: 'b.md', tekst: 'ponuda B', facts: [{ key: 'cijena:starter', value: '39' }] },
    { id: 'c.md', tekst: 'ponuda C', facts: [{ key: 'cijena:pro', value: '79' }] },
  ]);
  const k = nadjiKonflikte(s);
  assert.equal(k.length, 1);
  assert.equal(k[0].key, 'cijena:starter');
  assert.equal(k[0].brojRazlicitih, 2);
  assert.deepEqual(k[0].izvori.sort(), ['a.md', 'b.md']);
});

test('the same value in two sources is NOT a conflict', () => {
  const s = izvori([
    { id: 'a.md', tekst: 'a', facts: [{ key: 'k', value: '1' }] },
    { id: 'b.md', tekst: 'b', facts: [{ key: 'k', value: '1' }] },
  ]);
  assert.equal(nadjiKonflikte(s).length, 0);
});

test('summary counts duplicates, savings and conflicts', () => {
  const s = izvori([
    { id: 'a.md', tekst: 'isti', facts: [{ key: 'k', value: '1' }] },
    { id: 'b.md', tekst: 'isti', facts: [{ key: 'k', value: '2' }] },
    { id: 'c.md', tekst: 'drugi' },
  ]);
  const r = sazetak(s);
  assert.equal(r.izvora, 3);
  assert.equal(r.duplikata, 1);
  assert.equal(r.grupaDuplikata, 1);
  assert.equal(r.konflikata, 1);
  assert.ok(r.ustedaBajtova > 0);
});
