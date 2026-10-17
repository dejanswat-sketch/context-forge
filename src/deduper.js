// deduper.js — duplikati (isti sadržaj na više mesta) i KONFLIKTI (isti podatak, različita vrednost).
//
// Zašto oboje u jednom modulu: oba pitanja su „isti ključ, više izvora". Duplikat = ista vrednost;
// konflikt = različita vrednost. Konflikt se NIKAD ne rešava automatski — ide čovjeku.
import { hashTeksta } from './store.js';

/** Tačni duplikati po hash-u sadržaja. Vraća grupe; kanonski izvor je najsvježiji (pa najveći). */
export function nadjiTacneDuplikate(izvori = []) {
  const po = new Map();
  for (const s of izvori) {
    const k = s.hash || hashTeksta(s.tekst || '');
    if (!po.has(k)) po.set(k, []);
    po.get(k).push(s);
  }
  const grupe = [];
  for (const [hash, clanovi] of po) {
    if (clanovi.length < 2) continue;
    const kanonski = [...clanovi].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || (b.bytes || 0) - (a.bytes || 0))[0];
    grupe.push({ hash, kanonski: kanonski.id, clanovi: clanovi.map((c) => c.id), ustedaBajtova: clanovi.filter((c) => c.id !== kanonski.id).reduce((z, c) => z + (c.bytes || 0), 0) });
  }
  return grupe.sort((a, b) => b.clanovi.length - a.clanovi.length);
}

const tokeni = (t) => new Set(String(t || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((x) => x.length > 2));

/** Jaccard sličnost tokena (0..1) — bez zavisnosti, dovoljno za „skoro isti dokument". */
export function slicnost(a, b) {
  const A = tokeni(a), B = tokeni(b);
  if (!A.size || !B.size) return 0;
  let presjek = 0;
  for (const x of A) if (B.has(x)) presjek++;
  return presjek / (A.size + B.size - presjek);
}

/** Skoro-duplikati (iznad praga), bez ponavljanja parova. */
export function nadjiSlicne(izvori = [], prag = 0.85) {
  const parovi = [];
  for (let i = 0; i < izvori.length; i++) {
    for (let j = i + 1; j < izvori.length; j++) {
      if (izvori[i].hash === izvori[j].hash) continue;              // tačan duplikat je već nađen
      const s = slicnost(izvori[i].tekst, izvori[j].tekst);
      if (s >= prag) parovi.push({ a: izvori[i].id, b: izvori[j].id, slicnost: +s.toFixed(3) });
    }
  }
  return parovi.sort((x, y) => y.slicnost - x.slicnost);
}

/**
 * Konflikti: isti `key` u `facts`, različita `value`.
 * @returns {{key:string, vrednosti:Array<{value:string, izvor:string, updatedAt:string}>, izvori:string[]}[]}
 */
export function nadjiKonflikte(izvori = []) {
  const po = new Map();
  for (const s of izvori) {
    for (const f of s.facts || []) {
      if (!f || !f.key) continue;
      if (!po.has(f.key)) po.set(f.key, []);
      po.get(f.key).push({ value: String(f.value), izvor: s.id, updatedAt: s.updatedAt || null, owner: s.owner || null });
    }
  }
  const konflikti = [];
  for (const [key, stavke] of po) {
    const vrednosti = [...new Set(stavke.map((x) => x.value))];
    if (vrednosti.length > 1) {
      konflikti.push({ key, vrednosti: stavke, izvori: [...new Set(stavke.map((x) => x.izvor))], brojRazlicitih: vrednosti.length });
    }
  }
  return konflikti.sort((a, b) => b.brojRazlicitih - a.brojRazlicitih || a.key.localeCompare(b.key));
}

/** Sažetak za izveštaj: koliko je ušteđeno i koliko ide čovjeku. */
export function sazetak(izvori = [], { prag = 0.85 } = {}) {
  const tacni = nadjiTacneDuplikate(izvori);
  const konflikti = nadjiKonflikte(izvori);
  return {
    izvora: izvori.length,
    grupaDuplikata: tacni.length,
    duplikata: tacni.reduce((z, g) => z + g.clanovi.length - 1, 0),
    ustedaBajtova: tacni.reduce((z, g) => z + g.ustedaBajtova, 0),
    konflikata: konflikti.length,
    konfliktniKljucevi: konflikti.map((k) => k.key),
    grupe: tacni,
    konflikti,
  };
}
