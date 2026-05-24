const grid      = document.getElementById('section-grid');
const strip     = document.getElementById('section-strip');
const panels    = document.getElementById('section-panels');
const indicator = document.getElementById('strip-indicator');
const stripTabs    = document.querySelectorAll('.strip-tab');
const summaryCards = document.querySelectorAll('.section-summary');
const navButtons   = document.querySelectorAll('.nav-link[data-open]');

const NAV_H = 56;

let activeId = null;
let busy     = false;

// ── Sliding tab indicator ────────────────────────────────
function positionIndicator(id) {
  const tab = document.querySelector(`.strip-tab[data-target="${id}"]`);
  if (!tab) return;
  const stripRect = strip.getBoundingClientRect();
  const tabRect   = tab.getBoundingClientRect();
  indicator.style.left  = (tabRect.left - stripRect.left) + 'px';
  indicator.style.width = tabRect.width + 'px';
}

// ── Scroll strip to just below sticky nav ─────────────────
function scrollToStrip() {
  requestAnimationFrame(() => {
    const rect   = strip.getBoundingClientRect();
    const target = window.scrollY + rect.top - NAV_H - 24;
    window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  });
}

// ── Open a section ────────────────────────────────────────
function openSection(id) {
  if (busy) return;
  busy = true;

  setTabs(id);
  activeId = id;

  const clickedCard = document.querySelector(`.section-summary[data-target="${id}"]`);
  if (clickedCard) {
    clickedCard.style.transition = 'transform 0.1s cubic-bezier(0.22, 1, 0.36, 1)';
    clickedCard.style.transform  = 'scale(1.03)';
  }

  setTimeout(() => {
    if (clickedCard) {
      clickedCard.style.transform  = '';
      clickedCard.style.transition = '';
    }

    grid.style.animation = 'cardsExit 0.22s ease-in forwards';

    setTimeout(() => {
      grid.style.display   = 'none';
      grid.style.animation = '';

      strip.style.display  = 'flex';
      panels.style.display = 'block';

      indicator.style.transition = 'none';
      positionIndicator(id);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        indicator.style.transition = '';
      }));

      const panel = document.getElementById(`panel-${id}`);
      panel.style.animation = 'panelEnter 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards';
      panel.classList.add('active');

      scrollToStrip();

      panel.addEventListener('animationend', () => {
        panel.style.animation = '';
        busy = false;
      }, { once: true });
    }, 220);
  }, 80);
}

// ── Switch tabs, animate height when content shrinks ──────
function switchSection(id) {
  if (busy || id === activeId) return;
  busy = true;

  const current = document.getElementById(`panel-${activeId}`);
  const next    = document.getElementById(`panel-${id}`);

  setTabs(id);
  positionIndicator(id);
  activeId = id;

  const startH = panels.offsetHeight;

  current.style.animation = 'panelTabOut 0.16s ease-out forwards';

  setTimeout(() => {
    current.classList.remove('active');
    current.style.animation = '';

    next.classList.add('active');
    const endH = panels.offsetHeight;

    if (Math.abs(startH - endH) > 2) {
      panels.style.height   = startH + 'px';
      panels.style.overflow = 'hidden';

      requestAnimationFrame(() => {
        panels.style.transition = 'height 0.34s cubic-bezier(0.4, 0, 0.2, 1)';
        panels.style.height     = endH + 'px';
        setTimeout(() => {
          panels.style.height     = '';
          panels.style.overflow   = '';
          panels.style.transition = '';
        }, 340);
      });
    }

    next.style.animation = 'panelTabIn 0.22s cubic-bezier(0.22, 1, 0.36, 1) forwards';
    next.addEventListener('animationend', () => {
      next.style.animation = '';
      busy = false;
    }, { once: true });
  }, 160);
}

