// Read-only: lists every game Eyad Store offers, with the id to use as the picture file name. Never prints the key.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(here, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const eyad = await import('../lib/eyad.js');

try {
  const list = await eyad.games();
  if (!list.length) {
    console.log('Eyad returned no games.');
  } else {
    const rows = list.map((g) => ({
      id: String(g.id ?? g.game ?? g.slug ?? g.code ?? '?'),
      name: String(g.name ?? g.title ?? '?'),
    }));
    rows.sort((a, b) => a.name.localeCompare(b.name));
    if (rows.every((r) => r.id === '?')) {
      console.log('Could not find the id field. Fields on the first game: ' + Object.keys(list[0]).join(', '));
    }
    const out = [
      `Eyad games: ${rows.length}`,
      'File name = ID + .jpg / .png / .webp, saved in public\\topup\\',
      '',
      ...rows.map((r) => `${r.id}  |  ${r.name}`),
    ].join('\r\n');
    const file = path.join(os.homedir(), 'Desktop', 'eyad-games.txt');
    try {
      fs.writeFileSync(file, out, 'utf8');
      console.log(out + '\r\n\r\nAlso saved to: ' + file);
    } catch {
      console.log(out);
    }
  }
} catch (e) {
  console.log('Failed: ' + e.message);
}