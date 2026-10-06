import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');
const STATIC = join(ROOT, 'static');
const DIST = join(ROOT, 'dist');

const site = JSON.parse(readFileSync(join(CONTENT, 'site.json'), 'utf8'));
const DOMAIN = String(site.domain || '').replace(/\/$/, '');

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
const defaultRender = md.renderer.rules.link_open ||
  function (tokens, idx, options, env, self) { return self.renderToken(tokens, idx, options); };
const isRelative = (u) => u && !/^([a-z]+:|\/|#)/i.test(u);

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  let href = tokens[idx].attrGet('href') || '';
  if (env && env.repo && isRelative(href)) {
    href = `https://github.com/${env.repo}/blob/HEAD/${href.replace(/^\.\//, '')}`;
    tokens[idx].attrSet('href', href);
  }
  if (/^https?:\/\//i.test(href) && (!DOMAIN || !href.startsWith(DOMAIN))) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  return defaultRender(tokens, idx, options, env, self);
};

const defaultImage = md.renderer.rules.image;
md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const src = tokens[idx].attrGet('src') || '';
  if (env && env.repo && isRelative(src)) {
    tokens[idx].attrSet('src', `https://raw.githubusercontent.com/${env.repo}/HEAD/${src.replace(/^\.\//, '')}`);
  }
  return defaultImage(tokens, idx, options, env, self);
};

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const slugify = (s) => String(s).toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const isoDate = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const fmtDate = (d) => { const [y, m, day] = isoDate(d).split('-'); return `${y}.${m}.${day}`; };
const year = new Date().getFullYear();

function readCollection(dir) {
  const full = join(CONTENT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { data, content } = matter(readFileSync(join(full, f), 'utf8'));
      return {
        ...data,
        slug: data.slug ? slugify(data.slug) : slugify(basename(f, '.md')),
        date: data.date ? isoDate(data.date) : '1970-01-01',
        body: content,
        html: md.render(content),
      };
    })
    .filter((item) => item.draft !== true);
}

