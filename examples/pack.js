// examples/pack.js — celi tok u jednom potezu (<1 s, bez mreže, bez zavisnosti).
//
//   node examples/pack.js
//
// Pokazuje ČETIRI stvari koje firma traži:
//   1. FOLDER demo (data/knowledge, 5 fajlova) — isti tok kao u produkciji, bez generisanja
//   2. VELIKI korpus (312 izvora) — brojke iz skice: 312 → 47 → 12 → 23,1% → paket
//   3. PITANJE — isto znanje, drugačiji redosled paketa (rangiranje po relevantnosti)
//   4. FAÇADE — isti engine u 4 linije koda
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usisajFolder, usisajListu } from '../src/ingestor.js';
import { sazetak as sazetakDuplikata } from '../src/deduper.js';
import { ocijeniSve } from '../src/freshness.js';
import { napraviPaket, upisiPaket } from '../src/packer.js';
import { napisiIzvestaj, saberi, recenica } from '../src/report.js';
import { napraviKorpus } from './synthetic-corpus.js';
import { ingestor, deduper, freshness, packer } from '../src/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'packs');
const FOLDER = path.join(ROOT, 'data', 'knowledge');
const SADA = Date.parse('2026-10-14T12:00:00Z');
const linija = (s) => console.log(s);

linija('Context Forge — knowledge pack example\n');

// ── 1) FOLDER DEMO (bez generisanja: pravi fajlovi) ─────────────────────────
linija('1) FOLDER data/knowledge (isti tok kao u produkciji)');
const fajlovi = usisajFolder(FOLDER);
const paketFoldera = napraviPaket(fajlovi, { sada: SADA });
linija(`   izvora ${fajlovi.length} → chunkova ${paketFoldera.sazetak.chunkova} · izbačeno ${paketFoldera.sazetak.izbaceno}`);
for (const c of paketFoldera.chunkovi) {
  linija(`   • ${c.id.padEnd(24)} svežina ${c.svezina.score.toFixed(2)} (${c.svezina.status}) · vlasnik ${c.citat.owner || '—'} · ${c.dokaz}`);
}
for (const x of paketFoldera.izbaceno) linija(`   ✗ ${x.id.padEnd(24)} ${x.razlog}`);
if (paketFoldera.osetljivi.length) linija(`   ! PII (redigovano, nikad u paketu): ${paketFoldera.osetljivi.map((o) => o.id + ' [' + o.vrste.join(',') + ']').join(', ')}`);

// ── 2) VELIKI KORPUS (brojke iz skice) ──────────────────────────────────────
linija('\n2) VELIKI korpus (312 izvora)');
const { izvori: sirovi, meta } = napraviKorpus();
const izvori = usisajListu(sirovi);
const d = sazetakDuplikata(izvori, { prag: 0.85 });
const f = ocijeniSve(izvori, { sada: SADA });
const paket = napraviPaket(izvori, { sada: SADA });
const putanje = upisiPaket(paket, OUT);
const izv = napisiIzvestaj(paket, OUT);
const r = saberi(paket);
linija(`   ingest ${izvori.length} (${meta.distinct} jedinstvenih + ${meta.duplikata} kopija) → dedup ${d.duplikata} → konflikti ${d.konflikata} → >90 dana ${f.sazetak.procenatPreko90}%`);
linija(`   paket: ${paket.sazetak.chunkova} chunkova · izbačeno ${paket.sazetak.izbaceno} · hash ${paket.paketHash.slice(0, 16)}…`);
linija(`   rizik: ${r.rizik.nivo} (${r.rizik.bodovi} bodova)`);

// ── 3) PITANJE (rangiranje) ─────────────────────────────────────────────────
const PITANJE = 'koja je cena refund-a?';
linija(`\n3) PITANJE: „${PITANJE}"`);
const odgovor = packer(freshness(deduper(fajlovi), { ttlDana: 90 }), { pitanje: PITANJE, sada: SADA, maxChunkova: 3 });
for (const [i, c] of odgovor.entries()) {
  linija(`   ${i + 1}. match ${String(c.match).padEnd(5)} svežina ${c.svezina.score.toFixed(2)} · ${c.citat.izvor} · ${String(c.citat.updatedAt).slice(0, 10)}`);
}
linija('   (bez pitanja paket ide po svežini; sa pitanjem po 0.6*svežina + 0.4*poklapanje)');

// ── 4) FAÇADE (copy-paste oblik) ────────────────────────────────────────────
linija('\n4) FAÇADE (isti engine, 4 linije)');
const z = ingestor(FOLDER);
const cisti = deduper(z);
const prov = freshness(cisti, { ttlDana: 90 });
const paketi = packer(prov, { pitanje: 'koja je cena starter paketa?', sada: SADA, maxChunkova: 3 });
linija(`   ${z.length} → ${cisti.length} → konflikata ${prov.konflikti.length} → paketa ${paketi.length}`);
linija(`   prvi: ${JSON.stringify({ text: paketi[0]?.tekst?.slice(0, 34), citat: paketi[0]?.citat?.izvor, datum: String(paketi[0]?.citat?.updatedAt).slice(0, 10), freshness: paketi[0]?.svezina?.score, hash: paketi[0]?.citat?.sha256?.slice(0, 8) })}`);

linija(`\n> ${recenica(r)}`);
linija(`\npack.json   ${path.relative(ROOT, putanje.json)}`);
linija(`pack.md     ${path.relative(ROOT, putanje.md)}`);
linija(`report      ${path.relative(ROOT, izv.md)}`);
