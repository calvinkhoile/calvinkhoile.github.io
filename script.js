// Tab switching
const tabs = document.querySelectorAll('.tab-btn');
const panes = document.querySelectorAll('.tab-pane');

function switchTab(id) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  panes.forEach(p => p.classList.toggle('active', p.id === id));
  if (id === 'attributes') drawRadarIfNeeded();
}

tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

// Clickable panels and section cards
document.querySelectorAll('[data-goto]').forEach(el => {
  el.addEventListener('click', () => switchTab(el.dataset.goto));
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchTab(el.dataset.goto); }
  });
});

// Mouse parallax tilt on hero center
const heroCenter = document.getElementById('hero-center');
if (heroCenter) {
  document.addEventListener('mousemove', e => {
    if (!document.getElementById('about').classList.contains('active')) return;
    const x = (e.clientX / window.innerWidth  - 0.5) * 10;
    const y = (e.clientY / window.innerHeight - 0.5) * 7;
    heroCenter.style.transform = `perspective(900px) rotateY(${x}deg) rotateX(${-y}deg)`;
  });

  document.addEventListener('mouseleave', () => {
    heroCenter.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg)';
  });
}

// Radar chart
const RATINGS = [
  { label: 'Execution',     value: 91 },
  { label: 'Data',          value: 89 },
  { label: 'Domain',        value: 93 },
  { label: 'Strategy',      value: 85 },
  { label: 'Communication', value: 83 },
  { label: 'Build',         value: 76 },
];
const MAX = 99;
let radarDrawn = false;

function drawRadarIfNeeded() {
  if (radarDrawn) return;
  radarDrawn = true;
  const canvas = document.getElementById('radar-canvas');
  if (!canvas) return;
  const size = 420;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const n = RATINGS.length;
  const angleOffset = -Math.PI / 2;

  function vertex(i, scale) {
    const angle = angleOffset + (2 * Math.PI * i) / n;
    return [cx + Math.cos(angle) * r * scale, cy + Math.sin(angle) * r * scale];
  }

  // Background rings
  [0.25, 0.5, 0.75, 1].forEach(scale => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const [x, y] = vertex(i, scale);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Axis lines
  for (let i = 0; i < n; i++) {
    const [x, y] = vertex(i, 1);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Filled polygon
  const scales = RATINGS.map(r => r.value / MAX);
  ctx.beginPath();
  scales.forEach((s, i) => {
    const [x, y] = vertex(i, s);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(245, 197, 24, 0.18)';
  ctx.fill();
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Vertex dots
  scales.forEach((s, i) => {
    const [x, y] = vertex(i, s);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f5c518';
    ctx.fill();
  });

  // Labels
  RATINGS.forEach((attr, i) => {
    const [lx, ly] = vertex(i, 1.22);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(attr.label, lx, ly - 8);
    ctx.font = '700 14px Inter, sans-serif';
    ctx.fillStyle = '#f5c518';
    ctx.fillText(attr.value, lx, ly + 10);
  });
}

if (document.getElementById('attributes')?.classList.contains('active')) {
  drawRadarIfNeeded();
}
