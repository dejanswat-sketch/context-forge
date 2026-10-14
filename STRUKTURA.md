# STRUKTURA — Context Forge (izmjereno 14.10.2026)

> Za provjeru: „da li je bez zavisnosti i može li firma za 5 minuta". Svaki red je izmjeren.

## 1. Fajlovi (18 fajlova · 1237 linija)

```
  .gitignore                                      0 KB /    5 lin
  examples\pack.js                              2.3 KB /   45 lin
  examples\synthetic-corpus.js                  5.2 KB /   97 lin
  LICENSE                                       1.1 KB /   21 lin
  package.json                                    1 KB /   24 lin
  policy.json                                   1.1 KB /   39 lin
  README.md                                     6.3 KB /  146 lin
  src\deduper.js                                3.6 KB /   85 lin
  src\freshness.js                                3 KB /   61 lin
  src\ingestor.js                               3.5 KB /   81 lin
  src\packer.js                                 6.4 KB /  134 lin
  src\report.js                                 4.8 KB /   96 lin
  src\store.js                                  1.5 KB /   36 lin
  test\deduper.test.js                            3 KB /   75 lin
  test\freshness.test.js                        2.8 KB /   59 lin
  test\ingestor.test.js                         2.6 KB /   64 lin
  test\packer.test.js                           4.9 KB /  101 lin
  test\report.test.js                           3.2 KB /   68 lin
```

## 2. Zavisnosti

| Provjera | Rezultat |
|---|---|
| Svaki `import` u paketu | samo `node:*` (ugrađeno) i sopstveni fajlovi |
| Import van `node:*` i `./` | **nijedan** ✅ |
| `dependencies` / `devDependencies` u package.json | **polja ne postoje** ✅ |
| `node_modules` / `package-lock.json` | **ne postoje** ✅ |
| Mreža (fetch/http klijent) | **nijedan poziv ka internetu** ✅ |

Importi po modulu:

| Modul | Putа |
|---|---|
| `node:path` | 9 |
| `node:fs` | 8 |
| `../src/ingestor.js` | 5 |
| `node:test` | 5 |
| `node:assert/strict` | 5 |
| `./freshness.js` | 3 |
| `../src/packer.js` | 3 |
| `./store.js` | 3 |
| `node:os` | 3 |
| `node:crypto` | 3 |
| `../src/deduper.js` | 2 |
| `../src/freshness.js` | 2 |
| `../src/report.js` | 2 |
| `./deduper.js` | 2 |
| `../examples/synthetic-corpus.js` | 1 |
| `../src/store.js` | 1 |
| `./synthetic-corpus.js` | 1 |
| `node:url` | 1 |

## 3. Pet minuta (svježa kopija, bez `npm install`)

| Korak | Rezultat |
|---|---|
| `npm test` | **33/33 · ~1 s** |
| `node examples/pack.js` | 312 izvora → 47 duplikata → 12 konflikata → 178 chunkova → izvještaj |
| Potrebno | samo **Node ≥ 20** |

## 4. Šta NIJE u paketu

Konektori (Drive/Notion/tiketi) — ingest je lokalni folder · ekstrakcija konflikata iz slobodnog teksta ·
embeddings/vektor baza (paket je podatak, indekser je vaš izbor) · multi-tenant · cloud.

## 5. Provjeri sam (60 s)

```powershell
cd E:\NMQ-PROGRAMI\context-forge
node -e "const p=require('./package.json'); console.log(p.dependencies===undefined?'nema zavisnosti':p.dependencies)"
Test-Path node_modules      # False
npm test                    # 33/33
node examples/pack.js       # cijeli tok
```