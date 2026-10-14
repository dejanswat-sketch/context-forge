import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { podeliNaChunkove, napraviPaket, upisiPaket } from '../src/packer.js';
import { usisajListu } from '../src/ingestor.js';

const SADA = Date.parse('2026-10-14T12:00:00Z');
const prije = (dana) => new Date(SADA - dana * 86400000).toISOString();
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cf-pack-'));

const dobar = (id, tekst, extra = {}) => ({ id, tip: 'docs', tekst, owner: 'prodaja@firma', updatedAt: prije(5), ...extra });

test('chunks split by paragraph and respect max length', () => {
  const tekst = ['a'.repeat(400), 'b'.repeat(400), 'c'.repeat(400)].join('\n\n');
  const c = podeliNaChunkove(tekst, { maxChunkChars: 900, minChunkChars: 10, maxChunksPerSource: 8 });
  assert.equal(c.length, 2);
  assert.ok(c.every((x) => x.length <= 900));
});

test('short fragments are dropped and max chunks per source is respected', () => {
  const c = podeliNaChunkove('kratko\n\novaj deo je dovoljno dugacak za chunk', { minChunkChars: 20 });
  assert.equal(c.length, 1);
  const mnogo = Array.from({ length: 20 }, (_, i) => `pasus broj ${i} `.repeat(20)).join('\n\n');
  assert.equal(podeliNaChunkove(mnogo, { maxChunkChars: 300, minChunkChars: 10, maxChunksPerSource: 3 }).length, 3);
});

test('every chunk carries a citation with source hash and freshness', () => {
  const izvori = usisajListu([dobar('a.md', 'Ovo je dovoljno dugacak tekst za jedan chunk u paketu.')]);
  const paket = napraviPaket(izvori, { sada: SADA });
  assert.equal(paket.sazetak.chunkova, 1);
  const c = paket.chunkovi[0];
  assert.equal(c.citat.izvor, 'a.md');
  assert.match(c.citat.sha256, /^[0-9a-f]{64}$/);
  assert.match(c.citat.chunkHash, /^[0-9a-f]{64}$/);
  assert.equal(c.svezina.status, 'fresh');
  assert.ok(c.svezina.score > 0.9);
});

test('expired knowledge never enters the pack (and says why)', () => {
  const izvori = usisajListu([
    dobar('nov.md', 'Svez tekst koji treba da udje u paket bez problema.'),
    dobar('star.md', 'Star tekst koji ne sme da udje u paket jer je istekao.', { updatedAt: prije(300) }),
  ]);
  const paket = napraviPaket(izvori, { sada: SADA });
  assert.equal(paket.sazetak.chunkova, 1);
  assert.equal(paket.chunkovi[0].citat.izvor, 'nov.md');
  assert.ok(paket.izbaceno.some((x) => x.id === 'star.md' && /isteklo/.test(x.razlog)));
});

test('a source without a date is excluded (freshness cannot be proven)', () => {
  const izvori = usisajListu([dobar('bezdatuma.md', 'Tekst bez datuma koji ne moze da dokaze svezinu.', { updatedAt: null })]);
  const paket = napraviPaket(izvori, { sada: SADA });
  assert.equal(paket.sazetak.chunkova, 0);
  assert.match(paket.izbaceno[0].razlog, /nema datuma/);
});

test('conflicted sources are kept out of the pack and listed for a human', () => {
  const izvori = usisajListu([
    dobar('a.md', 'Cena starter paketa je 29 eura mesecno za sve klijente.', { facts: [{ key: 'cijena:starter', value: '29' }] }),
    dobar('b.md', 'Cena starter paketa je 39 eura mesecno za sve klijente.', { facts: [{ key: 'cijena:starter', value: '39' }] }),
    dobar('c.md', 'Nepovezan tekst o necemu drugom sto nije cena.', { facts: [{ key: 'cijena:pro', value: '79' }] }),
  ]);
  const paket = napraviPaket(izvori, { sada: SADA });
  assert.equal(paket.sazetak.konflikata, 1);
  assert.ok(paket.konflikti[0].key === 'cijena:starter');
  assert.equal(paket.chunkovi.filter((c) => c.citat.izvor === 'c.md').length, 1);
  assert.ok(paket.izbaceno.some((x) => x.id === 'a.md' && /konflikt/.test(x.razlog)));
});

test('duplicates are not packed twice (only the canonical survives)', () => {
  const izvori = usisajListu([
    dobar('prvi.md', 'Potpuno isti tekst u dva dokumenta za test duplikata.'),
    dobar('drugi.md', 'Potpuno isti tekst u dva dokumenta za test duplikata.', { updatedAt: prije(1) }),
  ]);
  const paket = napraviPaket(izvori, { sada: SADA });
  assert.equal(paket.sazetak.chunkova, 1);
  assert.equal(paket.sazetak.duplikata, 1);
});

test('the pack is deterministic: same input -> same package hash', () => {
  const izvori = usisajListu([dobar('a.md', 'Tekst za deterministicki test paketa i hasha.')]);
  const p1 = napraviPaket(izvori, { sada: SADA });
  const p2 = napraviPaket(izvori, { sada: SADA });
  assert.equal(p1.paketHash, p2.paketHash);
});

test('writing a pack produces json + md (with citations) + sha256', () => {
  const d = tmp();
  const izvori = usisajListu([dobar('a.md', 'Tekst koji ide u paket i u markdown fajl sa citatom.')]);
  const paket = napraviPaket(izvori, { sada: SADA });
  const p = upisiPaket(paket, d);
  assert.ok(fs.existsSync(p.json));
  assert.ok(fs.existsSync(p.md));
  assert.ok(fs.existsSync(path.join(d, 'pack.sha256')));
  const md = fs.readFileSync(p.md, 'utf8');
  assert.match(md, /source: `a\.md`/);
  assert.match(md, /sha256/);
  fs.rmSync(d, { recursive: true, force: true });
});
