# Context Forge

> **Na srpskom — ukratko**
> **Šta je:** program koji priprema znanje pre nego što ga daš AI alatu (ulazna strana RAG-a).
> **Čemu služi:** AI ne greši najčešće zbog modela, nego zbog onoga što mu daš — 3.000 dokumenata u kojima je 40% duplikata,
> 20% zastarelo i 10% protivrječno, pa agent citira cenu iz 2023. Ovaj program to počisti, obeleži i izmeri.
> **Kako se pokreće:** `node examples/pack.js` (celi tok na uzorku, 0,15 s) · `npm test` (50 provera) · `node src/scenarios.js` (7/7) · `node src/report.js` (izveštaj).
> **Šta dobiješ:** paket znanja (JSON + čitljiv `.md`) u kojem svaki deo nosi **izvor, vlasnika, datum i SHA-256 potpis**,
> plus spisak duplikata, konflikata, zastarelih i osetljivih podataka.
> **Bez čega radi:** bez zavisnosti, bez interneta.
> **U portalu:** `http://127.0.0.1:3150/` → tab **Context Forge** (dugmad: Demo, Scenariji, Izveštaj, Testovi).

**Package knowledge for AI agents — with proof of freshness.**

RAG systems rarely fail because of the model. They fail because of the context: 3,000 documents where 40 % are
duplicates, 20 % are outdated and 10 % contradict each other. The agent then cites a price list from 2023 and the
company loses money.

Context Forge is the **input side** of that problem: it ingests knowledge, removes duplicates, flags conflicts,
measures freshness for every fact, and emits a RAG pack where **every chunk carries a citation, an owner, a date
and a SHA-256 hash of its source**.

> AgentGuard protects the **effect** ("you may not refund 1,500").
> Context Forge protects the **input** ("you may not read the 2023 price list — here is the fresh one, with hash").

No dependencies. No cloud. Runs in under a second.

```
$ node examples/pack.js

1. ingest      312 izvora (265 jedinstvenih + 47 kopija)
2. dedup       47 duplikata u 47 grupa · ušteda 11 KB
3. konflikti   12 konflikata (ide čovjeku, ne agentu)
4. svežina     fresh 223 · stale 26 · isteklo 63 · bez datuma 0 · >90 dana 23.1%
5. paket       178 chunkova sa citatom+hashom · izbačeno 134
6. izveštaj   rizik: kritičan (309 bodova)
```

---

> **See real output first:** [DEMO.md](DEMO.md) — what it prints when it runs, and what each line proves.

## Why teams need it

| Problem | What Context Forge does |
|---|---|
| the same document lives in 4 places | **exact duplicates** by content hash, canonical = newest; near-duplicates by token similarity |
| two docs disagree on a price | **conflicts** (same key, different value) are never auto-resolved — they go to a human queue |
| nobody knows what is outdated | **freshness per type** (price list 30 days, contract 365) with a score an auditor can recompute |
| "where did the AI get this?" | every chunk carries **source, owner, date and sha256** — provenance, not a guess |
| management wants a number | one **report**: sources, duplicates removed, conflicts, % older than 90 days, risk level |

---

## 5-minute integration

```bash
git clone <this repo> && cd context-forge
node examples/pack.js      # the full flow, reproducible numbers, no network
npm test                   # 33 tests, no dependencies, ~1 s
```

```js
import { usisajFolder } from './src/ingestor.js';
import { napraviPaket, upisiPaket } from './src/packer.js';
import { napisiIzvestaj } from './src/report.js';

const izvori = usisajFolder('D:/firma/dokumenti');     // .md .txt .json .csv .yml
const paket  = napraviPaket(izvori);                   // dedupe + conflicts + freshness inline
upisiPaket(paket, './packs');                          // pack.json + pack.md (citations) + .sha256
const r = napisiIzvestaj(paket, './packs');            // report.md + report.json + .sha256
console.log(r.sabrano.rizik);                          // { bodovi, nivo, clanovi }
```

Feed `pack.json` (or `pack.md`) to your RAG indexer. Anything that is not in the pack is listed in `izbaceno`
**with the reason** — never silently dropped.

---

## What the pack contains

```json
{
  "id": "price/starter-001.md#1",
  "tekst": "# Starter — price ...",
  "citat": {
    "izvor": "price/starter-001.md", "tip": "price", "owner": "prodaja@firma",
    "updatedAt": "2026-09-30T00:00:00.000Z", "dateSource": "provided",
    "sha256": "9f2c…", "chunkHash": "41ab…"
  },
  "svezina": { "score": 0.53, "status": "stale", "ageDays": 14, "ttl": 30 }
}
```

| Field | Why it matters |
|---|---|
| `citat.sha256` | the **source** can be re-hashed later: if it changed, the pack is stale and you know it |
| `citat.chunkHash` | the exact chunk is verifiable, not just the document |
| `svezina.status` | `fresh` (< 60 % of TTL) · `stale` (60–100 %) · `expired` (> TTL) |
| `izbaceno[]` | every dropped source with a reason: `isteklo`, `duplikat`, `konflikt`, `nema datuma` |
| `konflikti[]` | the human queue: which key, which values, from which sources |
| `paketHash` | one hash over all chunks — the pack itself is verifiable |

