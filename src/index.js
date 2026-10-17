// index.js — FAÇADE: ista mašina, najkraći mogući tok (copy-paste oblik):
//
//   import { ingestor, deduper, freshness, packer } from './src/index.js'
//   const izvori = ingestor('./data/knowledge')            // 312 fajlova -> 312 izvora
//   const cisti  = deduper(izvori)                          // 265 posle 47 duplikata
//   const prov   = freshness(cisti, { ttlDana: 90 })        // 12 konflikata, 23% starije
//   const paketi = packer(prov, { pitanje: 'koja je cena refund-a?' })
//
// Ispod façade-a je isti engine koji se testira (freshness/packer/deduper sa punim opcijama).
import { usisajFolder, usisajListu, okvir } from './ingestor.js';
import { nadjiTacneDuplikate, nadjiKonflikte, sazetak } from './deduper.js';
import { ucitajPolitiku, ocijeniSve, ttlZa } from './freshness.js';
import { napraviPaket, poklapanje, dokazLinija } from './packer.js';
import { detektuj, rediguj } from './sensitive.js';

/** Usis: folder (string) ili lista zapisa. Vraća listu izvora spremnih za dalje. */
export function ingestor(izvor) {
  if (typeof izvor === 'string') return usisajFolder(izvor);
  return usisajListu(Array.isArray(izvor) ? izvor : []);
}

/** Dedup: vraća ČISTU listu (bez duplikata), sa `_stat` za izveštaj. Duplikati se zadržavaju kao nalaz. */
export function deduper(izvori = []) {
  const grupe = nadjiTacneDuplikate(izvori);
  const visak = new Set(grupe.flatMap((g) => g.clanovi.filter((c) => c !== g.kanonski)));
  const cisti = izvori.filter((s) => !visak.has(s.id));
  cisti._stat = { ulaz: izvori.length, obrisano: visak.size, ostalo: cisti.length, grupe: grupe.length, detalji: grupe };
  return cisti;
}

/** Svežina + konflikti + PII oznaka. `ttlDana` je prečica za jedan TTL (inače policy.json po tipu). */
export function freshness(izvori = [], { ttlDana = null, sada = null } = {}) {
  const osnovna = ucitajPolitiku();
  const politika = ttlDana
    ? { ...osnovna, defaultTtlDays: ttlDana, ttlDaysByType: Object.fromEntries(Object.keys(osnovna.ttlDaysByType || {}).map((k) => [k, ttlDana])) }
    : osnovna;
  const { ocjene, sazetak: sz } = ocijeniSve(izvori, { sada: sada ?? undefined, politika });
  const ocjenaPoId = new Map(ocjene.map((o) => [o.id, o]));
  const zapisi = izvori.map((s) => {
    const o = ocjenaPoId.get(s.id) || {};
    const pii = detektuj(s.tekst || '');
    let flag = s.flag || null;
    if (!s.owner) flag = 'bez-vlasnika';
    if (!s.id) flag = 'bez-izvora';
    if (pii.length) flag = 'osetljivo';
    else if (o.status === 'expired' && !flag) flag = 'zastarelo';
    if (!flag) flag = 'sveze';
    return {
      ...s,
      flag,
      starost: o.ageDays === null || o.ageDays === undefined ? null : Math.floor(o.ageDays),
      score: o.score ?? 0,
      ttl: o.ttl ?? ttlZa(s.tip, politika),
      pii: pii.length ? pii : undefined,
      tekstRedigovan: pii.length ? rediguj(s.tekst) : undefined,
    };
  });
  const konflikti = nadjiKonflikte(izvori).map((k) => ({ tip: 'konflikt', kljuc: k.key, vrednosti: [...new Set(k.vrednosti.map((v) => v.value))], izvori: k.izvori }));
  return {
    zapisi,
    konflikti,
    statistika: {
      ulaz: izvori._stat?.ulaz ?? izvori.length,
      duplikatiObrisano: izvori._stat?.obrisano ?? 0,
      ostalo: zapisi.length,
      zastarelo: zapisi.filter((z) => z.flag === 'zastarelo').length,
      bezVlasnika: zapisi.filter((z) => z.flag === 'bez-vlasnika').length,
      osetljivo: zapisi.filter((z) => z.flag === 'osetljivo').length,
      konflikti: konflikti.length,
      ...sz,
    },
  };
}

/** Paket: prima izlaz iz `freshness()` (ili listu izvora). Sa `pitanje` rangira po relevantnosti. */
export function packer(provereni, opcije = {}) {
  const izvori = Array.isArray(provereni) ? provereni : (provereni.zapisi || []);
  const paket = napraviPaket(izvori, opcije);
  if (opcije.sirovo) return paket;
  return paket.chunkovi;
}

export { napraviPaket, poklapanje, dokazLinija, sazetak, ucitajPolitiku, detektuj, rediguj };
