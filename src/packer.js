// packer.js — pravi RAG paket: chunk + CITAT + ocjena svežine + hash dokaza (+ rangiranje po PITANJU).
//
// PRAVILA (policy.json → pack):
//   · istekao izvor ili bez datuma se NE pakuje — agent ne smije da čita nedokazivo znanje
//   · PII/osetljivo se NE pakuje; nalaz ide u izvještaj REDIGOVAN (nikad čist podatak)
//   · konfliktni ključevi se NE pakuju — idu čovjeku
//   · svaki chunk nosi citat (izvor, vlasnik, datum, sha256) i `dokaz` liniju za audit
//   · ako je zadato `pitanje`, paket se sortira po (svežina * 0.6 + poklapanje * 0.4)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ucitajPolitiku, ocijeniSve } from './freshness.js';
import { nadjiTacneDuplikate, nadjiKonflikte } from './deduper.js';
import { detektuj, rediguj } from './sensitive.js';
import { hashTeksta } from './store.js';

/** Podijeli tekst na chunkove po pasusima, uz maksimalnu dužinu. */
export function podeliNaChunkove(tekst, { maxChunkChars = 900, minChunkChars = 40, maxChunksPerSource = 8 } = {}) {
  const delovi = String(tekst || '').split(/\n{2,}/).map((d) => d.trim()).filter(Boolean);
  const chunkovi = [];
  let tekuci = '';
  for (const d of delovi) {
    if (tekuci && (tekuci.length + d.length + 2) > maxChunkChars) { chunkovi.push(tekuci); tekuci = d; }
    else tekuci = tekuci ? tekuci + '\n\n' + d : d;
    while (tekuci.length > maxChunkChars) { chunkovi.push(tekuci.slice(0, maxChunkChars)); tekuci = tekuci.slice(maxChunkChars).trim(); }
  }
  if (tekuci) chunkovi.push(tekuci);
  return chunkovi.filter((c) => c.length >= minChunkChars).slice(0, maxChunksPerSource);
}

// Normalizacija za poklapanje: bez dijakritike i sa ije->e, da "cijena" i "cena" budu isti pojam.
const srb = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ije/g, 'e').replace(/dj/g, 'd');
const tokeni = (t) => srb(t).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((x) => x.length > 2);

/** Koliko se chunk poklapa sa pitanjem (0..1). Deterministički; embeddings su kasnije, svjesno. */
export function poklapanje(tekst, pitanje) {
  const k = tokeni(pitanje);
  if (!k.length) return 1;
  const t = srb(tekst);
  const pogodjenih = k.filter((x) => t.includes(x)).length;
  return +(pogodjenih / k.length).toFixed(3);
}

/** Dokaz porekla u jednoj liniji (auditor može da ga prepiše u nalaz). */
export const dokazLinija = (hash, izvor, datum) => `sha256:${String(hash).slice(0, 16)}|izvor:${izvor}|datum:${datum}`;

