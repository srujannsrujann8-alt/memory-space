import fs from 'fs';
import path from 'path';

const dir = 'C:/Users/sruja/AppData/Local/Google/Chrome/User Data/Default/Local Storage/leveldb';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ldb') || f.endsWith('.log'));
for (const f of files) {
  try {
    const buf = fs.readFileSync(path.join(dir, f));
    const str = buf.toString('latin1');
    const idx = str.indexOf('dxyxjdsockmtrqfcazdw-auth-token');
    if (idx !== -1) {
      const slice = str.slice(idx, idx + 2000);
      const m = slice.match(/"access_token":"([^"]+)"/);
      if (m) {
        console.log(m[1]);
        process.exit(0);
      }
    }
  } catch(e) {}
}
