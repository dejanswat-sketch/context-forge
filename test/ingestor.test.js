import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizuj, okvir, usisajFolder, usisajListu, usisajUFalsifikat } from '../src/ingestor.js';
import { citajJsonl } from '../src/store.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cf-ing-'));

test('normalisation makes whitespace differences irrelevant', () => {
  assert.equal(normalizuj('a\r\n\r\n\r\n b  \n'), normalizuj('a\n\n b'));
  assert.equal(normalizuj('  x  '), 'x');
});

test('a source gets a content hash, size and word count', () => {
  const s = okvir({ id: 'a.md', tip: 'docs', tekst: 'jedan dva tri', updatedAt: '2026-01-01T00:00:00Z' });
  assert.match(s.hash, /^[0-9a-f]{64}$/);
  assert.equal(s.words, 3);
  assert.ok(s.bytes > 0);
});

test('identical content -> identical hash (that is how duplicates are found)', () => {
  const a = okvir({ id: 'a.md', tekst: 'isti tekst' });
  const b = okvir({ id: 'b.md', tekst: 'isti   tekst\n' });
  assert.equal(a.hash, b.hash);
});

test('folder ingest reads supported files and ignores the rest', () => {
  const d = tmp();
  fs.mkdirSync(path.join(d, 'pod'), { recursive: true });
  fs.writeFileSync(path.join(d, 'a.md'), '# A\n\ntekst');
  fs.writeFileSync(path.join(d, 'pod', 'b.json'), '{"k":1}');
  fs.writeFileSync(path.join(d, 'slika.png'), 'binarno');
  const izvori = usisajFolder(d);
  assert.equal(izvori.length, 2);
  assert.equal(izvori[0].dateSource, 'file-mtime');
  assert.ok(izvori.every((s) => s.hash));
  fs.rmSync(d, { recursive: true, force: true });
});

test('ingest is idempotent: unchanged sources are not written twice', () => {
  const d = tmp();
  const put = path.join(d, 'data', 'knowledge.jsonl');
  const izvori = usisajListu([{ id: 'a.md', tekst: 'isti tekst' }, { id: 'b.md', tekst: 'drugi tekst' }]);
  const prvi = usisajUFalsifikat(izvori, { put });
  const drugi = usisajUFalsifikat(izvori, { put });
  assert.equal(prvi.novi, 2);
  assert.equal(drugi.novi, 0);
  assert.equal(drugi.nepromijenjeni, 2);
  assert.equal(citajJsonl(put).length, 2);
  fs.rmSync(d, { recursive: true, force: true });
});

test('a changed source is appended as a new record (append-only, old hash kept)', () => {
  const d = tmp();
  const put = path.join(d, 'data', 'knowledge.jsonl');
  usisajUFalsifikat(usisajListu([{ id: 'a.md', tekst: 'verzija 1' }]), { put });
  usisajUFalsifikat(usisajListu([{ id: 'a.md', tekst: 'verzija 2' }]), { put });
  const zapisi = citajJsonl(put);
  assert.equal(zapisi.length, 2);
  assert.notEqual(zapisi[0].hash, zapisi[1].hash);
  fs.rmSync(d, { recursive: true, force: true });
});
