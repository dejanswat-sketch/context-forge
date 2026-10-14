import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pusti, provjeriScenario, ROOT } from '../src/scenarios.js';
import { napraviPaket } from '../src/packer.js';
import { usisajListu } from '../src/ingestor.js';

test('all 7 knowledge scenarios pass', () => {
  const out = pusti();
  assert.equal(out.ukupno, 7);
  assert.equal(out.proslo, 7, JSON.stringify(out.rezultati.filter((r) => !r.prosao)));
});

test('the 7 scenarios cover the whole taxonomy', () => {
  const out = pusti();
  assert.deepEqual(out.taksonomija, ['duplikat', 'konflikt', 'zastarelo', 'bez-vlasnika', 'bez-izvora', 'osetljivo', 'sveze']);
  const pokrivene = new Set(out.rezultati.map((r) => r.taksonomija));
  for (const t of out.taksonomija) assert.ok(pokrivene.has(t), `nema scenarija za ${t}`);
});

test('a scenario with a wrong expectation fails (the runner does not rubber-stamp)', () => {
  const scenario = { id: 'x', naziv: 'test', taksonomija: 'sveze', ocekivano: { chunkova: 99 } };
  const paket = napraviPaket(usisajListu([{ id: 'a.md', tekst: 'Refund do 1000€ dozvoljen uz odobrenje.', updatedAt: '2026-10-10' }]));
  const r = provjeriScenario(scenario, paket);
  assert.equal(r.prosao, false);
  assert.match(r.greske.join(' '), /chunkova/);
});

test('scenarios are data — the file is JSON and lists a taxonomy', () => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenarios', 'knowledge.json'), 'utf8'));
  assert.ok(Array.isArray(j.taksonomija) && j.taksonomija.length === 7);
  assert.equal(j.scenariji.length, 7);
  assert.ok(j.scenariji.every((s) => s.id && s.naziv && s.taksonomija && s.ulaz && s.ocekivano));
});