---

## Policy (`policy.json`) — freshness as data, not code

```json
{ "ttlDaysByType": { "price": 30, "api": 60, "docs": 180, "contract": 365 },
  "freshness": { "staleAfterRatio": 0.6 },
  "pack": { "maxChunkChars": 900, "excludeExpired": true, "excludeConflicted": true } }
```

A client changes a price-list TTL from 30 to 14 days by editing one number — no deploy.

---

## Design decisions (the ones that matter)

1. **Unknown freshness is a risk, not a pass.** A source without a date is excluded and reported (`nema datuma`),
   because freshness that cannot be proven does not exist.
2. **Conflicts are never auto-resolved.** The newest value is not automatically "true" — the agent must not decide
   which department is right. It goes to a human queue, and conflicted sources stay out of the pack.
3. **Deduplication is by content hash, after normalisation** (whitespace, line endings) — so the same document
   saved twice, from two folders, is found.
4. **Append-only ingest.** Ingesting again changes nothing (`0 new`); a changed document adds a new record and
   keeps the old hash, so you can reconstruct what the agent could have read on any given day.
5. **Every exclusion has a reason.** Silent dropping is how RAG systems start hallucinating "missing" knowledge.

---

## Tests

```
33 tests · 33 pass
ingestor 6 · deduper 7 · freshness 6 · packer 9 · report 5
```

They caught two real bugs while this was built:
1. whitespace inside a line was **not** normalised → the same document produced two different hashes (dedup missed it);
2. the demo corpus produced 215 "duplicates" instead of 47, because every document shared the same template — fixed by
   putting a unique reference in each document (the demo numbers are now asserted by a test).

---

## Honest limitations

- Ingestion reads **local folders** today. Connectors (Drive, Notion, ticketing) are the next step; the source
  model (`id`, `owner`, `updatedAt`, `facts[]`) is already what a connector must fill.
- Conflict detection works on **structured `facts`** (`key` → `value`). Free text conflicts need an extractor
  (that is the next module, and it must be deterministic or clearly marked as a heuristic).
- Freshness measures **age against TTL**, not truth. A fresh document can still be wrong — which is why conflicts
  go to a human.
- No embeddings, no vector store: the pack is data, your indexer is your choice.

## License

MIT — see `LICENSE`.

---

## v1.0.0 — scenarios, question ranking, PII (dodato 14.10.2026)

| Novo | Šta radi | Dokaz |
|---|---|---|
| `scenarios/knowledge.json` | **7 scenarija kao PODACI** + taksonomija (`duplikat`, `konflikt`, `zastarelo`, `bez-vlasnika`, `bez-izvora`, `osetljivo`, `sveze`) | `node src/scenarios.js` → **7/7** + `reports/knowledge-scenarios-<dan>.md` |
| rangiranje po pitanju | `packer(prov, { pitanje: 'koja je cena refund-a?' })` → `match` po chunku, sort `0.6*svežina + 0.4*poklapanje` | `examples/pack.js` sekcija 3 (isto znanje, drugačiji redosled) |
| **PII u toku** | `src/sensitive.js`: JMBG, IBAN, kartica, telefon, email, tajne, lozinke → `flag: osetljivo`, nalaz **redigovan**, izvor **nikad u paket** | scenario S6 + `test/sensitive.test.js` (6 testova) |
| normalizacija za poklapanje | „cena" nalazi „cena" (dijakritika + `ije→e`) | `test/index.test.js` |
| `src/index.js` (façade) | `ingestor / deduper / freshness / packer` u 4 linije koda | `examples/pack.js` sekcija 4 |
| demo na **folderu** | `data/knowledge/` (5 fajlova: svež, istekao ×2, bez vlasnika, PII) | `examples/pack.js` sekcija 1 |
| „nema tihog izbacivanja" | izvor koji ne da nijedan chunk dobija razlog u `izbaceno` | `test/index.test.js` |

**Testovi: 50/50** · `npm test` ~1 s · tok `node examples/pack.js` **0,15 s** · i dalje **0 zavisnosti**.

### Šta je v1.0.0 otkrilo o sebi (nalazi iz rada, ne iz želje)
1. **Datum iz zaglavlja je bio pregažen mtime-om** — dokument je tvrdio 2023, mašina ga čitala kao svež. Sada tekst ima prednost (`dateSource: text`).
2. **Prekratak izvor je tiho nestajao** (ispod `minChunkChars`) — kršenje osnovnog pravila; sada svaki izlaz ima razlog, a prag je 20 znakova.
3. **„cena" nije nalazilo „cena"** — pitanje je vraćalo prazan paket; dodata je normalizacija (dijakritika + `ije→e`).
4. **Scenario S1 je tražio svež kanonski izvor, a fiksura je bila stara** — dokaz da runner ne daje pečat nego proverava.