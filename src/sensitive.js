// sensitive.js — PII i tajne u znanju. Ako izvor nosi lične podatke, NE ide u paket za agenta.
//
// ZAŠTO: fintech/insurance ne smeju da daju agentu JMBG, broj kartice ili IBAN. Provera je DETERMINISTIČKA
// (bez modela) — auditor može da je ponovi, a nalaz se NIKAD ne ispisuje u čistom obliku (rediguje se).
const UZORCI = [
  { vrsta: 'email', re: /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, rediguj: (m) => m.replace(/^(.{2})[^@]*(@.*)$/, '$1***$2') },
  { vrsta: 'iban', re: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,26}\b/g, rediguj: (m) => m.slice(0, 4) + '***' },
  { vrsta: 'jmbg', re: /\b\d{13}\b/g, rediguj: (m) => m.slice(0, 4) + '*********' },
  { vrsta: 'kartica', re: /\b(?:\d[ -]?){13,16}\b/g, rediguj: (m) => m.slice(0, 4) + ' **** **** ' + m.slice(-4) },
  { vrsta: 'telefon', re: /(?:\+?\d{2,3}[\s/-]?)?(?:0?6\d)[\s/-]?\d{3}[\s/-]?\d{3,4}\b/g, rediguj: (m) => m.slice(0, 3) + '***' + m.slice(-2) },
  { vrsta: 'tajna', re: /\b(?:sk|pk|gho|ghp|xox[baprs])[-_][A-Za-z0-9_-]{16,}\b/g, rediguj: () => '***' },
  { vrsta: 'lozinka', re: /\b(?:password|lozinka|passwd)\s*[:=]\s*\S+/gi, rediguj: () => 'lozinka: ***' },
];
const POLJA = [[/jmbg/i, 'jmbg'], [/kartic[ae]/i, 'kartica'], [/iban/i, 'iban'], [/pasos|passport/i, 'pasos'], [/adresa stanovanja/i, 'adresa']];

/** Nađi PII/tajne u tekstu. Vraća listu nalaza sa REDIGOVANIM primerom (nikad čist podatak). */
export function detektuj(tekst) {
  const t = String(tekst || '');
  const nalazi = [];
  for (const u of UZORCI) {
    u.re.lastIndex = 0;
    let m;
    while ((m = u.re.exec(t)) !== null) {
      nalazi.push({ vrsta: u.vrsta, primer: u.rediguj(m[0]) });
      if (nalazi.length > 50) break;
    }
  }
  for (const [re, vrsta] of POLJA) if (re.test(t) && !nalazi.some((n) => n.vrsta === vrsta)) nalazi.push({ vrsta, primer: '***' });
  return nalazi;
}

export const imaPII = (tekst) => detektuj(tekst).length > 0;
export const vrstePII = (tekst) => [...new Set(detektuj(tekst).map((n) => n.vrsta))];

/** Rediguj PII u tekstu (za prikaz/izveštaj — original se ne dira). */
export function rediguj(tekst) {
  let t = String(tekst || '');
  for (const u of UZORCI) { u.re.lastIndex = 0; t = t.replace(u.re, (m) => u.rediguj(m)); }
  return t;
}

/** Oznaci izvore koji nose PII: {flag:'osetljivo', pii:[...], tekstRedigovan}. Vraća novu listu. */
export function oznaciOsetljive(izvori = []) {
  return izvori.map((s) => {
    const nalazi = detektuj(s.tekst || '');
    if (!nalazi.length) return s;
    return { ...s, flag: 'osetljivo', pii: nalazi, tekstRedigovan: rediguj(s.tekst), tekst: rediguj(s.tekst) };
  });
}

// starija imena (kompatibilnost sa ranijim pozivima)
export const nadjiPII = detektuj;
