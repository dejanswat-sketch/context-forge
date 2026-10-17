// freshness.js — koliko je znanje staro, čije je, i dokle važi. Ovo je „svežina" koju niko ne meri.
//
// PRAVILA (iz policy.json, ne iz koda):
//   · svaki tip znanja ima TTL (cjenovnik 30 dana, ugovor 365…)
//   · score: 1 na dan 0 → 0 na dan = TTL (linearno, da auditor može da preračuna)
//   · status: `fresh` (< 60% TTL) · `stale` (60–100%) · `expired` (> TTL)
//   · istekao izvor se NE pakuje u RAG paket; prijavljuje se kao rizik
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ucitajPolitiku = (p = path.join(ROOT, 'policy.json')) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** TTL za tip izvora (dana). */
export function ttlZa(tip, politika) {
  const p = politika || ucitajPolitiku();
  return Number(p.ttlDaysByType?.[String(tip || '').toLowerCase()] ?? p.defaultTtlDays ?? 180);
}

export const danaStarosti = (updatedAt, sada = Date.now()) => {
  if (!updatedAt) return null;
  const t = Date.parse(updatedAt);
  return Number.isFinite(t) ? +((sada - t) / 86400000).toFixed(2) : null;
};

/** Ocjena jednog izvora: starost, TTL, score, status. */
export function ocijeni(izvor, { sada = Date.now(), politika } = {}) {
  const p = politika || ucitajPolitiku();
  const ttl = ttlZa(izvor.tip, p);
  const starost = danaStarosti(izvor.updatedAt, sada);
  if (starost === null) return { id: izvor.id, ttl, ageDays: null, score: 0, status: 'unknown', reason: 'nema datuma — ne može se dokazati svežina' };
  const odnos = ttl > 0 ? starost / ttl : 1;
  const score = +Math.max(0, Math.min(1, 1 - odnos)).toFixed(3);
  const staleGranica = Number(p.freshness?.staleAfterRatio ?? 0.6);
  const status = odnos <= staleGranica ? 'fresh' : odnos <= 1 ? 'stale' : 'expired';
  return { id: izvor.id, tip: izvor.tip, owner: izvor.owner || null, updatedAt: izvor.updatedAt, ttl, ageDays: starost, score, status, reason: `${starost} dana / TTL ${ttl}` };
}

/** Ocjena svih izvora + sažetak rizika. */
export function ocijeniSve(izvori = [], opcije = {}) {
  const ocjene = izvori.map((s) => ocijeni(s, opcije));
  const bezDatuma = ocjene.filter((o) => o.status === 'unknown').length;
  const svjezi = ocjene.filter((o) => o.status === 'fresh').length;
  const stari = ocjene.filter((o) => o.status === 'stale').length;
  const istekli = ocjene.filter((o) => o.status === 'expired').length;
  const preko90 = ocjene.filter((o) => (o.ageDays ?? 0) > 90).length;
  return {
    ocjene,
    sazetak: {
      izvora: izvori.length,
      fresh: svjezi, stale: stari, expired: istekli, unknown: bezDatuma,
      procenatPreko90: izvori.length ? +((preko90 / izvori.length) * 100).toFixed(1) : 0,
      prosjecanScore: ocjene.length ? +(ocjene.reduce((z, o) => z + o.score, 0) / ocjene.length).toFixed(3) : 0,
      bezVlasnika: izvori.filter((s) => !s.owner).length,
    },
  };
}

/** Ima li izvor vlasnika (za izveštaj: znanje bez vlasnika je rizik odgovornosti). */
export const imaVlasnika = (izvor) => Boolean(izvor.owner);