const githubRepo = (url) => {
  const m = String(url || '').match(/^https:\/\/github\.com\/([^/]+\/[^/#?]+)/i);
  return m ? m[1].replace(/\.git$/, '') : null;
};

const storyList = (html) => html.replace(
  /<li><a ([^>]*)>([\s\S]*?)<\/a>\s+[-–]\s+([\s\S]*?)<\/li>/g,
  '<li class="story"><a class="story-link" $1>$2</a><span class="story-desc">$3</span></li>'
);

async function mirrorReadmes(items) {
  for (const item of items) {
    const repo = githubRepo(item.url);
    if (!repo || item.body.trim()) continue;
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/README.md`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      item.html = storyList(md.render(await res.text(), { repo }));
      console.log(`  mirrored README: ${repo}`);
    } catch (err) {
      console.warn(`  could not fetch README for ${repo}: ${err.message}`);
    }
  }
}

const projects = readCollection('projects').sort((a, b) => {
  if (a.order != null && b.order != null) return a.order - b.order;
  return b.date.localeCompare(a.date);
});

await mirrorReadmes(projects);

function head({ title, description, path }) {
  const url = DOMAIN + path;
  const ogImg = (DOMAIN || '') + '/og.png';
  return `<!DOCTYPE html>
<!--
  Hey! Nice to meet you!!

  There are a few surprises for the curious.

  Say hi: s@seamusf.com
-->
<html lang="en" class="no-js">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(url)}" />

  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:image" content="${esc(ogImg)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(ogImg)}" />

  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta name="theme-color" content="#111111" />
  <link rel="stylesheet" href="/style.css" />
  <script>document.documentElement.classList.remove('no-js');document.documentElement.classList.add('js');</script>
</head>
<body>`;
}

function nav({ home = false, active = null } = {}) {
  const A = (id) => home ? `#${id}` : `/#${id}`;
  const cls = (key) => active === key ? ' class="active"' : '';
  return `
  <nav class="nav">
    <a href="${home ? '#hero' : '/'}" class="nav-logo">${esc(site.logo)}</a>
    <ul class="nav-links">
      <li><a href="${home ? '#hero' : '/'}">Home</a></li>
      <li><a href="${A('about')}">About</a></li>
      <li><a href="${home ? '#projects' : '/projects/'}"${cls('projects')}>Projects</a></li>
      <li><a href="${A('contact')}">Contact</a></li>
    </ul>
  </nav>`;
}

function footer() {
  const left = String(site.footerLeft || '').replace('{year}', year);
  const right = String(site.footerRight || '').replace('{year}', year);
  return `
  <footer class="footer">
    <span class="footer-text">${esc(left)}</span>
    <span class="footer-text">${esc(right)}</span>
  </footer>`;
}

function tail({ hero = false } = {}) {
  return `
  ${hero ? '<script src="/hero.js"></script>' : ''}
  <script src="/nav.js"></script>
  <script src="/konami.js"></script>
</body>
</html>`;
}

function projectCard(p, i) {
  const delay = i > 0 ? ` reveal-delay-${Math.min(i, 4)}` : '';
  return `
        <a href="/projects/${esc(p.slug)}/" class="project-card reveal${delay}">
          <svg class="card-trace" aria-hidden="true"><path d="" fill="none"/></svg>
          <div class="project-num">${String(i + 1).padStart(3, '0')}</div>
          <div class="project-tag">${esc(p.tag)}</div>
          <h3 class="project-title">${esc(p.title)}</h3>
          <p class="project-desc">${esc(p.desc)}</p>
          <span class="project-arrow">↗</span>
        </a>`;
}

function pageHome() {
  const featuredProjects = projects.slice(0, 4);
  const links = site.links || {};
  const skillGroups = site.skills || [];
  const contactLink = (href, sigil, name, delay, extra = '') => `
      <a href="${esc(href || '#')}" class="contact-link reveal${delay ? ' reveal-delay-' + delay : ''}"${extra}>
        <span class="contact-sigil">${sigil}</span>
        <span class="contact-name">${name}</span>
        <span class="contact-arrow">↗</span>
      </a>`;

  const main = `
  <section id="hero">
    <div class="hero-dots" aria-hidden="true"></div>
    <div class="hero-dots hero-dots-glow" aria-hidden="true"></div>
    <canvas class="hero-canvas"></canvas>
    <div class="hero-glow"></div>
    <div class="hero-rule"></div>
    <p class="hero-tag">${esc(site.role)}</p>
    <h1 class="hero-name">${esc(site.firstName)}<br><em>${esc(site.lastName)}</em></h1>
    <p class="hero-byline">${esc(site.heroByline)}</p>
    <div class="hero-scroll">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </section>

  <section id="about" class="section">
    <div class="section-label"><span class="section-num">01</span>About</div>
    <div class="about-grid">
      <h2 class="about-headline reveal">${site.about.headline}</h2>
      <p class="about-text reveal reveal-delay-1">${esc(site.about.body)}</p>
    </div>
    ${skillGroups.length ? `<div class="skills-row reveal">${skillGroups.map((g) => `
      <div class="skills-group">
        <span class="skills-label">${esc(g.label)}</span>
        <ul class="skills">${g.items.map((s) => `<li class="skill-tag">${esc(s)}</li>`).join('')}</ul>
      </div>`).join('')}
    </div>` : ''}
  </section>

  <section id="projects" class="section">
    <div class="section-label"><span class="section-num">02</span>Projects</div>
    <div class="projects-grid">${featuredProjects.length
      ? featuredProjects.map(projectCard).join('')
      : '<p class="empty-state empty-state-grid">No projects yet</p>'}
    </div>
    <a href="/projects/" class="see-more reveal">All projects →</a>
  </section>

  <section id="contact" class="section">
    <div class="section-label"><span class="section-num">03</span>Contact</div>
    <div class="contact-links">
    ${contactLink(links.github, '[gh]', 'GitHub', 0) +
    contactLink(links.linkedin, '[li]', 'LinkedIn', 1) +
    contactLink(links.resume, '[cv]', 'Resume', 2, ' data-resume') +
    contactLink('mailto:' + links.email, '[@]', 'Email', 3)
    }
    </div>
  </section>

  <dialog class="resume-dialog" id="resume-dialog" aria-labelledby="resume-dialog-title">
    <p class="resume-dialog-title" id="resume-dialog-title">Resume</p>
    <div class="resume-dialog-actions">
      <a href="${esc(links.resume)}" target="_blank" rel="noopener" class="contact-link resume-option">
        <span class="contact-sigil">[view]</span>
        <span class="contact-name">View in browser</span>
        <span class="contact-arrow">↗</span>
      </a>
      <a href="${esc(links.resume)}" download="SeamusFreitagResume.pdf" class="contact-link resume-option">
        <span class="contact-sigil">[dl]</span>
        <span class="contact-name">Download PDF</span>
        <span class="contact-arrow">↓</span>
      </a>
    </div>
    <button type="button" class="resume-close" aria-label="Close">×</button>
  </dialog>`;

  return head({ title: `${site.fullName} | ${site.role}`, description: site.metaDescription, path: '/' })
    + nav({ home: true }) + main + footer() + tail({ hero: true });
}

function pageProjects() {
  const main = `
  <main class="page">
    <header class="page-header">
      <div class="page-header-glow"></div>
      <p class="page-header-tag">Work &amp; Lab</p>
      <h1 class="page-header-title">Pro<em>jects</em></h1>
      <p class="page-header-sub">Security, development, and systems work. Each project mirrors its GitHub repo, with the full source one click away.</p>
    </header>
    <section class="section">
      <div class="section-label"><span class="section-num">00</span>All Projects</div>
      <div class="projects-grid">${projects.length
      ? projects.map(projectCard).join('')
      : '<p class="empty-state empty-state-grid">No projects yet</p>'}
      </div>
    </section>
  </main>`;
  return head({ title: `Projects | ${site.fullName}`, description: `Security, development, and systems projects by ${site.fullName}.`, path: '/projects/' })
    + nav({ active: 'projects' }) + main + footer() + tail();
}

function pageProject(p) {
  const extLink = p.url
    ? `<p class="view-source"><a href="${esc(p.url)}" class="back-link" target="_blank" rel="noopener noreferrer">View on GitHub ↗</a></p>`
    : '';
  const main = `
  <main class="page">
    <div class="back-nav"><a href="/projects/" class="back-link">← All projects</a></div>
    <header class="page-header">
      <div class="page-header-glow"></div>
      <p class="page-header-tag">${esc(p.tag)}</p>
      <h1 class="page-header-title">${esc(p.title)}</h1>
      <p class="page-header-sub">${esc(p.desc)}</p>
      <p class="page-header-date">${fmtDate(p.date)}</p>
      ${extLink}
    </header>
    <section class="section">
      <div class="content-body prose">${p.html}</div>
      ${extLink}
    </section>
    <div class="back-nav-bottom"><a href="/projects/" class="back-link">← All projects</a></div>
  </main>`;
  return head({ title: `${p.title} | ${site.fullName}`, description: p.desc || p.title, path: `/projects/${p.slug}/` })
    + nav({ active: 'projects' }) + main + footer() + tail();
}

function page404() {
  const main = `
  <main class="page">
    <header class="page-header">
      <div class="page-header-glow"></div>
      <p class="page-header-tag">Error</p>
      <h1 class="page-header-title">4<em>04</em></h1>
      <p class="page-header-sub">Uh oh! This one seems to be missing.</p>
    </header>
    <section class="section">
      <a href="/" class="back-link">← Back home</a>
    </section>
  </main>`;
  return head({ title: `Not found | ${site.fullName}`, description: 'Page not found.', path: '/404.html' })
    + nav() + main + footer() + tail();
}

function sitemap() {
  const urls = ['/', '/projects/',
    ...projects.map((p) => `/projects/${p.slug}/`)];
  const body = urls.map((u) => `  <url><loc>${esc(DOMAIN + u)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function write(path, contents) {
  const full = join(DIST, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

write('index.html', pageHome());
write('projects/index.html', pageProjects());
projects.forEach((p) => write(`projects/${p.slug}/index.html`, pageProject(p)));
write('404.html', page404());
if (DOMAIN) write('sitemap.xml', sitemap());

cpSync(STATIC, DIST, { recursive: true });

console.log(`Built → dist/`);
console.log(`  ${projects.length} projects`);
console.log(`  pages: home, projects, ${projects.length} project, 404`);
if (!DOMAIN) console.log('  (set "domain" in content/site.json to emit sitemap.xml and absolute URLs)');