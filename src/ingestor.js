// ingestor.js — usisa znanje iz foldera: tekst, hash izvora, vlasnik, datum, tip.
//
// PRAVILA:
//   · svaki izvor dobija sha256 SADRŽAJA — to je dokaz porekla (auditor traži tačno ovo)
//   · append-only: izvor koji se nije promenio (isti hash) se NE upisuje ponovo (idempotencija)
//   · ništa se ne izmišlja: ako fajl nema datum, uzima se mtime fajla i to piše u polju `dateSource`
import fs from 'node:fs';
import path from 'node:path';
import { citajJsonl, appendJsonl, hashTeksta } from './store.js';

const TIPOVI = { '.md': 'docs', '.txt': 'docs', '.json': 'api', '.csv': 'docs', '.yml': 'policy', '.yaml': 'policy' };

/** Pročitaj sve izvore iz foldera (rekurzivno). */
export function usisajFolder(koren, { maxBytes = 2 * 1024 * 1024 } = {}) {
  const izvori = [];
  const hodi = (d) => {
    let st = [];
    try { st = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of st) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (['node_modules', '.git', 'data', 'packs'].includes(e.name)) continue;
        hodi(p); continue;
      }
      const ext = path.extname(e.name).toLowerCase();
      if (!TIPOVI[ext]) continue;
      let st1 = null; try { st1 = fs.statSync(p); } catch { continue; }
      if (st1.size > maxBytes) continue;
      let tekst = ''; try { tekst = fs.readFileSync(p, 'utf8'); } catch { continue; }
      izvori.push(okvir({ id: path.relative(koren, p).replace(/\\/g, '/'), put: p, tip: TIPOVI[ext], tekst,
        updatedAt: st1.mtime.toISOString(), dateSource: 'file-mtime', owner: null }));
    }
  };
  hodi(koren);
  return izvori.sort((a, b) => a.id.localeCompare(b.id));
}

/** Normalizuj tekst pre hashiranja (isti sadržaj sa različitim razmacima = isti izvor). */
export function normalizuj(tekst) {
  // Spajamo i UNUTRASNJE visestruke razmake: dokument sa duplim razmakom je ISTI dokument (isti hash).
  return String(tekst || '').replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Datum iz zaglavlja teksta (`datum: 2024-11-02`), inače mtime fajla. Nikad se ne izmišlja. */
export function procitajDatum(tekst, fallbackIso) {
  const m = String(tekst || '').match(/datum\s*:\s*(\d{4}-\d{2}-\d{2})/i);
  if (m) return { updatedAt: new Date(m[1] + 'T00:00:00Z').toISOString(), dateSource: 'text' };
  return { updatedAt: fallbackIso || null, dateSource: fallbackIso ? 'file-mtime' : 'provided' };
}

/** Vlasnik iz zaglavlja teksta (`vlasnik: finansije`). Ako ga nema — polje ostaje prazno (i to je nalaz). */
export function procitajVlasnika(tekst) {
  const m = String(tekst || '').match(/vlasnik\s*:\s*([^\n\r]+)/i);
  return m ? m[1].trim() : null;
}

/** Zaokruži sirov izvor u zapis sa hashom, veličinom i brojem reči. */
export function okvir(izvor) {
  const norm = normalizuj(izvor.tekst);
  const d = procitajDatum(norm, izvor.updatedAt || null);
  return {
    id: izvor.id,
    put: izvor.put || null,
    tip: izvor.tip || 'docs',
    owner: izvor.owner || procitajVlasnika(norm),
    // Datum iz TEKSTA ima prednost nad mtime-om: dokument sam tvrdi kad je — a to je i deo dokaza.
    updatedAt: d.dateSource === 'text' ? d.updatedAt : (izvor.updatedAt || d.updatedAt),
    dateSource: d.dateSource === 'text' ? 'text' : (izvor.dateSource && izvor.dateSource !== 'provided' ? izvor.dateSource : d.dateSource),
    hash: hashTeksta(norm),
    bytes: Buffer.byteLength(norm, 'utf8'),
    words: norm.split(/\s+/).filter(Boolean).length,
    tekst: norm,
    facts: Array.isArray(izvor.facts) ? izvor.facts : [],
  };
}

/**
 * Append-only ingest: upisuje samo izvore čiji se hash promenio.
 * @returns {{novi:number, nepromijenjeni:number}}
 */
export function usisajUFalsifikat(izvori, { put }) {
  const stari = citajJsonl(put);
  const zadnji = new Map();
  for (const z of stari) if (z.dogadjaj === 'source') zadnji.set(z.id, z.hash);
  let novi = 0, nepromijenjeni = 0;
  for (const s of izvori) {
    if (zadnji.get(s.id) === s.hash) { nepromijenjeni++; continue; }
    appendJsonl(put, { dogadjaj: 'source', at: new Date().toISOString(), id: s.id, tip: s.tip, owner: s.owner,
      updatedAt: s.updatedAt, dateSource: s.dateSource, hash: s.hash, bytes: s.bytes, words: s.words });
    novi++;
  }
  return { novi, nepromijenjeni };
}

/** Izvor iz liste (demo/fixture) — isti oblik kao iz foldera. */
export function usisajListu(lista = []) { return lista.map(okvir).sort((a, b) => a.id.localeCompare(b.id)); }
