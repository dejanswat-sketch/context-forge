import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detektuj, rediguj, imaPII, vrstePII, oznaciOsetljive } from '../src/sensitive.js';
import { napraviPaket } from '../src/packer.js';
import { usisajListu } from '../src/ingestor.js';

const SADA = Date.parse('2026-10-14T12:00:00Z');

test('detects the personal data a company must never hand to an agent', () => {
  const t = 'Kupac Jovan, JMBG 0101990712345, IBAN RS35260005601001611379, tel +381 64 123 4567, email jovan@primer.rs, kartica 4111 1111 1111 1111';
  const vrste = new Set(detektuj(t).map((n) => n.vrsta));
  for (const v of ['jmbg', 'iban', 'telefon', 'email', 'kartica']) assert.ok(vrste.has(v), `nema ${v}`);
});

test('detects secrets and passwords', () => {
  assert.ok(detektuj('token: ghp_abcdefghijklmnopqrstuvwxyz012345').some((n) => n.vrsta === 'tajna'));
  assert.ok(detektuj('lozinka: tajna123').some((n) => n.vrsta === 'lozinka'));
});

test('the finding is always redacted — the raw value never leaves the check', () => {
  const t = 'JMBG 0101990712345 i IBAN RS35260005601001611379';
  const nalazi = detektuj(t);
  assert.ok(nalazi.length >= 2);
  for (const n of nalazi) {
    assert.ok(!n.primer.includes('0101990712345'), 'JMBG ne smije biti u nalazu');
    assert.ok(!n.primer.includes('RS35260005601001611379'), 'IBAN ne smije biti u nalazu');
  }
  assert.ok(!rediguj(t).includes('0101990712345'));
});

test('clean text yields nothing (no false alarms on normal business text)', () => {
  assert.equal(imaPII('Refund do 1000€ dozvoljen uz odobrenje finansija.'), false);
  assert.deepEqual(vrstePII('Cenovnik za Starter paket je 29 EUR mesečno.'), []);
});

test('marking sources sets the flag and keeps a redacted copy', () => {
  const [o] = oznaciOsetljive([{ id: 'kupci.md', tekst: 'email jovan@primer.rs', owner: 'x' }]);
  assert.equal(o.flag, 'osetljivo');
  assert.ok(o.pii.length > 0);
  assert.ok(!o.tekstRedigovan.includes('jovan@primer.rs'));
});

test('a pack NEVER contains a sensitive source, and says why it was dropped', () => {
  const izvori = usisajListu([
    { id: 'cist.md', tekst: 'Refund do 1000€ dozvoljen uz odobrenje finansija.', owner: 'finansije', updatedAt: '2026-10-10' },
    { id: 'kupci.md', tekst: 'Kupac Jovan, JMBG 0101990712345, IBAN RS35260005601001611379 — refund odobren.', owner: 'podrska', updatedAt: '2026-10-05' },
  ]);
  const paket = napraviPaket(izvori, { sada: SADA });
  assert.equal(paket.sazetak.osetljivih, 1);
  assert.ok(paket.izbaceno.some((x) => x.id === 'kupci.md' && /osetljivo/.test(x.razlog)));
  const sve = JSON.stringify(paket.chunkovi);
  assert.ok(!sve.includes('0101990712345'), 'JMBG ne smije u paket');
  assert.ok(!sve.includes('RS35260005601001611379'), 'IBAN ne smije u paket');
  assert.equal(paket.chunkovi.filter((c) => c.citat.izvor === 'cist.md').length, 1);
});
