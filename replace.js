const fs = require('fs');
let c = fs.readFileSync('apps/web/app/(workspace)/production/[id]/shots/page.tsx', 'utf8');

c = c.replace(/value=\{shot\.description \|\| `\}/g, "value={shot.description || ''}");
c = c.replace(/value=\{shot\.voice_over \|\| `\}/g, "value={shot.voice_over || ''}");

fs.writeFileSync('apps/web/app/(workspace)/production/[id]/shots/page.tsx', c);
