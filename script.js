const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
const EASE = 'cubic-bezier(.22, 1, .36, 1)'; // same curve as --ease in style.css

// "Seen once": run a function the first time an element scrolls into view.
const onSeen = new Map();
const watcher = new IntersectionObserver(entries => entries.forEach(e => {
  if (!e.isIntersecting) return;
  watcher.unobserve(e.target);
  onSeen.get(e.target)();
}), { threshold: 0.3 });
const whenSeen = (el, fn) => { onSeen.set(el, fn); watcher.observe(el); };

// 1. Intro. Everything on the first screen waits for it to finish.
const intro = document.querySelector('.intro');
let introDone;
const afterIntro = new Promise(r => { introDone = r; });
if (document.documentElement.classList.contains('play-intro')) {
  const end = () => { intro.remove(); removeEventListener('keydown', end); introDone(); };
  intro.addEventListener('click', end);
  intro.addEventListener('animationend', e => { if (e.target === intro) end(); });
  addEventListener('keydown', end);
} else {
  intro.remove();
  introDone();
}

if (!calm) {
  // 2. Headings rise out of a mask, one line at a time, once.
  document.querySelectorAll('.reveal').forEach(el => {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.innerHTML = text.split(/\s+/).map(w => `<span class="w" aria-hidden="true"><span>${w.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span></span>`).join(' ');
    afterIntro.then(() => whenSeen(el, () => {
      let line = -1, top = null;
      el.querySelectorAll('.w').forEach(w => {
        if (w.offsetTop !== top) { top = w.offsetTop; line++; }
        w.firstChild.style.setProperty('--d', line * 0.12 + 's');
      });
      el.classList.add('in');
    }));
  });

  // 3. "15+" counts up once when seen. Clicking it fires a short lightning (max once per 1.2 s).
  const num = document.querySelector('.num');
  num.textContent = '0+';
  afterIntro.then(() => whenSeen(num, () => {
    const t0 = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - t0) / 600);
      num.textContent = Math.round(15 * (1 - (1 - t) ** 5)) + '+';
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const flash = document.querySelector('.flash');
  let resting = false;
  const zap = () => {
    if (resting) return;
    resting = true;
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    setTimeout(() => { resting = false; }, 1200);
  };
  num.setAttribute('role', 'button');
  num.tabIndex = 0;
  num.setAttribute('aria-label', '15+ clients. Press for lightning.');
  num.addEventListener('click', zap);
  num.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zap(); } });

  // 4. Before/after handle pulses once when it first comes into view.
  const cmp = document.querySelector('.compare');
  whenSeen(cmp, () => cmp.classList.add('pulse'));
}

// 5. Cursor light and poster tilt: mouse only, never on touch screens or with reduce motion.
if (mouse && !calm) {
  const glow = document.querySelector('.glow');
  const arts = [...document.querySelectorAll('.art')];
  let x = 0, y = 0, queued = false;
  const paint = () => {
    queued = false;
    glow.style.transform = `translate(${x}px, ${y}px)`;
    glow.classList.add('on');
    for (const a of arts) {
      const r = a.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      a.style.setProperty('--x', x - r.left + 'px');
      a.style.setProperty('--y', y - r.top + 'px');
    }
  };
  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    if (!queued) { queued = true; requestAnimationFrame(paint); }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => glow.classList.remove('on'));

  document.querySelectorAll('.poster').forEach(p => {
    p.addEventListener('pointermove', e => {
      const r = p.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      p.style.transform = `perspective(900px) rotateY(${px * 7}deg) rotateX(${-py * 7}deg)`;
    });
    p.addEventListener('pointerleave', () => { p.style.transform = ''; });
  });
}

// 6. Filter above the wall.
const wall = document.querySelector('.wall');
const filters = document.querySelectorAll('.filter button');
filters.forEach(b => b.addEventListener('click', () => {
  wall.dataset.show = b.dataset.show;
  filters.forEach(f => f.setAttribute('aria-pressed', f === b));
  wall.scrollLeft = 0;
}));

