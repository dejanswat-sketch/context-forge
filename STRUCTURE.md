# STRUCTURE — Context Forge v1.0.0 (measured 14 Oct 2026)

> The question this file answers: **"is it really dependency-free, and can a company start in five minutes?"**
> Every row below is measured, not estimated.

## 1. Files (32 · 1,822 lines of source · 124 KB)

```
  .gitignore                                     0 KB /    5 lines
  DEMO.md                                        3 KB /   62 lines
  LICENSE                                      1.1 KB /   17 lines
  README.md                                    9.3 KB /  139 lines
  STRUCTURE.md                                 4.1 KB /   90 lines
  demo.gif                                      57 KB /   (binary)
  demo.svg                                     3.9 KB /   51 lines
  examples/pack.js                             4.7 KB /   67 lines
  examples/synthetic-corpus.js                 5.2 KB /   90 lines
  package.json                                   1 KB /   25 lines
  policy.json                                  1.2 KB /   41 lines
  reports/knowledge-scenarios-2026-10-14.json  1.4 KB /   71 lines
  reports/knowledge-scenarios-2026-10-14.md    0.7 KB /   12 lines
  reports/knowledge-scenarios-2026-10-14.md.sha256  0.1 KB /  1 line
  scenarios/knowledge.json                     3.7 KB /   73 lines
  src/deduper.js                               3.6 KB /   79 lines
  src/freshness.js                               3 KB /   55 lines
  src/index.js                                 3.9 KB /   78 lines
  src/ingestor.js                              4.4 KB /   88 lines
  src/packer.js                                9.1 KB /  155 lines
  src/report.js                                4.9 KB /   92 lines
  src/scenarios.js                             5.2 KB /   84 lines
  src/sensitive.js                             2.6 KB /   47 lines
  src/store.js                                 1.5 KB /   31 lines
  test/deduper.test.js                           3 KB /   67 lines
  test/freshness.test.js                       2.8 KB /   52 lines
  test/index.test.js                           3.5 KB /   71 lines
  test/ingestor.test.js                        2.6 KB /   57 lines
  test/packer.test.js                          4.9 KB /   90 lines
  test/report.test.js                          3.2 KB /   61 lines
  test/scenarios.test.js                       1.7 KB /   31 lines
  test/sensitive.test.js                       2.8 KB /   48 lines
```

## 2. Dependencies

| Check | Result |
|---|---|
| Imports | only `node:*` and own files |
| Outside `node:*` and `./` | **none** ✅ |
| `dependencies` / `devDependencies` | **fields do not exist** ✅ |
| `node_modules` / lockfile | **do not exist** ✅ |
| Outbound network calls | **none** ✅ |

**Every import in the repository, counted:**

| Module | Occurrences |
|---|---|
| `node:path` | 12 |
| `node:fs` | 10 |
| `node:assert/strict` | 8 |
| `node:test` | 8 |
| `src/ingestor.js` | 7 |
| `src/packer.js` | 6 |
| `node:crypto` | 4 |
| `node:os` | 3 |
| `node:url` | 3 |
| `freshness.js` | 3 |
| `store.js` | 3 |
| `deduper.js` | 3 |
| `ingestor.js` | 2 |
| `packer.js` | 2 |
| `sensitive.js` | 2 |
| `scenarios.js` | 2 |
| `report.js` | 2 |
| `index.js` | 2 |
| `synthetic-corpus.js` | 1 |

## 3. Five minutes (fresh clone, no `npm install`)

| Step | Result |
|---|---|
| `npm test` | **50/50 · about 1 s** |
| `node src/scenarios.js` | **7/7** (knowledge taxonomy) |
| `node examples/pack.js` | folder 5 → 2 chunks · corpus 312 → 47 → 12 → 23.1% → 178 chunks · question ranked · **0.15 s** |

## 4. Scenario taxonomy (data, not code)

`duplicate` · `conflict` · `outdated` · `no-owner` · `no-source` · `sensitive` · `fresh`

→ stored in `scenarios/knowledge.json`; the runner `src/scenarios.js` writes
`reports/knowledge-scenarios-<day>.md` (plus `.json` and a `.sha256` signature).

## 5. What is NOT in the package

Connectors (Drive / Notion / ticketing) · extracting contradictions from free text · embeddings or a vector store · multi-tenancy · cloud.

## 6. Check it yourself (60 s)

```bash
git clone https://github.com/dejanswat-sketch/context-forge.git
cd context-forge
node -e "const p=require('./package.json'); console.log(p.dependencies===undefined?'no dependencies':'has them')"
ls node_modules 2>/dev/null || echo "node_modules: absent"
npm test              # 50/50
node src/scenarios.js # 7/7
node examples/pack.js # full flow, 0.15 s
```

Windows equivalent of the `ls` line:

```powershell
Test-Path node_modules      # False
```
