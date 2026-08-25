// Schonender Teil-Deploy über die Netlify-Digest-API.
// Ändert NUR die angegebenen Dateien; alle übrigen Dateien, die netlify.toml und die
// Functions bleiben unangetastet (per Hash referenziert). So wurde der Bugfix ausgeliefert.
//
// Nutzung:  node tools/deploy-changed.mjs abrechnungstest.html en/abrechnungstest.html
//   (Pfade relativ zu site/;  Umgebungsvariable DEPLOY_PROD=1 => live statt Draft)
//
// Voraussetzung: Netlify-CLI eingeloggt (Token wird aus der CLI-Config gelesen).

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const SITE = '61b47316-1197-44a2-aa0c-7d5e4aaace83';
const API = 'https://api.netlify.com/api/v1';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_DIR = path.join(ROOT, 'site');
const DRAFT = !process.env.DEPLOY_PROD;

const changedRel = process.argv.slice(2);
if (!changedRel.length) { console.error('Keine Dateien angegeben.'); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(process.env.APPDATA + '/netlify/Config/config.json', 'utf8'));
let TOKEN = process.env.NETLIFY_AUTH_TOKEN || '';
for (const u of Object.values(cfg.users || {})) if (u?.auth?.token) TOKEN = u.auth.token;
const H = { Authorization: 'Bearer ' + TOKEN };
const sha1 = b => crypto.createHash('sha1').update(b).digest('hex');
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const j = async r => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };

// aktuelle Dateiliste als Basis
const list = await j(await fetch(`${API}/sites/${SITE}/files`, { headers: H }));
const files = {}; for (const f of list) files[f.path] = f.sha;

// geänderte Dateien einspielen
const localBytes = {};
for (const rel of changedRel) {
  const b = fs.readFileSync(path.join(SITE_DIR, rel));
  const dpath = '/' + rel.replace(/\\/g, '/');
  localBytes[dpath] = b; files[dpath] = sha1(b);
  console.log('changed', dpath, files[dpath]);
}

// Functions als Zip aus site/netlify/functions mitliefern (bleiben sonst erhalten)
import { execSync } from 'child_process';
const fnDir = path.join(SITE_DIR, 'netlify', 'functions');
const functions = {}, fnBySha = {};
for (const file of fs.readdirSync(fnDir).filter(f => f.endsWith('.js'))) {
  const name = file.replace(/\.js$/, '');
  const zip = path.join(ROOT, name + '.zip');
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${path.join(fnDir, file)}' -DestinationPath '${zip}' -Force"`);
  const b = fs.readFileSync(zip); const s = sha256(b); functions[name] = s; fnBySha[s] = { name, b };
}

const dep = await j(await fetch(`${API}/sites/${SITE}/deploys`, {
  method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
  body: JSON.stringify({ files, functions, draft: DRAFT }),
}));
console.log('deploy', dep.id, DRAFT ? '(DRAFT)' : '(PROD)', '->', dep.deploy_ssl_url);

const fileBySha = {}; for (const [dp, b] of Object.entries(localBytes)) fileBySha[sha1(b)] = { dp, b };
for (const need of dep.required || []) { const h = fileBySha[need]; if (h) { const r = await fetch(`${API}/deploys/${dep.id}/files${h.dp}`, { method: 'PUT', headers: { ...H, 'Content-Type': 'application/octet-stream' }, body: h.b }); console.log('file', h.dp, r.status); } }
for (const need of dep.required_functions || []) { const h = fnBySha[need]; if (h) { const r = await fetch(`${API}/deploys/${dep.id}/functions/${h.name}?runtime=js`, { method: 'PUT', headers: { ...H, 'Content-Type': 'application/zip' }, body: h.b }); console.log('fn', h.name, r.status); } }

for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 3000)); const s = await j(await fetch(`${API}/sites/${SITE}/deploys/${dep.id}`, { headers: H })); if (['ready', 'error'].includes(s.state)) { console.log('FINAL', s.state, s.deploy_ssl_url); break; } }