// ── Close ─────────────────────────────────────────────────
function closeSection() {
  if (busy) return;
  busy = true;

  const current = document.getElementById(`panel-${activeId}`);

  current.style.animation = 'panelExit 0.18s ease-out forwards';
  setTimeout(() => {
    current.classList.remove('active');
    current.style.animation = '';
    panels.style.display = 'none';
    strip.style.display  = 'none';
    activeId = null;
    clearTabs();

    grid.style.display   = 'grid';
    grid.style.animation = 'cardsEnter 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards';
    setTimeout(() => {
      grid.style.animation = '';
      busy = false;
    }, 300);
  }, 180);
}

// ── Helpers ───────────────────────────────────────────────
function setTabs(id) {
  stripTabs.forEach(t  => t.classList.toggle('active', t.dataset.target === id));
  navButtons.forEach(b => b.classList.toggle('active', b.dataset.open === id));
}

function clearTabs() {
  stripTabs.forEach(t  => t.classList.remove('active'));
  navButtons.forEach(b => b.classList.remove('active'));
}

function expandEl(el, display) {
  el.style.display = display || 'block';
  const h = el.scrollHeight;
  el.style.maxHeight = '0';
  el.style.overflow  = 'hidden';
  el.style.transition = 'max-height 0.28s cubic-bezier(0.4, 0, 0.2, 1)';
  requestAnimationFrame(() => { el.style.maxHeight = h + 'px'; });
  setTimeout(() => {
    el.style.maxHeight  = '';
    el.style.overflow   = '';
    el.style.transition = '';
  }, 280);
}

function collapseEl(el, cb) {
  el.style.maxHeight  = el.scrollHeight + 'px';
  el.style.overflow   = 'hidden';
  el.style.transition = 'max-height 0.22s cubic-bezier(0.4, 0, 0.2, 1)';
  requestAnimationFrame(() => { el.style.maxHeight = '0'; });
  setTimeout(() => {
    el.style.display    = 'none';
    el.style.maxHeight  = '';
    el.style.overflow   = '';
    el.style.transition = '';
    if (cb) cb();
  }, 220);
}

// ── Event listeners ───────────────────────────────────────
summaryCards.forEach(card => {
  card.addEventListener('click', () => openSection(card.dataset.target));
});

stripTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    if (panels.style.display === 'none') openSection(tab.dataset.target);
    else switchSection(tab.dataset.target);
  });
});

document.getElementById('strip-back').addEventListener('click', closeSection);

navButtons.forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    if (panels.style.display !== 'block') openSection(btn.dataset.open);
    else switchSection(btn.dataset.open);
    setTimeout(scrollToStrip, 300);
  });
});

