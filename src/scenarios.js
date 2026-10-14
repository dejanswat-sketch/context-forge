// scenarios.js — runner za 7 scenarija iz `scenarios/knowledge.json` (podaci, ne kod).
//
// ZAŠTO: scenariji dokazuju da mašina radi na SVIM taksonomskim slučajevima, a ne samo na srećnom putu.
// Svaki scenario ima očekivanje; ako ijedno padne — runner vraća kod 1 i to se vidi u krugu.
//
// Upotreba: node src/scenarios.js [--tiho]
// Izlaz: reports/knowledge-<dan>.md (+ .json, + sha256) — isti izvještaj kao za pravi paket.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { usisajListu } from './ingestor.js';
import { napraviPaket } from './packer.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SADA = Date.parse('2026-10-14T12:00:00Z');

/** ČISTA FUNKCIJA — provjeri očekivanja jednog scenarija protiv napravljenog paketa. */
export function provjeriScenario(scenario, paket) {
  const o = scenario.ocekivano || {};
  const s = paket.sazetak;
  const greske = [];
  const ima = (ime) => Object.prototype.hasOwnProperty.call(o, ime);

  if (ima('duplikata') && s.duplikata !== o.duplikata) greske.push(`duplikata ${s.duplikata} ≠ ${o.duplikata}`);
  if (ima('grupaDuplikata') && s.grupaDuplikata !== o.grupaDuplikata) greske.push(`grupa ${s.grupaDuplikata} ≠ ${o.grupaDuplikata}`);
  if (ima('konflikata') && s.konflikata !== o.konflikata) greske.push(`konflikata ${s.konflikata} ≠ ${o.konflikata}`);
  if (ima('chunkova') && s.chunkova !== o.chunkova) greske.push(`chunkova ${s.chunkova} ≠ ${o.chunkova}`);
  if (ima('bezVlasnika') && s.svezina.bezVlasnika !== o.bezVlasnika) greske.push(`bezVlasnika ${s.svezina.bezVlasnika} ≠ ${o.bezVlasnika}`);
  if (ima('konfliktniKljuc') && !paket.konflikti.some((k) => k.key === o.konfliktniKljuc)) greske.push(`nema konflikta "${o.konfliktniKljuc}"`);
  if (ima('izbacenoRazlog')) {
    const tekst = JSON.stringify(paket.izbaceno);
    if (!new RegExp(o.izbacenoRazlog, 'i').test(tekst)) greske.push(`nema razloga "${o.izbacenoRazlog}" u izbačenim`);
  }
  if (ima('oznaka')) {
    const imaOznaku = paket.chunkovi.some((c) => c.flag === o.oznaka) || (o.oznaka === 'osetljivo' && paket.osetljivi.length > 0);
    if (!imaOznaku) greske.push(`nema oznake "${o.oznaka}"`);
  }
  if (ima('piiVrste')) {
    const nadjene = new Set(paket.osetljivi.flatMap((x) => x.vrste));
    for (const v of o.piiVrste) if (!nadjene.has(v)) greske.push(`PII "${v}" nije nađen`);
  }
  if (ima('minScore')) {
    const naj = Math.max(0, ...paket.chunkovi.map((c) => c.svezina.score));
    if (naj < o.minScore) greske.push(`score ${naj} < ${o.minScore}`);
  }
  if (o.imaCitat) { const c = paket.chunkovi[0]; if (!c?.citat?.izvor || !c?.citat?.sha256) greske.push('chunk bez citata'); }
  if (o.imaHash) { const c = paket.chunkovi[0]; if (!c?.dokaz || !/^sha256:[0-9a-f]{16}\|izvor:/.test(c.dokaz)) greske.push('chunk bez dokaz linije'); }
  return { id: scenario.id, naziv: scenario.naziv, taksonomija: scenario.taksonomija, prosao: greske.length === 0, greske, chunkova: s.chunkova };
}

/** Pusti sve scenarije. */
export function pusti(file = path.join(ROOT, 'scenarios', 'knowledge.json')) {
  const paketScenarija = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rezultati = paketScenarija.scenariji.map((sc) => {
    const izvori = usisajListu(sc.ulaz || []);
    const paket = napraviPaket(izvori, { sada: SADA });
    return provjeriScenario(sc, paket);
  });
  return {
    taksonomija: paketScenarija.taksonomija,
    proslo: rezultati.filter((r) => r.prosao).length,
    ukupno: rezultati.length,
    rezultati,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const tiho = process.argv.includes('--tiho');
  const out = pusti();
  if (!tiho) for (const r of out.rezultati) {
    console.log(`  ${r.prosao ? 'PASS' : 'FAIL'} ${r.id.padEnd(16)} [${r.taksonomija}]${r.greske.length ? ' — ' + r.greske.join('; ') : ''}`);
  }
  const tekst = [
    `# Context Forge — knowledge scenarios (${new Date().toISOString().slice(0, 10)})`, '',
    `**${out.proslo}/${out.ukupno} passed**${out.proslo === out.ukupno ? ' ✅' : ' ❌'} · taxonomy: ${out.taksonomija.join(', ')}`, '',
    '| Scenario | Taxonomy | Result | Chunks | Evidence |', '|---|---|---|---|---|',
    ...out.rezultati.map((r) => `| ${r.id} | ${r.taksonomija} | ${r.prosao ? '**PASS**' : '**FAIL**'} | ${r.chunkova} | ${r.greske.join('; ') || 'ok'} |`), '',
    '> Scenarios are generated from the taxonomy, so a missing case is visible as a missing row.', '',
  ].join('\n');
  const dir = path.join(ROOT, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const dan = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(dir, `knowledge-scenarios-${dan}.md`), tekst, 'utf8');
  fs.writeFileSync(path.join(dir, `knowledge-scenarios-${dan}.json`), JSON.stringify(out, null, 1), 'utf8');
  fs.writeFileSync(path.join(dir, `knowledge-scenarios-${dan}.md.sha256`), crypto.createHash('sha256').update(tekst).digest('hex') + `  knowledge-scenarios-${dan}.md\n`, 'utf8');
  if (!tiho) console.log(`\n[scenarios] ${out.proslo}/${out.ukupno} ${out.proslo === out.ukupno ? '✅' : '❌'} · reports/knowledge-scenarios-${dan}.md`);
  process.exit(out.proslo === out.ukupno ? 0 : 1);
}
