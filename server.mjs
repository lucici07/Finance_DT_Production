import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const hash = value => createHash('sha256').update(value).digest();
const fail = (status, message) => Object.assign(new Error(message), { status });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
export { validState } from './state-validation.mjs';
import { validState } from './state-validation.mjs';

export function createPlanServer({ ownerKey, dbPath = resolve(root, 'runtime/plan.sqlite') } = {}) {
  if (typeof ownerKey !== 'string' || ownerKey.length < 32) throw new Error('Set OWNER_KEY to a random secret of at least 32 characters.');
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL, revision INTEGER NOT NULL, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS shares (token TEXT PRIMARY KEY, page_id TEXT NOT NULL, created TEXT NOT NULL);`);
  const read = () => db.prepare('SELECT * FROM workspace WHERE id=1').get();
  const ownerHash = hash(ownerKey);
  const assets = new Set(['index.html', 'app.js', 'sync.js', 'sync.css', 'share.html', 'share.js', 'styles.css', 'details.css', 'calendar.css', 'dashboard.css', 'production.css', 'vendor/exceljs.min.js']);
  const types = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8' };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/api/health' && req.method === 'GET') return send(200, { service: 'finance-dt-sync', version: 1 });
      if (path.startsWith('/api/')) {
        if (path.startsWith('/api/shared/') && req.method === 'GET') {
          const token = path.slice('/api/shared/'.length);
          const share = /^[a-f0-9]{64}$/.test(token) && db.prepare('SELECT * FROM shares WHERE token=?').get(hash(token).toString('hex'));
          const saved = read();
          if (!share || !saved) throw fail(404, 'This share link is unavailable or has been revoked.');
          const state = JSON.parse(saved.state);
          const name = Object.keys(state.data).find(name => state.pageMeta[name]?.id === share.page_id);
          if (!name) throw fail(404, 'This page is no longer shared.');
          const headers = state.pageMeta[name].headers || (state.futureSheets.includes(name) ? ['No.', 'Category', 'Topic', 'Content', 'Focal Name', 'Priority', 'Status', 'Start Date', 'Due Date', 'Last Update'] : ['No.', 'Category', 'Topic', 'Content', 'Focal Name', 'Date', 'Due Date', 'Last Update', 'Status', 'Next Action', 'Note']);
          return send(200, { name, headers, rows: state.data[name].map(row => row.slice(0, headers.length)), updated: saved.updated, revision: saved.revision });
        }
        const key = (req.headers.authorization || '').replace(/^Bearer /, '');
        if (!timingSafeEqual(hash(key), ownerHash)) throw fail(401, 'Enter a valid owner key.');
        if (path === '/api/workspace' && req.method === 'GET') {
          const saved = read();
          return send(200, saved ? { state: JSON.parse(saved.state), revision: saved.revision, updated: saved.updated } : { state: null, revision: 0 });
        }
        let body = {};
        if (['PUT', 'POST'].includes(req.method)) {
          if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'JSON required.');
          const parts = []; let size = 0;
          for await (const part of req) { size += part.length; if (size > 5 * 1024 * 1024) throw fail(413, 'Workspace exceeds the 5 MB limit.'); parts.push(part); }
          try { body = JSON.parse(Buffer.concat(parts).toString()); } catch { throw fail(400, 'Invalid JSON.'); }
          if (!object(body)) throw fail(400, 'Invalid request.');
        }
        if (path === '/api/workspace' && req.method === 'PUT') {
          let valid = false; try { valid = validState(body.state); } catch { /* Excessively nested input is invalid. */ }
          if (!valid || !Number.isSafeInteger(body.revision) || body.revision < 0) throw fail(400, 'Invalid workspace.');
          db.exec('BEGIN IMMEDIATE');
          try {
            const revision = read()?.revision || 0;
            if (revision !== body.revision) throw fail(409, 'Cloud data changed. Back up this device, then load the cloud version before saving.');
            const updated = new Date().toISOString();
            db.prepare('INSERT INTO workspace VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state, revision=excluded.revision, updated=excluded.updated').run(JSON.stringify(body.state), revision + 1, updated);
            db.exec('COMMIT');
            return send(200, { revision: revision + 1, updated });
          } catch (error) { db.exec('ROLLBACK'); throw error; }
        }
        if (path === '/api/shares' && req.method === 'POST') {
          const saved = read();
          if (!saved || body.revision !== saved.revision) throw fail(409, 'Save the current version before sharing.');
          const state = JSON.parse(saved.state);
          if (typeof body.pageId !== 'string' || !Object.values(state.pageMeta).some(meta => meta.id === body.pageId)) throw fail(400, 'Page not found.');
          const token = randomBytes(32).toString('hex');
          db.prepare('INSERT INTO shares VALUES (?,?,?)').run(hash(token).toString('hex'), body.pageId, new Date().toISOString());
          return send(201, { token });
        }
        if (path === '/api/shares' && req.method === 'DELETE') {
          db.prepare('DELETE FROM shares').run();
          return send(200, { revoked: true });
        }
        throw fail(404, 'Not found.');
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw fail(405, 'Method not allowed.');
      const asset = path === '/' ? 'index.html' : path.slice(1);
      if (!assets.has(asset)) throw fail(404, 'Not found.');
      const bytes = readFileSync(resolve(root, asset));
      res.writeHead(200, { 'Content-Type': types[asset.split('.').at(-1)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) { send(error.status || 500, { error: error.status ? error.message : 'Server error. Please try again.' }); }
  });
  server.on('close', () => db.close());
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createPlanServer({ ownerKey: process.env.OWNER_KEY, dbPath: process.env.DATA_DIR ? resolve(process.env.DATA_DIR, 'plan.sqlite') : undefined });
  server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`Finance DT server listening on port ${server.address().port}`));
}
