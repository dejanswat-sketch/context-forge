// examples/pack.js — cijeli tok u jednom potezu (<1 s, bez mreže, bez zavisnosti):
//   korpus 312 izvora → dedup (47) → konflikti (12) → svežina (~23% >90 dana) → RAG paket sa citatima → izvještaj
//
//   node examples/pack.js
import path from 'node:path';
import { usisajListu } from '../src/ingestor.js';
import { sazetak as sazetakDuplikata } from '../src/deduper.js';
import { ocijeniSve } from '../src/freshness.js';
import { napraviPaket, upisiPaket } from '../src/packer.js';
import { napisiIzvestaj, saberi, recenica } from '../src/report.js';
import { napraviKorpus } from './synthetic-corpus.js';

const OUT = path.join(process.cwd(), 'packs');
const SADA = Date.parse('2026-10-14T12:00:00Z');            // fiksno „sada" → isti brojevi svaki put

console.log('Context Forge — knowledge pack example\n');

// 1) INGEST
const { izvori: sirovi, meta } = napraviKorpus();
const izvori = usisajListu(sirovi);
console.log(`1. ingest      ${izvori.length} izvora (${meta.distinct} jedinstvenih + ${meta.duplikata} kopija)`);

// 2) DEDUP + KONFLIKTI
const d = sazetakDuplikata(izvori, { prag: 0.85 });
console.log(`2. dedup       ${d.duplikata} duplikata u ${d.grupaDuplikata} grupa · ušteda ${Math.round(d.ustedaBajtova / 1024)} KB`);
console.log(`3. konflikti   ${d.konflikata} konflikata (ide čovjeku, ne agentu)`);

// 3) SVEŽINA
const f = ocijeniSve(izvori, { sada: SADA });
console.log(`4. svežina     fresh ${f.sazetak.fresh} · stale ${f.sazetak.stale} · isteklo ${f.sazetak.expired} · bez datuma ${f.sazetak.unknown} · >90 dana ${f.sazetak.procenatPreko90}%`);

// 4) PAKET
const paket = napraviPaket(izvori, { sada: SADA });
const putanje = upisiPaket(paket, OUT);
console.log(`5. paket       ${paket.sazetak.chunkova} chunkova sa citatom+hashom · izbačeno ${paket.sazetak.izbaceno}`);

// 5) IZVJEŠTAJ
const izv = napisiIzvestaj(paket, OUT);
const r = saberi(paket);
console.log(`6. izvještaj   rizik: ${r.rizik.nivo} (${r.rizik.bodovi} bodova)`);
console.log(`\n> ${recenica(r)}`);
console.log(`\npack.json  ${path.relative(process.cwd(), putanje.json)}`);
console.log(`pack.md    ${path.relative(process.cwd(), putanje.md)}`);
console.log(`report     ${path.relative(process.cwd(), izv.md)}`);
console.log(`hash paketa ${paket.paketHash.slice(0, 16)}…`);