document.querySelector('.nav-link[href="#bio"]').addEventListener('click', e => {
  e.preventDefault();
  if (activeId) closeSection();
  if (window.scrollY > 10) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

// ── Career: project data ──────────────────────────────────
const careerData = {
  'tc-api': {
    tag: 'API', title: 'Tier Credits API', company: 'BetMGM · Sr. PM, Rewards',
    desc: 'Built the Tier Credits API end-to-end — the first external endpoint giving partners real-time access to loyalty tier progress. Took it from zero spec to production in one quarter.',
    impact: [
      'Unblocked 3 partner integrations that were blocked on manual data exports',
      'Reduced ad-hoc data requests to the loyalty team by ~40%',
      'Now a core part of the BetMGM rewards API surface',
    ],
    screens: [
      { label: 'Before',  caption: 'No external API. Partners had to request tier data through manual CSV exports, which took days and had no real-time fidelity.' },
      { label: 'Spec',    caption: 'Defined the endpoint shape, auth model, and rate-limit strategy. Aligned eng, compliance, and 3 partner teams on a single contract before a line of code was written.' },
      { label: 'Launch',  caption: 'REST endpoint live with real-time balance, tier level, progress %, and milestone metadata. First partner integrated within 2 weeks of launch.' },
      { label: 'Scale',   caption: 'Extended with webhooks for tier-change events. Partner doc portal live. 3 integrations active, 2 more in pipeline.' },
    ],
  },
  'ec-api': {
    tag: 'API', title: 'Express Comps API', company: 'BetMGM · Sr. PM, Rewards',
    desc: 'Designed and shipped the Express Comps API — the first write-capable comps endpoint, letting partners apply and check comps balances in real time at point of transaction.',
    impact: [
      'First API in the BetMGM comps surface to support external write operations',
      'Enabled a partner sportsbook to offer real-time comps redemption during live betting',
      'Wrote the full spec including idempotency model and compliance sign-off framework',
    ],
    screens: [
      { label: 'Before',  caption: 'Comps were read-only inside the BetMGM app. No programmatic apply or redemption path for external partners.' },
      { label: 'Design',  caption: 'Designed the read/write model with idempotency keys, balance locking, and a compliance review layer. Hardest part: defining rollback behavior for failed transactions.' },
      { label: 'v1',      caption: 'Read/write API live. Partners can check balance, apply comps, and receive confirmation in a single transaction flow.' },
      { label: 'Live',    caption: 'Partner using the API for real-time comps during live betting events. Zero rollback incidents in first 60 days.' },
    ],
  },
  'loyalty-ctx': {
    tag: 'Product', title: 'Loyalty Contextualization', company: 'BetMGM · Sr. PM, Rewards',
    desc: 'Leading an initiative to make loyalty feel personal at scale — surfacing the right message to the right user at the right moment, based on tier, betting activity, and milestone proximity.',
    impact: [
      'Personalized messaging across 5+ surfaces in the BetMGM app',
      'Reduced noise for high-value users who were seeing irrelevant low-tier prompts',
      'Building the AI scoring layer that ranks relevance per user segment in real time',
    ],
    screens: [
      { label: 'Before',   caption: 'All users saw the same loyalty prompts regardless of tier or behavior. A Platinum member saw the same "earn more points" message as a new user.' },
      { label: 'Segments', caption: 'Mapped user segments by tier, recency, and milestone distance. Identified 6 distinct messaging contexts that required different content and CTAs.' },
      { label: 'v1',       caption: 'Tier-aware messaging deployed across homepage and bet slip. High-tier users see tier protection and comp offers; lower tiers see earn-path messaging.' },
      { label: 'AI layer', caption: 'Building a scoring model that ranks message relevance per user in real time. Goal: contextual loyalty feels like 1:1, not broadcast.' },
    ],
  },
  'meta-ops': {
    tag: 'Ops', title: 'Cross-functional Coordination', company: 'Meta · Product Ops',
    desc: 'Supported product operations across Meta\'s core product org — keeping large multi-team initiatives on track by building coordination systems that scaled across eng, design, data, and legal.',
    impact: [
      'Maintained alignment across 6+ stakeholder groups on multi-quarter roadmap items',
      'Built review cadences and shared docs that reduced sync overhead',
      'This role was the foundation for moving into a full PM seat — learned to drive without authority',
    ],
    screens: [
      { label: 'Before', caption: 'Ad-hoc Slack communication across 6+ teams. Decisions made in meetings without documentation, and misalignment only surfaced at launch reviews.' },
      { label: 'System', caption: 'Built a lightweight ops layer: weekly alignment doc, shared RACI, and a single source of truth for cross-team dependencies.' },
      { label: 'After',  caption: 'Reduced re-alignment meetings by ~30%. Blockers surfaced earlier — usually 2+ weeks before they became launch risks.' },
    ],
  },
};

// ── Career: company accordion ─────────────────────────────
document.querySelectorAll('.cl-co-header').forEach(header => {
  header.addEventListener('click', () => {
    const company = header.closest('.cl-company');
    // Always open the clicked company (close others)
    document.querySelectorAll('.cl-company').forEach(c => c.classList.remove('open'));
    company.classList.add('open');
  });
});

// ── Career: project selection + detail render ─────────────
let activeProject = null;

function renderDetail(id) {
  const data = careerData[id];
  if (!data) return;

  const screens = data.screens;
  let screenIdx = 0;

  const pillsHTML = screens.map((s, i) =>
    `<button class="cds-pill${i === 0 ? ' active' : ''}" data-i="${i}">${s.label}</button>`
  ).join('');

  const slidesHTML = screens.map(s => `
    <div class="cds-slide">
      <div class="ph-box cds-ph-box"></div>
      <p class="cds-caption">${s.caption}</p>
    </div>`
  ).join('');

  document.getElementById('career-detail').innerHTML = `
    <div class="cd-proj">
      <div>
        <div class="cd-proj-header">
          <span class="cd-proj-tag">${data.tag}</span>
          <span class="cd-proj-title">${data.title}</span>
        </div>
        <div class="cd-proj-company">${data.company}</div>
      </div>
      <p class="cd-proj-desc">${data.desc}</p>
      <ul class="cd-proj-impact">${data.impact.map(i => `<li>${i}</li>`).join('')}</ul>
      <div class="cd-screens">
        <div class="cds-nav">
          <button class="cds-prev">&#8249;</button>
          <div class="cds-pills">${pillsHTML}</div>
          <button class="cds-next">&#8250;</button>
        </div>
        <div class="cds-viewport">
          <div class="cds-track">${slidesHTML}</div>
        </div>
      </div>
    </div>`;

  const detail  = document.getElementById('career-detail');
  const track   = detail.querySelector('.cds-track');
  const pills   = detail.querySelectorAll('.cds-pill');
  const prevBtn = detail.querySelector('.cds-prev');
  const nextBtn = detail.querySelector('.cds-next');

  function goToScreen(n) {
    screenIdx = Math.max(0, Math.min(n, screens.length - 1));
    track.style.transform = `translateX(-${screenIdx * 100}%)`;
    pills.forEach((p, i) => p.classList.toggle('active', i === screenIdx));
    prevBtn.disabled = screenIdx === 0;
    nextBtn.disabled = screenIdx === screens.length - 1;
  }

  prevBtn.addEventListener('click', () => goToScreen(screenIdx - 1));
  nextBtn.addEventListener('click', () => goToScreen(screenIdx + 1));
  pills.forEach(p => p.addEventListener('click', () => goToScreen(+p.dataset.i)));
  goToScreen(0); // set initial disabled state
}

document.querySelectorAll('.cl-project').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cl-project').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeProject = btn.dataset.project;
    renderDetail(activeProject);
  });
});

