// Validates public/content before build: JSON parses, ids are unique,
// references resolve, and every lesson has at least one markdown file.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'public/content';
const read = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const errors = [];
const bilingual = (o, where) => {
  if (!o || typeof o.vi !== 'string' || typeof o.en !== 'string')
    errors.push(`${where}: needs {vi, en}`);
};
const unique = (list, name) => {
  const seen = new Set();
  for (const x of list) {
    if (seen.has(x.id)) errors.push(`${name}: duplicate id "${x.id}"`);
    seen.add(x.id);
  }
  return seen;
};

const skills = read('skills.json');
const lessons = read('lessons.json');
const lab = read('sql-lab.json');
const cards = read('flashcards.json');

const skillIds = unique(skills, 'skills');
skills.forEach((s) => {
  bilingual(s.title, `skill ${s.id}.title`);
  bilingual(s.desc, `skill ${s.id}.desc`);
});

const exIds = unique(lab.exercises, 'sql-lab');
lab.exercises.forEach((e) => {
  bilingual(e.title, `exercise ${e.id}.title`);
  bilingual(e.prompt, `exercise ${e.id}.prompt`);
});

unique(lessons, 'lessons');
for (const l of lessons) {
  if (!skillIds.has(l.skill)) errors.push(`lesson ${l.id}: unknown skill "${l.skill}"`);
  bilingual(l.title, `lesson ${l.id}.title`);
  for (const ex of l.sqlExercises ?? [])
    if (!exIds.has(ex)) errors.push(`lesson ${l.id}: unknown exercise "${ex}"`);
  const cover = l.cover ?? `content/covers/${l.id}.svg`;
  if (!existsSync(join('public', cover))) errors.push(`lesson ${l.id}: cover not found (${cover})`);
  const has = ['vi', 'en'].filter((lang) => existsSync(join(dir, 'lessons', `${l.id}.${lang}.md`)));
  if (!has.length) errors.push(`lesson ${l.id}: no markdown file found`);
  else if (has.length === 1) console.warn(`⚠ lesson ${l.id}: only ${has[0]} version`);
  for (const lang of has) {
    const md = readFileSync(join(dir, 'lessons', `${l.id}.${lang}.md`), 'utf8');
    for (const m of md.matchAll(/!\[[^\]]*\]\((content\/[^\s)]+)/g)) {
      if (!existsSync(join('public', m[1])))
        errors.push(`lesson ${l.id}.${lang}: image not found (${m[1]})`);
    }
  }
}

unique(cards, 'flashcards');
for (const c of cards) {
  if (!skillIds.has(c.skill)) errors.push(`card ${c.id}: unknown skill "${c.skill}"`);
  bilingual(c.front, `card ${c.id}.front`);
  bilingual(c.back, `card ${c.id}.back`);
}

if (errors.length) {
  console.error('❌ Content errors:\n' + errors.map((e) => ' - ' + e).join('\n'));
  process.exit(1);
}
console.log(
  `✅ Content OK: ${skills.length} skills, ${lessons.length} lessons, ${lab.exercises.length} SQL exercises, ${cards.length} flashcards`,
);
