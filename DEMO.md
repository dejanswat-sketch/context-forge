# DEMO — what you actually see when it runs

This page exists because a README full of claims is worth less than 30 seconds of real output.
Everything below was produced by running the commands, not written by hand.

---

## 1. Full flow — `node examples/pack.js` (0.15 s)

```
Context Forge — knowledge pack example

1) FOLDER data/knowledge (isti tok kao u produkciji)
   izvora 5 → chunkova 2 · izbačeno 3
   • anonimni.md#1            svežina 1.00 (fresh) · vlasnik —       · sha256:a2132e6c8aff0a53|izvor:anonimni.md|datum:2026-10-14
   • policy_2026.md#1         svežina 0.97 (fresh) · vlasnik finansije · sha256:f01d82df0485380e|izvor:policy_2026.md|datum:2026-10-10
   ✗ cenovnik_2023.md         isteklo: 1368.5 dana / TTL 180
   ✗ kupci_pii.md             osetljivo: PII u izvoru (email, iban, jmbg, kartica, telefon)
```

**Read it as a buyer would:**

| Line | What it proves |
|---|---|
| `izvora 5 → chunkova 2 · izbačeno 3` | it does not just ingest — it **decides what to drop** |
| `svežina 1.00 (fresh)` | every chunk carries a **freshness score**, not a guess |
| `vlasnik finansije` | every chunk carries an **owner** |
| `sha256:...` | every chunk is **signed** — the answer can be traced back |
| `✗ cenovnik_2023.md isteklo: 1368.5 dana / TTL 180` | an **expired** document is refused, with the exact age |
| `✗ kupci_pii.md osetljivo: PII` | **personal data is blocked** before it ever reaches a model |

That is the whole product in one screen: the two things that ruin RAG (stale facts and leaked personal data)
are stopped **before** the model sees them.

---

## 2. Scenarios — `node src/scenarios.js` (7/7)

Seven real situations are kept as **data** (`scenarios/knowledge.json`), not buried in code, so a company can add
its own without touching the program. Each scenario is checked on every run.

---

## 3. Tests — `npm test` (50 checks)

```
ℹ tests 50
ℹ pass 50
ℹ fail 0
ℹ duration_ms 208
```

No dependencies, no network — it runs on a machine with nothing installed except Node 20+.

---

## 4. Report — `node src/report.js`

Produces the human-readable pack plus a `.md.sha256` file, so the delivered document can be verified later
by anyone who received it.

---

## 5. Try it yourself (under one minute)

```bash
git clone https://github.com/dejanswat-sketch/context-forge.git
cd context-forge
node examples/pack.js     # the output above
npm test                  # 50/50
```

No `npm install`. No `.env`. No key. No internet.

---

## Recording a GIF (optional, for the README hero)

Terminal recordings are the strongest form of proof for a CLI tool. On Windows:

1. Install **ScreenToGif** (free) — or press **Win+G** for the built-in recorder.
2. Record a terminal window while running `node examples/pack.js` (about 20 seconds is enough).
3. Save as `demo.gif`, put it in the repository root.
4. Add at the top of `README.md`:

```markdown
![Context Forge demo](demo.gif)
```

That single line replaces several paragraphs of explanation.