// ── Projects: expand/collapse cards ──────────────────────
document.querySelectorAll('.project-card').forEach(card => {
  card.addEventListener('click', () => {
    const detail = card.querySelector('.pc-detail');
    if (!detail) return;

    if (card.classList.contains('open')) {
      card.classList.remove('open');
      collapseEl(detail);
    } else {
      card.classList.add('open');
      expandEl(detail, 'flex');
      setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  });
});

// ── Hobby carousel ────────────────────────────────────────
(function initCarousel() {
  const track = document.querySelector('.hc-track');
  const dots  = document.querySelectorAll('.hc-dot');
  const total = document.querySelectorAll('.hc-slide').length;
  let current = 0;

  function goTo(n) {
    current = (n + total) % total;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
  }

  document.getElementById('hc-prev').addEventListener('click', () => goTo(current - 1));
  document.getElementById('hc-next').addEventListener('click', () => goTo(current + 1));
  dots.forEach(d => d.addEventListener('click', () => goTo(+d.dataset.index)));

  // Swipe support
  let touchStartX = null;
  const viewport = document.querySelector('.hc-viewport');
  viewport.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  viewport.addEventListener('touchend', e => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) goTo(dx < 0 ? current + 1 : current - 1);
    touchStartX = null;
  }, { passive: true });
})();
