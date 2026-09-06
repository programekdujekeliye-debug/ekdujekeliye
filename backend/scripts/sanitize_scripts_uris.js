import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = __dirname;
const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.js'));
let modified = 0;
const safeUriExpr = '(process.env.PROD_MONGO_URI || process.env.MONGO_URI)';

for (const f of files) {
  const p = path.join(scriptsDir, f);
  let content = fs.readFileSync(p, 'utf8');
  if (content.includes('dsixmq0.mongodb.net')) {
    // Replace single-quoted and double-quoted mongodb+srv URIs
    const regex1 = /'mongodb\+srv:\/\/[^']*dsixmq0\.mongodb\.net[^']*'/g;
    const regex2 = /"mongodb\+srv:\/\/[^"]*dsixmq0\.mongodb\.net[^"]*"/g;
    content = content.replace(regex1, safeUriExpr);
    content = content.replace(regex2, safeUriExpr);
    fs.writeFileSync(p, content, 'utf8');
    modified++;
  }
}
console.log(`Sanitized ${modified} files.`);
