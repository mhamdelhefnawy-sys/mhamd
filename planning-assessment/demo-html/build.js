/**
 * Builds demo-html/index.html: a single-file, browser-only replica of the
 * core candidate/assessment/scoring experience, with the full question bank
 * from content/questions/*.json embedded inline (localStorage-backed, no
 * server). Regenerate after editing template.html or growing the question
 * bank: `node demo-html/build.js` from the planning-assessment/ directory.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'content', 'questions');
let all = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  all = all.concat(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
const data = JSON.stringify(all).split('</script').join('<\\/script');
const out = tpl.replace('__QUESTIONS_DATA__', () => data);

fs.writeFileSync(path.join(__dirname, 'index.html'), out);
console.log(`Built demo-html/index.html — ${all.length} questions, ${(out.length / 1024 / 1024).toFixed(2)} MB.`);
