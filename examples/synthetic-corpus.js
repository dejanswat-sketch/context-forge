// synthetic-corpus.js — deterministički korpus: 312 izvora, 47 duplikata, 12 konflikata, 23% starije od 90 dana.
//
// ZAŠTO generator u paketu: demo mora da bude PONOVLJIV (isti brojevi na svakoj mašini, bez mreže, bez tuđih podataka).
// Brojevi su CILJANI i provjeravaju se (test/ korpus test), a ne "otprilike" — inače demo laže.
//
// Kako se postiže tačnost:
//   · 265 jedinstvenih + 47 kopija (kopija je IDENTIČAN tekst → isti sha256) = 312
//   · cijena po proizvodu je deterministička → nema SLUČAJNIH konflikata; 12 konflikata se ubacuje namjerno
//   · tačno 23% izvora dobija datum stariji od 90 dana (ne "dok ne napunimo")
//   · tipovi su realni (docs 180 dana TTL, price 30) → istekne samo ono što stvarno treba
function prng(seme) {
  let a = seme >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const DAN = 86400000;
const SADA = Date.UTC(2026, 9, 14, 12, 0, 0);
const PROIZVODI = ['Starter', 'Pro', 'Enterprise', 'Add-on Analytics', 'Support Plus'];
const VLASNICI = ['prodaja@firma', 'podrska@firma', 'finansije@firma', null, 'it@firma'];
// tip → koliko ih ima (ukupno 100); TTL dolazi iz policy.json
const SMJESA = [['docs', 70], ['policy', 12], ['api', 8], ['price', 6], ['ticket', 4]];
const CIJENA_PO_PROIZVODU = { Starter: 29, Pro: 79, 'Add-on Analytics': 49, 'Support Plus': 39, Enterprise: 199 };

export function napraviKorpus({ ukupno = 312, duplikata = 47, konflikata = 12, procenatPreko90 = 23, seme = 20261014 } = {}) {
  const rnd = prng(seme);
  const distinct = ukupno - duplikata;
  const izvori = [];

  // 1) tipovi po smjesi (tačan broj po tipu)
  const tipovi = [];
  for (const [tip, dio] of SMJESA) for (let i = 0; i < Math.round((dio / 100) * distinct); i++) tipovi.push(tip);
  while (tipovi.length < distinct) tipovi.push('docs');
  tipovi.length = distinct;

  // 2) jedinstveni izvori
  for (let i = 0; i < distinct; i++) {
    const tip = tipovi[i];
    const proizvod = PROIZVODI[i % PROIZVODI.length];
    const cijena = CIJENA_PO_PROIZVODU[proizvod];                 // deterministički → nema slučajnih konflikata
    const id = `${tip}/${proizvod.toLowerCase().replace(/\s+/g, '-')}-${String(i + 1).padStart(3, '0')}.md`;
    izvori.push({
      id, tip,
      owner: VLASNICI[Math.floor(rnd() * VLASNICI.length)],
      updatedAt: new Date(SADA).toISOString(),
      dateSource: 'provided',
      facts: [{ key: `cijena:${proizvod.toLowerCase()}`, value: String(cijena) }],
      tekst: [
        `# ${proizvod} — ${tip} (ref ${String(i + 1).padStart(3, '0')})`, '',
        `Dokument ${String(i + 1).padStart(3, '0')} opisuje ponudu "${proizvod}" (tip: ${tip}).`,
        `Cijena za ${proizvod} iznosi ${cijena} EUR mjesečno za standardni paket.`,
        `Uslovi: bez skrivenih troškova; otkazivanje 30 dana prije isteka.`,
        `Kontakt: ${VLASNICI[Math.floor(rnd() * VLASNICI.length)] || 'prodaja@firma'}.`,
      ].join('\n'),
    });
  }

  // 3) datumi: tačno `procenatPreko90` izvora starije od 90 dana (95..400), ostali 0..60
  const ciljStarih = Math.round((procenatPreko90 / 100) * ukupno);
  const indeksi = [...Array(distinct).keys()];
  for (let i = indeksi.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [indeksi[i], indeksi[j]] = [indeksi[j], indeksi[i]]; }
  const stariSet = new Set(indeksi.slice(0, ciljStarih));
  for (const i of indeksi) {
    const dana = stariSet.has(i) ? 95 + Math.floor(rnd() * 305) : Math.floor(rnd() * 61);
    izvori[i].updatedAt = new Date(SADA - dana * DAN).toISOString();
  }

  // 4) konflikti: 12 namjernih (2 izvora, ista ključ, različita vrijednost) — biraju se iz SVIJEŽIH (da bi inače ušli u paket)
  const svjezi = izvori.map((s, i) => ({ s, i })).filter(({ i }) => !stariSet.has(i));
  const konfliktniKljucevi = [];
  for (let k = 0; k < konflikata; k++) {
    const a = svjezi[(k * 2) % svjezi.length].s;
    const b = svjezi[(k * 2 + 1) % svjezi.length].s;
    const kljuc = `cijena:${PROIZVODI[k % PROIZVODI.length].toLowerCase()}-konflikt-${k + 1}`;
    const v1 = String(100 + k * 10), v2 = String(100 + k * 10 + 25);
    a.facts = [...a.facts, { key: kljuc, value: v1 }];
    b.facts = [...b.facts, { key: kljuc, value: v2 }];
    a.tekst += `\n\nNapomena ${k + 1}: posebna cijena je ${v1} EUR.`;
    b.tekst += `\n\nNapomena ${k + 1}: posebna cijena je ${v2} EUR.`;
    konfliktniKljucevi.push(kljuc);
  }

  // 5) duplikati: kopija IDENTIČNOG teksta (isti sha256) — 47 različitih originala, po jednom
  const originalZaKopiju = indeksi.slice(ciljStarih, ciljStarih + duplikata).map((i) => izvori[i]);
  for (let i = 0; i < originalZaKopiju.length; i++) {
    const o = originalZaKopiju[i];
    izvori.push({ ...o, id: `kopija/${String(i + 1).padStart(2, '0')}-${o.id}`, owner: VLASNICI[Math.floor(rnd() * VLASNICI.length)] });
  }

  const brojStarihPreko90 = izvori.filter((s) => (SADA - Date.parse(s.updatedAt)) / DAN > 90).length;
  return {
    izvori,
    meta: {
      ukupno: izvori.length, distinct, duplikata, konflikata: konfliktniKljucevi.length,
      konfliktniKljucevi, starihPreko90: brojStarihPreko90,
      procenatPreko90: +((brojStarihPreko90 / izvori.length) * 100).toFixed(1), seme,
    },
  };
}
