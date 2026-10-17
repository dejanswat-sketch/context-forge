# STRUKTURA — Context Forge v1.0.0 (izmereno 14.10.2026)

> Provera: „da li je bez zavisnosti i može li firma za 5 minuta". Svaki red je izmeren.

## 1. Fajlovi (31 · 1903 linija · 91.4 KB)

```
  .gitignore                                    0 KB /    5 lin
  data\knowledge\anonimni.md                    0 KB /    1 lin
  data\knowledge\cenovnik_2023.md             0.1 KB /    3 lin
  data\knowledge\kupci_pii.md                 0.2 KB /    3 lin
  data\knowledge\policy_2024.md               0.1 KB /    3 lin
  data\knowledge\policy_2026.md               0.2 KB /    4 lin
  examples\pack.js                            4.7 KB /   74 lin
  examples\synthetic-corpus.js                5.2 KB /   97 lin
  LICENSE                                     1.1 KB /   21 lin
  package.json                                  1 KB /   25 lin
  policy.json                                 1.2 KB /   41 lin
  README.md                                   8.2 KB /  168 lin
  scenarios\knowledge.json                    3.7 KB /   73 lin
  src\deduper.js                              3.6 KB /   85 lin
  src\freshness.js                              3 KB /   61 lin
  src\index.js                                3.9 KB /   83 lin
  src\ingestor.js                             4.4 KB /   96 lin
  src\packer.js                               9.1 KB /  168 lin
  src\report.js                               4.9 KB /   97 lin
  src\scenarios.js                            5.2 KB /   89 lin
  src\sensitive.js                            2.6 KB /   52 lin
  src\store.js                                1.5 KB /   36 lin
  STRUKTURA.md                                  3 KB /   82 lin
  test\deduper.test.js                          3 KB /   75 lin
  test\freshness.test.js                      2.8 KB /   59 lin
  test\index.test.js                          3.5 KB /   79 lin
  test\ingestor.test.js                       2.6 KB /   64 lin
  test\packer.test.js                         4.9 KB /  101 lin
  test\report.test.js                         3.2 KB /   68 lin
  test\scenarios.test.js                      1.7 KB /   35 lin
  test\sensitive.test.js                      2.8 KB /   55 lin
```

## 2. Zavisnosti

| Provera | Rezultat |
|---|---|
| Importi | samo `node:*` i sopstveni fajlovi |
| van `node:*` i `./` | **nijedan** ✅ |
| `dependencies` / `devDependencies` | **polja ne postoje** ✅ |
| `node_modules` / lock | **ne postoje** ✅ |
| poziv ka internetu | **nijedan** ✅ |

| Modul | Putа |
|---|---|
| `node:path` | 12 |
| `node:fs` | 10 |
| `node:assert/strict` | 8 |
| `node:test` | 8 |
| `../src/ingestor.js` | 7 |
| `../src/packer.js` | 6 |
| `node:crypto` | 4 |
| `./freshness.js` | 3 |
| `node:os` | 3 |
| `./store.js` | 3 |
| `node:url` | 3 |
| `./deduper.js` | 3 |
| `./ingestor.js` | 2 |
| `./packer.js` | 2 |
| `./sensitive.js` | 2 |
| `../src/scenarios.js` | 2 |
| `../src/report.js` | 2 |
| `../src/index.js` | 2 |
| `../src/freshness.js` | 2 |
| `../src/deduper.js` | 2 |
| `../src/store.js` | 1 |
| `../src/sensitive.js` | 1 |
| `./synthetic-corpus.js` | 1 |
| `../examples/synthetic-corpus.js` | 1 |

## 3. Pet minuta (sveža kopija, bez `npm install`)

| Korak | Rezultat |
|---|---|
| `npm test` | **50/50 · ~1 s** |
| `node src/scenarios.js` | **7/7** (taksonomija znanja) |
| `node examples/pack.js` | folder 5 → 2 chunka · korpus 312 → 47 → 12 → 23,1% → 178 chunkova · pitanje rangirano · **0,15 s** |

## 4. Taksonomija scenarija (podaci, ne kod)

`duplikat` · `konflikt` · `zastarelo` · `bez-vlasnika` · `bez-izvora` · `osetljivo` · `sveze`
→ `scenarios/knowledge.json`; runner `src/scenarios.js` piše `reports/knowledge-scenarios-<dan>.md` (+ .json, + sha256).

## 5. Šta NIJE u paketu

Konektori (Drive/Notion/tiketi) · ekstrakcija konflikata iz slobodnog teksta · embeddings/vektor baza · multi-tenant · cloud.

## 6. Proveri sam (60 s)

```powershell
cd E:\NMQ-PROGRAMI\products\context-forge
node -e "const p=require('./package.json'); console.log(p.dependencies===undefined?'nema zavisnosti':p.dependencies)"
Test-Path node_modules      # False
npm test                    # 50/50
node src/scenarios.js       # 7/7
node examples/pack.js       # celi tok, 0,15 s
```