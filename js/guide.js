// The guide: one language at a time (shared with the main page), and the contents follow the reading.
const root = document.documentElement;
const qs = new URLSearchParams(location.search);
const META = {
  it: { title: 'Guida di DevTrack', desc: 'Come si usa DevTrack: il timer, i progetti, le attività da Azure DevOps, la rendicontazione per ogni piattaforma, gli assistenti AI, l\'importazione e l\'esportazione dei dati.' },
  en: { title: 'DevTrack guide', desc: 'How to use DevTrack: the timer, projects, Azure DevOps tasks, reporting for each platform, AI assistants, importing and exporting your data.' },
};
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } }
function pick() {
  const q = qs.get('lang'); if (q in META) return q;
  const s = store('lang'); if (s in META) return s;
  return (navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en';
}
function apply(lang) {
  root.lang = lang;
  document.title = META[lang].title;
  document.querySelector('meta[name="description"]').content = META[lang].desc;
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}
apply(pick());
document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => { store('lang', b.dataset.lang); apply(b.dataset.lang); }));

// contents: mark the section being read
const links = new Map([...document.querySelectorAll('.g-toc a')].map((a) => [a.hash.slice(1), a]));
const seen = new Set();
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
  const first = [...links.keys()].find((id) => seen.has(id));
  links.forEach((a, id) => (id === first ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
}, { rootMargin: '-20% 0px -60% 0px' });
document.querySelectorAll('.g-body section').forEach((s) => io.observe(s));
