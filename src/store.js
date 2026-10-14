// store.js — append-only zapisi + hash dokazi. Isti princip kao u AgentGuard Lite, ali ovdje čuva ZNANJE.
//
// ZAŠTO append-only: kod znanja se mijenja SADRŽAJ, a ne smije se izgubiti dokaz šta je bilo ranije.
// Zato svaki ingest i svaki paket ostaju zapisani, sa hashom — auditor može da rekonstruiše stanje bilo kog dana.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function hashTeksta(tekst) { return crypto.createHash('sha256').update(String(tekst ?? ''), 'utf8').digest('hex'); }
export function hashFajla(put) { try { return hashTeksta(fs.readFileSync(put, 'utf8')); } catch { return null; } }

export function appendJsonl(put, zapis) {
  fs.mkdirSync(path.dirname(put), { recursive: true });
  fs.appendFileSync(put, JSON.stringify(zapis) + '\n', 'utf8');
  return zapis;
}

export function citajJsonl(put) {
  try {
    return fs.readFileSync(put, 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/** Zadnje stanje po id-u iz append-only zapisa (dogadjaj: 'source'). */
export function zadnjiIzvori(put) {
  const po = new Map();
  for (const z of citajJsonl(put)) if (z.dogadjaj === 'source') po.set(z.id, z);
  return [...po.values()];
}

/** Snimak (snapshot) znanja: jedan hash preko svih izvora — „dokaz svežine" za jedan dan. */
export function snimakHash(izvori = []) {
  const kanon = [...izvori].map((s) => `${s.id}:${s.hash}`).sort().join('\n');
  return hashTeksta(kanon);
}