export function napraviPaket(izvori = [], opcije = {}) {
  const politika = opcije.politika || ucitajPolitiku();
  const pack = politika.pack || {};
  const cfg = {
    maxChunkChars: opcije.maxChunkChars ?? pack.maxChunkChars ?? 900,
    minChunkChars: opcije.minChunkChars ?? pack.minChunkChars ?? 40,
    maxChunksPerSource: opcije.maxChunksPerSource ?? pack.maxChunksPerSource ?? 8,
    excludeExpired: opcije.excludeExpired ?? pack.excludeExpired ?? true,
    excludeConflicted: opcije.excludeConflicted ?? pack.excludeConflicted ?? true,
    excludeSensitive: opcije.excludeSensitive ?? pack.excludeSensitive ?? true,
    excludeNoSource: opcije.excludeNoSource ?? pack.excludeNoSource ?? true,
    pitanje: opcije.pitanje || '',
    tezinaSvezine: opcije.tezinaSvezine ?? 0.6,
    tezinaPoklapanja: opcije.tezinaPoklapanja ?? 0.4,
  };

  const { ocjene, sazetak } = ocijeniSve(izvori, { sada: opcije.sada, politika });
  const ocjenaPoId = new Map(ocjene.map((o) => [o.id, o]));
  const duplikati = nadjiTacneDuplikate(izvori);
  const duplikatClanovi = new Set(duplikati.flatMap((g) => g.clanovi.filter((c) => c !== g.kanonski)));
  const konflikti = nadjiKonflikte(izvori);
  const konfliktniKljucevi = new Set(konflikti.map((k) => k.key));

  const chunkovi = [];
  const izbaceno = [];
  const osetljivi = [];

  for (const s of izvori) {
    const ocjena = ocjenaPoId.get(s.id);
    const pii = detektuj(s.tekst || '');
    if (pii.length) {
      const vrste = [...new Set(pii.map((p) => p.vrsta))];
      osetljivi.push({ id: s.id, vrste, nalazi: pii.slice(0, 5) });
      if (cfg.excludeSensitive) { izbaceno.push({ id: s.id, razlog: 'osetljivo: PII u izvoru (' + vrste.join(', ') + ')' }); continue; }
    }
    if (cfg.excludeNoSource && !s.id) { izbaceno.push({ id: '(nema id)', razlog: 'nema izvora — poreklo se ne može dokazati' }); continue; }
    if (duplikatClanovi.has(s.id)) { izbaceno.push({ id: s.id, razlog: 'duplikat (isti sadržaj na drugom mjestu)' }); continue; }
    if (cfg.excludeExpired && ocjena.status === 'expired') { izbaceno.push({ id: s.id, razlog: `isteklo: ${ocjena.reason}` }); continue; }
    if (cfg.excludeExpired && ocjena.status === 'unknown') { izbaceno.push({ id: s.id, razlog: 'nema datuma — svežina se ne može dokazati' }); continue; }

    const sporno = (s.facts || []).some((f) => konfliktniKljucevi.has(f.key));
    if (cfg.excludeConflicted && sporno) { izbaceno.push({ id: s.id, razlog: 'sadrži konfliktan podatak — ide čovjeku' }); continue; }

    const tekst = pii.length ? rediguj(s.tekst) : s.tekst;
    const delovi = podeliNaChunkove(tekst, cfg);
    // NIJEDNO izbacivanje ne smije biti tiho: ako izvor ne da nijedan chunk, piše zašto.
    if (!delovi.length) { izbaceno.push({ id: s.id, razlog: `prekratko za paket (< ${cfg.minChunkChars} znakova)` }); continue; }
    for (const [i, deo] of delovi.entries()) {
      chunkovi.push({
        id: `${s.id}#${i + 1}`,
        tekst: deo,
        citat: {
          izvor: s.id, tip: s.tip, owner: s.owner, updatedAt: s.updatedAt, dateSource: s.dateSource,
          sha256: s.hash, chunkHash: hashTeksta(deo),
        },
        svezina: { score: ocjena.score, status: ocjena.status, ageDays: ocjena.ageDays, ttl: ocjena.ttl },
        match: poklapanje(deo, cfg.pitanje),
        flag: s.owner ? undefined : 'bez-vlasnika',
        dokaz: dokazLinija(s.hash, s.id, (s.updatedAt || '').slice(0, 10)),
      });
    }
  }

  if (cfg.pitanje) {
    const kljucne = tokeni(cfg.pitanje);
    const filtrirani = kljucne.length ? chunkovi.filter((c) => c.match > 0) : chunkovi;
    filtrirani.sort((a, b) =>
      (b.svezina.score * cfg.tezinaSvezine + b.match * cfg.tezinaPoklapanja) -
      (a.svezina.score * cfg.tezinaSvezine + a.match * cfg.tezinaPoklapanja));
    chunkovi.length = 0;
    chunkovi.push(...filtrirani.slice(0, opcije.maxChunkova ?? 5));
  } else {
    chunkovi.sort((a, b) => b.svezina.score - a.svezina.score);
  }

  const telo = {
    at: new Date().toISOString(),
    pitanje: cfg.pitanje || null,
    politika: { verzija: politika.version, maxChunkChars: cfg.maxChunkChars, tezine: [cfg.tezinaSvezine, cfg.tezinaPoklapanja] },
    sazetak: {
      izvora: izvori.length,
      chunkova: chunkovi.length,
      izbaceno: izbaceno.length,
      duplikata: duplikatClanovi.size,
      grupaDuplikata: duplikati.length,
      konflikata: konflikti.length,
      osetljivih: osetljivi.length,
      svezina: sazetak,
    },
    chunkovi, izbaceno, konflikti, osetljivi,
  };
  telo.paketHash = hashTeksta(JSON.stringify(telo.chunkovi));
  return telo;
}

export function upisiPaket(paket, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const json = JSON.stringify(paket, null, 1);
  fs.writeFileSync(path.join(dir, 'pack.json'), json, 'utf8');
  const md = [
    `# RAG pack — ${paket.at.slice(0, 10)}${paket.pitanje ? ` · pitanje: „${paket.pitanje}"` : ''}`, '',
    `Sources **${paket.sazetak.izvora}** · chunks **${paket.sazetak.chunkova}** · dropped **${paket.sazetak.izbaceno}**`,
    `Duplicates **${paket.sazetak.duplikata}** (${paket.sazetak.grupaDuplikata} groups) · conflicts **${paket.sazetak.konflikata}** · sensitive **${paket.sazetak.osetljivih}**`,
    `Freshness: fresh ${paket.sazetak.svezina.fresh} · stale ${paket.sazetak.svezina.stale} · expired ${paket.sazetak.svezina.expired} · no date ${paket.sazetak.svezina.unknown}`,
    `Knowledge older than 90 days: **${paket.sazetak.svezina.procenatPreko90}%**`, '',
    ...paket.chunkovi.map((c) => [
      `## ${c.id}${c.match !== undefined ? ` · match ${c.match}` : ''}`, '',
      c.tekst, '',
      `> source: \`${c.citat.izvor}\` · owner: ${c.citat.owner || '—'} · updated: ${String(c.citat.updatedAt).slice(0, 10)} · freshness ${c.svezina.score} (${c.svezina.status})`,
      `> ${c.dokaz}`, '',
    ].join('\n')),
    '## Dropped (and why)', '',
    ...(paket.izbaceno.length ? paket.izbaceno.map((x) => `- \`${x.id}\` — ${x.razlog}`) : ['- nothing dropped']), '',
    '## Conflicts (human decision required)', '',
    ...(paket.konflikti.length ? paket.konflikti.map((k) => `- **${k.key}**: ${k.vrijednosti.map((v) => `${v.value} (\`${v.izvor}\`, ${String(v.updatedAt).slice(0, 10)})`).join(' vs ')}`) : ['- none']), '',
    '## Sensitive sources (redacted — never packed)', '',
    ...(paket.osetljivi.length ? paket.osetljivi.map((x) => `- \`${x.id}\` — ${x.vrste.join(', ')}`) : ['- none']), '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'pack.md'), md, 'utf8');
  fs.writeFileSync(path.join(dir, 'pack.sha256'), `${crypto.createHash('sha256').update(json).digest('hex')}  pack.json\n`, 'utf8');
  return { json: path.join(dir, 'pack.json'), md: path.join(dir, 'pack.md'), hash: paket.paketHash };
}
