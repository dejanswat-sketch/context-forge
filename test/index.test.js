import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ingestor, deduper, freshness, packer } from '../src/index.js';
import { poklapanje, dokazLinija, napraviPaket } from '../src/packer.js';
import { ROOT } from '../src/scenarios.js';

const SADA = Date.parse('2026-10-14T12:00:00Z');
const FOLDER = path.join(ROOT, 'data', 'knowledge');

test('the façade reads a real folder (not a generated corpus)', () => {
  const z = ingestor(FOLDER);
  assert.equal(z.length, 5);
  assert.ok(z.every((s) => s.hash && s.tekst));
  const p = z.find((s) => s.id === 'policy_2026.md');
  assert.equal(p.owner, 'finansije');                 // iz zaglavlja "vlasnik:"
  assert.equal(String(p.updatedAt).slice(0, 10), '2026-10-10');   // iz zaglavlja "datum:"
  assert.equal(p.dateSource, 'text');
});

test('deduper removes duplicates and reports what it removed', () => {
  const z = ingestor([
    { id: 'a.md', tekst: 'isti tekst o refundu i ceni' },
    { id: 'b.md', tekst: 'isti tekst o refundu i ceni' },
    { id: 'c.md', tekst: 'drugi tekst o necemu sasvim desetom' },
  ]);
  const cisti = deduper(z);
  assert.equal(cisti.length, 2);
  assert.equal(cisti._stat.obrisano, 1);
  assert.equal(cisti._stat.grupe, 1);
});

test('freshness flags every taxonomy case', () => {
  const z = ingestor(FOLDER);
  const { zapisi, konflikti, statistika } = freshness(z, { ttlDana: 90, sada: SADA });
  const flag = (id) => zapisi.find((x) => x.id === id)?.flag;
  assert.equal(flag('anonimni.md'), 'bez-vlasnika');
  assert.equal(flag('kupci_pii.md'), 'osetljivo');
  assert.equal(flag('policy_2026.md'), 'sveze');
  assert.equal(flag('cenovnik_2023.md'), 'zastarelo');
  assert.equal(statistika.ulaz, 5);
  assert.equal(konflikti.length, 0);
  assert.equal(statistika.bezVlasnika, 1);
  assert.equal(statistika.osetljivo, 1);
});

test('packer returns chunks, and with a question ranks by relevance + freshness', () => {
  const prov = freshness(deduper(ingestor(FOLDER)), { ttlDana: 90, sada: SADA });
  const bez = packer(prov, { sada: SADA });
  const sa = packer(prov, { pitanje: 'refund cena', sada: SADA });
  assert.ok(bez.length >= 1 && sa.length >= 1);
  assert.ok(sa.every((c) => c.match > 0), 'uz pitanje ostaju samo pogoci');
  assert.ok(sa[0].match >= sa[sa.length - 1].match, 'prvi je najrelevantniji');
});

test('matching normalises Serbian variants: "cena" finds "cena"', () => {
  assert.ok(poklapanje('Cena za Starter paket iznosi 29 EUR', 'cena starter') > 0.5);
  assert.equal(poklapanje('nepovezan tekst o vremenu', 'refund iban'), 0);
});

test('every chunk carries a one-line proof for the auditor', () => {
  const paket = napraviPaket(ingestor(FOLDER), { sada: SADA });
  assert.ok(paket.chunkovi.length > 0);
  for (const c of paket.chunkovi) {
    assert.match(c.dokaz, /^sha256:[0-9a-f]{16}\|izvor:.+\|datum:\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(dokazLinija('abcdef0123456789ff', 'a.md', '2026-10-10'), 'sha256:abcdef0123456789|izvor:a.md|datum:2026-10-10');
});

test('nothing is dropped silently: every missing source has a reason', () => {
  const z = ingestor(FOLDER);
  const paket = napraviPaket(z, { sada: SADA });
  const uPaketu = new Set(paket.chunkovi.map((c) => c.citat.izvor));
  const izbaceni = new Set(paket.izbaceno.map((x) => x.id));
  for (const s of z) {
    if (!uPaketu.has(s.id)) assert.ok(izbaceni.has(s.id), `${s.id} je nestao bez razloga`);
  }
  assert.ok(paket.izbaceno.every((x) => x.razlog && x.razlog.length > 3), 'svaki razlog mora biti ispisan');
});
