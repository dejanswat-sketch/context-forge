import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { saberi, rizik, recenica, napisiIzvestaj } from '../src/report.js';
import { napraviPaket } from '../src/packer.js';
import { usisajListu } from '../src/ingestor.js';
import { napraviKorpus } from '../examples/synthetic-corpus.js';

const SADA = Date.parse('2026-10-14T12:00:00Z');
const pre = (dana) => new Date(SADA - dana * 86400000).toISOString();
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cf-rep-'));

const paketSa = (izvori) => napraviPaket(usisajListu(izvori), { sada: SADA });

test('the summary carries the numbers a manager asks for', () => {
  const r = saberi(paketSa([
    { id: 'a.md', tip: 'docs', tekst: 'Svez tekst o ponudi i ceni za klijente.', updatedAt: pre(5), owner: 'x@firma' },
    { id: 'b.md', tip: 'price', tekst: 'Istekao cenovnik koji vise nije vazeci za klijente.', updatedAt: pre(300), owner: null },
  ]));
  assert.equal(r.izvora, 2);
  assert.equal(r.expired, 1);
  assert.equal(r.bezVlasnika, 1);
  assert.equal(r.procenatPreko90, 50);
  assert.match(r.paketHash, /^[0-9a-f]{64}$/);
});

test('risk is scored, not decorative', () => {
  assert.equal(rizik({ svezina: { expired: 0, unknown: 0, procenatPreko90: 0 }, konflikata: 0, izvora: 0 }).nivo, 'nizak');
  assert.equal(rizik({ svezina: { expired: 0, unknown: 0, procenatPreko90: 10 }, konflikata: 0, izvora: 100 }).nivo, 'srednji');
  assert.equal(rizik({ svezina: { expired: 10, unknown: 0, procenatPreko90: 10 }, konflikata: 0, izvora: 100 }).nivo, 'visok');
  assert.equal(rizik({ svezina: { expired: 30, unknown: 5, procenatPreko90: 50 }, konflikata: 12, izvora: 100 }).nivo, 'kritičan');
});

test('the management sentence is built from the measurements', () => {
  const r = saberi(paketSa([{ id: 'a.md', tip: 'docs', tekst: 'Tekst za recenicu izvjestaja.', updatedAt: pre(400) }]));
  const s = recenica(r);
  assert.match(s, /1 izvora znanja/);
  assert.match(s, /Rizik: \*\*/);
  assert.match(s, /U paket je ušlo/);
});

test('a report is written as md + json + sha256', () => {
  const d = tmp();
  const paket = paketSa([{ id: 'a.md', tip: 'docs', tekst: 'Tekst za fajlove izvjestaja i hash.', updatedAt: pre(3) }]);
  const r = napisiIzvestaj(paket, d);
  assert.ok(fs.existsSync(r.md));
  assert.ok(fs.existsSync(r.json));
  assert.ok(fs.existsSync(r.md + '.sha256'));
  assert.equal(JSON.parse(fs.readFileSync(r.json, 'utf8')).izvora, 1);
  fs.rmSync(d, { recursive: true, force: true });
});

test('the demo corpus hits its targets exactly (312 / 47 / 12 / 23.1%)', () => {
  const { izvori, meta } = napraviKorpus();
  assert.equal(meta.ukupno, 312);
  assert.equal(meta.duplikata, 47);
  assert.equal(meta.konflikata, 12);
  assert.equal(meta.starihPreko90, 72);
  assert.equal(meta.procenatPreko90, 23.1);
  const paket = napraviPaket(usisajListu(izvori), { sada: SADA });
  assert.equal(paket.sazetak.izvora, 312);
  assert.equal(paket.sazetak.duplikata, 47);
  assert.equal(paket.sazetak.konflikata, 12);
  assert.ok(paket.sazetak.chunkova > 100, 'the pack must not be empty');
  assert.ok(paket.izbaceno.length > 0, 'dropped sources must be explained');
});
