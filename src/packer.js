// packer.js — pravi RAG paket: chunk + CITAT + ocjena svežine + hash dokaza.
//
// PRAVILA (policy.json → pack):
//   · istekao izvor (score 0) se NE pakuje — agent ne smije da čita zastarjelo
//   · konfliktni ključevi se NE pakuju bez oznake — idu u paket kao `sporno` sa svim vrijednostima
//   · svaki chunk nosi citat: izvor, vlasnik, datum, sha256 → agent može da pokaže ODAKLE zna
//   · ništa se ne prepisuje i ne „popravlja" tiho: ako nešto nije u paketu, u `izbaceno` piše zašto
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ucitajPolitiku } from './freshness.js';
import { ocijeniSve } from './freshness.js';
import { nadjiTacneDuplikate, nadjiKonflikte } from './deduper.js';
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

/**
 * Napravi paket.
 * @param {Array} izvori       izlaz iz ingestora
 * @param {object} [opcije]    { sada, politika, maxChunkChars, ... }
 * @returns {object} paket sa chunkovima, citatima, izbačenim izvorima i dokazom
 */
export function napraviPaket(izvori = [], opcije = {}) {
  const politika = opcije.politika || ucitajPolitiku();
  const pack = politika.pack || {};
  const cfg = {
    maxChunkChars: opcije.maxChunkChars ?? pack.maxChunkChars ?? 900,
    minChunkChars: opcije.minChunkChars ?? pack.minChunkChars ?? 40,
    maxChunksPerSource: opcije.maxChunksPerSource ?? pack.maxChunksPerSource ?? 8,
    excludeExpired: opcije.excludeExpired ?? pack.excludeExpired ?? true,
    excludeConflicted: opcije.excludeConflicted ?? pack.excludeConflicted ?? true,
  };

  const { ocjene, sazetak } = ocijeniSve(izvori, { sada: opcije.sada, politika });
  const ocjenaPoId = new Map(ocjene.map((o) => [o.id, o]));
  const duplikati = nadjiTacneDuplikate(izvori);
  const duplikatClanovi = new Set(duplikati.flatMap((g) => g.clanovi.filter((c) => c !== g.kanonski)));
  const konflikti = nadjiKonflikte(izvori);
  const konfliktniIzvori = new Set(konflikti.flatMap((k) => k.izvori));
  const konfliktniKljucevi = new Set(konflikti.map((k) => k.key));

  const chunkovi = [];
  const izbaceno = [];

  for (const s of izvori) {
    const ocjena = ocjenaPoId.get(s.id);
    if (duplikatClanovi.has(s.id)) { izbaceno.push({ id: s.id, razlog: 'duplikat (isti sadržaj na drugom mjestu)' }); continue; }
    if (cfg.excludeExpired && ocjena.status === 'expired') { izbaceno.push({ id: s.id, razlog: `isteklo: ${ocjena.reason}` }); continue; }
    if (cfg.excludeExpired && ocjena.status === 'unknown') { izbaceno.push({ id: s.id, razlog: 'nema datuma — svežina se ne može dokazati' }); continue; }

    const sporno = (s.facts || []).some((f) => konfliktniKljucevi.has(f.key));
    if (cfg.excludeConflicted && sporno) { izbaceno.push({ id: s.id, razlog: 'sadrži konfliktan podatak — ide čovjeku' }); continue; }

    for (const [i, tekst] of podeliNaChunkove(s.tekst, cfg).entries()) {
      chunkovi.push({
        id: `${s.id}#${i + 1}`,
        tekst,
        citat: {
          izvor: s.id, tip: s.tip, owner: s.owner, updatedAt: s.updatedAt, dateSource: s.dateSource,
          sha256: s.hash, chunkHash: hashTeksta(tekst),
        },
        svezina: { score: ocjena.score, status: ocjena.status, ageDays: ocjena.ageDays, ttl: ocjena.ttl },
        sporno: sporno || undefined,
      });
    }
  }

  const telo = {
    at: new Date().toISOString(),
    politika: { verzija: politika.version, maxChunkChars: cfg.maxChunkChars },
    sazetak: {
      izvora: izvori.length,
      chunkova: chunkovi.length,
      izbaceno: izbaceno.length,
      duplikata: duplikatClanovi.size,
      grupaDuplikata: duplikati.length,
      konflikata: konflikti.length,
      svezina: sazetak,
    },
    chunkovi,
    izbaceno,
    konflikti,
  };
  telo.paketHash = hashTeksta(JSON.stringify(telo.chunkovi));
  return telo;
}

/** Upiši paket na disk (pack.json, pack.md sa citatima, pack.sha256). */
export function upisiPaket(paket, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const json = JSON.stringify(paket, null, 1);
  fs.writeFileSync(path.join(dir, 'pack.json'), json, 'utf8');
  const md = [
    `# RAG pack — ${paket.at.slice(0, 10)}`,
    '',
    `Sources **${paket.sazetak.izvora}** · chunks **${paket.sazetak.chunkova}** · dropped **${paket.sazetak.izbaceno}**`,
    `Duplicates **${paket.sazetak.duplikata}** (${paket.sazetak.grupaDuplikata} groups) · conflicts **${paket.sazetak.konflikata}**`,
    `Freshness: fresh ${paket.sazetak.svezina.fresh} · stale ${paket.sazetak.svezina.stale} · expired ${paket.sazetak.svezina.expired} · no date ${paket.sazetak.svezina.unknown}`,
    `Knowledge older than 90 days: **${paket.sazetak.svezina.procenatPreko90}%**`,
    '',
    ...paket.chunkovi.map((c) => [
      `## ${c.id}`,
      '',
      c.tekst,
      '',
      `> source: \`${c.citat.izvor}\` · owner: ${c.citat.owner || '—'} · updated: ${String(c.citat.updatedAt).slice(0, 10)} · freshness ${c.svezina.score} (${c.svezina.status}) · sha256 \`${c.citat.sha256.slice(0, 16)}…\``,
      '',
    ].join('\n')),
    '## Dropped (and why)',
    '',
    ...(paket.izbaceno.length ? paket.izbaceno.map((x) => `- \`${x.id}\` — ${x.razlog}`) : ['- nothing dropped']),
    '',
    '## Conflicts (human decision required)',
    '',
    ...(paket.konflikti.length ? paket.konflikti.map((k) => `- **${k.key}**: ${k.vrijednosti.map((v) => `${v.value} (\`${v.izvor}\`, ${String(v.updatedAt).slice(0, 10)})`).join(' vs ')}`) : ['- none']),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'pack.md'), md, 'utf8');
  fs.writeFileSync(path.join(dir, 'pack.sha256'), `${crypto.createHash('sha256').update(json).digest('hex')}  pack.json\n`, 'utf8');
  return { json: path.join(dir, 'pack.json'), md: path.join(dir, 'pack.md'), hash: paket.paketHash };
}
