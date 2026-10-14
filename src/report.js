// report.js — izvještaj za upravu: koliko izvora, koliko duplikata, konflikata i koliko je znanje staro.
//
// Jedna rečenica koju menadžer može da ponovi, plus MD + JSON + sha256 (dokaz da izvještaj nije mijenjan).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ocijeniSve } from './freshness.js';
import { sazetak as sazetakDuplikata } from './deduper.js';

/** ČISTA FUNKCIJA — saberi brojke iz paketa (ili iz izvora). */
export function saberi(paket) {
  const s = paket.sazetak;
  return {
    izvora: s.izvora,
    chunkova: s.chunkova,
    izbaceno: s.izbaceno,
    duplikata: s.duplikata,
    grupaDuplikata: s.grupaDuplikata,
    konflikata: s.konflikata,
    fresh: s.svezina.fresh,
    stale: s.svezina.stale,
    expired: s.svezina.expired,
    bezDatuma: s.svezina.unknown,
    procenatPreko90: s.svezina.procenatPreko90,
    prosjecanScore: s.svezina.prosjecanScore,
    bezVlasnika: s.svezina.bezVlasnika,
    paketHash: paket.paketHash,
    rizik: rizik(s),
  };
}

/** Rizik: istekao + bez datuma + konflikti + staro. Više = gore. */
export function rizik(s) {
  const clanovi = [
    { naziv: 'isteklo znanje', broj: s.svezina.expired, tezina: 3 },
    { naziv: 'bez datuma (nedokaziva svežina)', broj: s.svezina.unknown, tezina: 3 },
    { naziv: 'konflikti', broj: s.konflikata, tezina: 4 },
    { naziv: 'starije od 90 dana', broj: Math.round((s.svezina.procenatPreko90 / 100) * s.izvora), tezina: 1 },
  ];
  const bodovi = clanovi.reduce((z, c) => z + c.broj * c.tezina, 0);
  const nivo = bodovi === 0 ? 'nizak' : bodovi < 20 ? 'srednji' : bodovi < 60 ? 'visok' : 'kritičan';
  return { bodovi, nivo, clanovi: clanovi.filter((c) => c.broj > 0) };
}

/** Rečenica za upravu (jedna, mjerljiva). */
export function recenica(r) {
  return `${r.izvora} izvora znanja: ${r.duplikata} duplikata (${r.grupaDuplikata} grupa), ` +
    `${r.konflikata} konflikata (traži čovjeka), ${r.procenatPreko90}% starije od 90 dana, ` +
    `${r.expired} isteklo i ${r.bezDatuma} bez datuma. Rizik: **${r.rizik.nivo}** (${r.rizik.bodovi} bodova). ` +
    `U paket je ušlo ${r.chunkova} chunkova sa citatom i hashom, ${r.izbaceno} izvora izbačeno sa razlogom.`;
}

/** Izračunaj izvor + napiši izvještaj (MD + JSON + sha256). */
export function napisiIzvestaj(paket, dir) {
  const r = saberi(paket);
  fs.mkdirSync(dir, { recursive: true });
  const datum = paket.at.slice(0, 10);
  const md = [
    `# Context Forge — izvještaj o znanju (${datum})`, '',
    recenica(r), '',
    '| Mjera | Vrijednost |', '|---|---|',
    `| Izvora | ${r.izvora} |`,
    `| Chunkova u paketu (sa citatom + hashom) | ${r.chunkova} |`,
    `| Izbačeno (sa razlogom) | ${r.izbaceno} |`,
    `| Duplikata | ${r.duplikata} (${r.grupaDuplikata} grupa) |`,
    `| Konflikata | ${r.konflikata} |`,
    `| Svježe / starije / isteklo / bez datuma | ${r.fresh} / ${r.stale} / ${r.expired} / ${r.bezDatuma} |`,
    `| Znanje starije od 90 dana | ${r.procenatPreko90}% |`,
    `| Prosječna ocjena svežine | ${r.prosjecanScore} |`,
    `| Bez vlasnika (rizik odgovornosti) | ${r.bezVlasnika} |`,
    `| Hash paketa | \`${r.paketHash}\` |`, '',
    '## Rizik', '',
    ...(r.rizik.clanovi.length ? r.rizik.clanovi.map((c) => `- ${c.naziv}: **${c.broj}**`) : ['- nema rizika u ovom paketu']), '',
    '## Konflikti (čovjek odlučuje)', '',
    ...(paket.konflikti.length ? paket.konflikti.map((k) => `- **${k.key}**: ${k.vrijednosti.map((v) => `${v.value} — \`${v.izvor}\` (${String(v.updatedAt).slice(0, 10)})`).join('  vs  ')}`) : ['- nema konflikata']), '',
    '## Izbačeno iz paketa (i zašto)', '',
    ...(paket.izbaceno.length ? paket.izbaceno.slice(0, 30).map((x) => `- \`${x.id}\` — ${x.razlog}`) : ['- ništa nije izbačeno']), '',
  ].join('\n');
  const json = JSON.stringify({ datum, ...r }, null, 1);
  fs.writeFileSync(path.join(dir, `report-${datum}.md`), md, 'utf8');
  fs.writeFileSync(path.join(dir, `report-${datum}.json`), json, 'utf8');
  fs.writeFileSync(path.join(dir, `report-${datum}.md.sha256`), `${crypto.createHash('sha256').update(md).digest('hex')}  report-${datum}.md\n`, 'utf8');
  return { md: path.join(dir, `report-${datum}.md`), json: path.join(dir, `report-${datum}.json`), sabrano: r };
}

// CLI: node src/report.js --paket packs/pack.json
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const i = process.argv.indexOf('--paket');
  const put = i > -1 ? process.argv[i + 1] : path.join(process.cwd(), 'packs', 'pack.json');
  try {
    const paket = JSON.parse(fs.readFileSync(put, 'utf8'));
    const r = napisiIzvestaj(paket, path.dirname(put));
    console.log(recenica(r.sabrano));
    console.log(`\n[report] ${r.md}`);
  } catch (e) { console.error(`[context-forge] nema paketa (${put}): ${e.message}`); process.exit(1); }
}