// 7. Full-screen viewer: arrows, swipe, counter. Unfinished notes ([NOTE] or empty) are never shown.
const viewer = document.querySelector('.viewer');
const big = viewer.querySelector('img');
const note = viewer.querySelector('.note');
const count = viewer.querySelector('.count');
let list = [], at = 0;
const pad = n => String(n).padStart(2, '0');
const show = i => {
  at = (i + list.length) % list.length;
  const p = list[at];
  big.src = p.dataset.full;
  big.alt = p.querySelector('img').alt;
  const text = (p.dataset.note || '').trim();
  note.textContent = text;
  note.hidden = !text || text === '[NOTE]';
  count.textContent = `${pad(at + 1)} / ${pad(list.length)}`;
  if (!calm) {
    big.animate([{ opacity: 0, transform: 'scale(1.04)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: EASE });
    if (!note.hidden) note.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 150, easing: EASE, fill: 'backwards' });
  }
};
document.querySelectorAll('.poster').forEach(p => p.addEventListener('click', () => {
  list = [...wall.querySelectorAll('.poster')].filter(x => x.offsetParent !== null); // only what the filter shows
  show(list.indexOf(p));
  viewer.showModal();
}));
viewer.querySelector('.prev').addEventListener('click', () => show(at - 1));
viewer.querySelector('.next').addEventListener('click', () => show(at + 1));
viewer.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') show(at + 1);
  if (e.key === 'ArrowLeft') show(at - 1);
});
let startX = null, swiped = false;
viewer.addEventListener('pointerdown', e => { startX = e.clientX; });
viewer.addEventListener('pointerup', e => {
  const dx = e.clientX - startX;
  if (startX !== null && Math.abs(dx) > 50) { swiped = true; show(at + (dx < 0 ? 1 : -1)); }
  startX = null;
});
viewer.addEventListener('click', e => {
  if (swiped) { swiped = false; return; }
  if (e.target === viewer || e.target.classList.contains('close')) viewer.close();
});
viewer.addEventListener('close', () => big.removeAttribute('src'));

// 8. Before/after wipe: drag on the image, or use the slider underneath.
const compare = document.querySelector('.compare');
const range = compare.parentNode.querySelector('input');
const setPos = v => { compare.style.setProperty('--pos', v + '%'); range.value = v; };
range.addEventListener('input', () => setPos(range.value));
const wipe = e => {
  const r = compare.getBoundingClientRect();
  setPos(Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100)));
};
compare.addEventListener('pointerdown', e => {
  e.preventDefault(); // stop the browser dragging the image file itself
  compare.setPointerCapture(e.pointerId);
  wipe(e);
  compare.addEventListener('pointermove', wipe);
});
compare.addEventListener('pointerup', () => compare.removeEventListener('pointermove', wipe));
compare.addEventListener('pointercancel', () => compare.removeEventListener('pointermove', wipe));

// 9. Strip: slides sideways with page scroll, back when scrolling up. Drag or swipe too. No loop.
const strip = document.querySelector('.strip');
const ticks = document.querySelectorAll('.ticks i');
const hint = document.querySelector('.hint');
let pos = 0, mine = 0; // pos: where we want it; mine: last value this script set
strip.addEventListener('scroll', () => {
  if (Math.abs(strip.scrollLeft - mine) > 2) pos = strip.scrollLeft; // the visitor swiped it themselves
  const max = strip.scrollWidth - strip.clientWidth;
  const showing = max > 0 ? Math.round(strip.scrollLeft / max * 4) : 0;
  ticks.forEach((t, i) => t.classList.toggle('on', i === showing));
  if (!calm && strip.scrollLeft > 20) hint.classList.add('gone');
}, { passive: true });
if (!calm) {
  const pin = document.querySelector('.pin');
  const inner = pin.firstElementChild;
  // progress: 0 when the pinned block first sticks, 1 when it lets go.
  const progress = () => (inner.getBoundingClientRect().top - pin.getBoundingClientRect().top) / (pin.offsetHeight - inner.offsetHeight);
  let last = progress();
  addEventListener('scroll', () => {
    const now = progress();
    const max = strip.scrollWidth - strip.clientWidth;
    pos = Math.min(max, Math.max(0, pos + (now - last) * max)); // move by the change, so swipes are kept
    last = now;
    strip.scrollLeft = pos;
    mine = strip.scrollLeft;
  }, { passive: true });
}
// Mouse drag (touch screens already swipe natively).
strip.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse') return;
  e.preventDefault();
  strip.setPointerCapture(e.pointerId);
  const drag = m => { strip.scrollLeft -= m.movementX; pos = mine = strip.scrollLeft; };
  strip.addEventListener('pointermove', drag);
  strip.addEventListener('pointerup', () => strip.removeEventListener('pointermove', drag), { once: true });
});
// Arrow keys when the strip is focused.
strip.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    strip.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * strip.clientWidth * 0.8 });
  }
});
