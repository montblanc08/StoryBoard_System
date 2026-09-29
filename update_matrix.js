const fs = require('fs');
let c = fs.readFileSync('storyboard-system/docs/PRODUCT_PARITY_MATRIX.md', 'utf8');

c = c.replace(/\| Inline Double-click Editing +\|.*?\|.*?\| 🔴 MISSING +\|/g, '| Inline Double-click Editing | Present | Present | 🟢 PRESENT |');
c = c.replace(/\| Shot Command Parity +\|.*?\|.*?\| 🔴 BLOCKED +\|/g, '| Shot Command Parity | Present | Present | 🟡 PARTIAL |');

fs.writeFileSync('storyboard-system/docs/PRODUCT_PARITY_MATRIX.md', c);
