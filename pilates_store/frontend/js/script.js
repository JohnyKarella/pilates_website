/* ==========================================================================
   Pilates equipment — script.js (vanilla JS, no dependencies)
   Talks to the Python backend through `api()` — products, cart, wishlist,
   accounts, orders and the newsletter are all stored on the server.
   Used by every page: index.html, product.html, cart.html, terms.html.
   Each section only runs when its part of the page exists.
   Sections: Data · Product Art · Helpers · Overlays · Tabs & Forms ·
             Navigation · Mobile Menu · Scroll Animations · Hero · Ticker ·
             Collections · Product Filtering · Product Quick View · Cart ·
             Account · Checkout · Search · Bundles · Movement · Testimonials ·
             FAQ · Newsletter · Product Page · Cart Page · Image Fallback
   ========================================================================== */
(async () => {
  'use strict';

  /* ------------------------------------------------------------------------
     API — every request to the Python backend (backend/app.py) goes through here
     ------------------------------------------------------------------------ */
  // The website and the API are served by the same Python server, so paths are relative.
  // If you host the API somewhere else, set window.PILATES_API = 'https://api.example.com' before this script.
  const API_BASE = window.PILATES_API || '';

  async function api(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch(API_BASE + path, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch {
      throw Object.assign(new Error('Cannot reach the store right now. Check your connection and try again.'), { offline: true, fields: {} });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { status: res.status, fields: data.fields || {} });
    return data;
  }

  // Shown when the page is opened without the Python server running
  function serverDown() {
    const bar = document.createElement('div');
    bar.setAttribute('role', 'alert');
    bar.style.cssText = 'position:fixed;inset:auto 16px 16px;z-index:9999;max-width:560px;margin:0 auto;padding:16px 20px;border-radius:14px;background:#1F231D;color:#F7F5EE;font:15px/1.5 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.25)';
    bar.innerHTML = location.protocol === 'file:'
      ? '<strong>Start the store server to shop.</strong><br>This page was opened as a file. In the <code>backend</code> folder run <code>python app.py</code>, then open <a style="color:#C9DB7E" href="http://127.0.0.1:5000">http://127.0.0.1:5000</a>.'
      : '<strong>The store is unavailable right now.</strong><br>The server did not answer. Please refresh in a moment.';
    document.body.append(bar);
  }

  // Everything the page needs: settings, products, bundles, reviews, FAQs, the visitor's account, cart and wishlist
  let boot;
  try { boot = await api('/api/bootstrap'); } catch { serverDown(); return; }

  /* ------------------------------------------------------------------------
     Data — products, bundles, reviews and FAQs come from the database.
     Edit them in the admin dashboard (/admin) or in backend/seed_data.json.
     ------------------------------------------------------------------------ */
  const SETTINGS = boot.settings;
  const FREE_SHIPPING_AT = SETTINGS.free_shipping_at;
  const SHIPPING_FEE = SETTINGS.shipping_fee;

  // Visitors whose device asks for reduced motion get a calmer page (fades stay,
  // the ticker keeps moving, large movement is switched off). Set to false to
  // always play every animation.
  const RESPECT_REDUCED_MOTION = true;

  // Pre-booking rules (set in backend/config.py → STORE)
  const DELIVERY_WEEKS = SETTINGS.delivery_weeks;
  const BOOKING_SHARE = SETTINGS.booking_share;       // "Reserve with 10%" — the part payment taken at pre-booking
  const SOLD_OUT_BATCHES = SETTINGS.sold_out_batches; // how many earlier batches to show as "Sold out" on product pages

  /* Product fields (same as before, now served by GET /api/bootstrap)
     `photo` real product photo · `fallback` local image if an online photo cannot load ·
     `art` drawn illustration (last fallback) · `more` extra gallery photos ·
     `options` "Choose your setup" cards ({ key, name, note, price, was, best }) ·
     `was` MRP · `filter` pilates · yoga · strength · kits                     */
  const products = boot.products;
  const bundles = boot.bundles;   // sold as one item; `items` lists the product ids inside
  const reviews = boot.testimonials;
  const faqs = boot.faqs;

  const movements = [
    { id: 'strength', name: 'Strength', filter: 'strength', image: 'https://images.unsplash.com/photo-1747240549807-fc3962949818?auto=format&fit=crop&w=1000&h=1100&q=72', fallback: 'images/lifestyle/movement-strength.jpg',
      alt: 'Leg work against spring resistance on a reformer', title: 'Build strength that lasts.',
      text: 'Spring resistance loads muscles through their full range, building long, capable strength without impact.', pick: 'Sculpt Dumbbell Pair' },
    { id: 'mobility', name: 'Mobility', filter: 'yoga', image: 'https://images.unsplash.com/photo-1552196527-bffef41ef674?auto=format&fit=crop&w=1000&h=1100&q=72', fallback: 'images/lifestyle/movement-mobility.jpg',
      alt: 'Woman stretching her arms overhead', title: 'Open up, move freely.',
      text: 'Supported arcs and assisted stretches create space in the spine, hips and shoulders, one breath at a time.', pick: 'Cotton Yoga Strap' },
    { id: 'core', name: 'Core', filter: 'pilates', image: 'https://images.unsplash.com/photo-1747239202356-764770773c9a?auto=format&fit=crop&w=1000&h=1100&q=72', fallback: 'images/lifestyle/movement-core.jpg',
      alt: 'Controlled core exercise on a reformer', title: 'Find your centre.',
      text: 'Small, precise movements switch on deep stabilisers. Add a ring or band to turn up the challenge.', pick: 'Stability Ball 65 cm' },
    { id: 'balance', name: 'Balance', filter: 'pilates', image: 'https://images.unsplash.com/photo-1552196563-55cd4e45efb3?auto=format&fit=crop&w=1000&h=1100&q=72', fallback: 'images/lifestyle/movement-balance.jpg',
      alt: 'Woman holding a balancing pose', title: 'Steady, from the ground up.',
      text: 'Unstable surfaces and single-leg work train the small muscles that keep you tall, aligned and confident.', pick: 'Stability Ball 55 cm' },
    { id: 'recovery', name: 'Recovery', filter: 'yoga', image: 'https://images.unsplash.com/photo-1651786039465-d0580bb22ab7?auto=format&fit=crop&w=1000&h=1100&q=72', fallback: 'images/lifestyle/movement-recovery.jpg',
      alt: 'Person stretching on a mat', title: 'Slow down to go further.',
      text: 'Gentle mat sequences release tension and restore range, so tomorrow’s session starts from a better place.', pick: 'Pilates Foam Roller' }
  ];

  const popularSearches = ['Ball', 'Yoga', 'Dumbbell', 'Rope', 'Band', 'Kit'];

  /* ------------------------------------------------------------------------
     Product Art — product-only illustrations (no people), drawn in SVG
     ------------------------------------------------------------------------ */
  const C = { oak: '#CFA77C', oak2: '#B58C60', pad: '#A8B89A', pad2: '#8FA382', ink: '#1F231D', steel: '#C3C7BD', clay: '#C8775A', clay2: '#A85F45', lime: '#C9DB7E' };
  const shadow = (rx = 150, cy = 338) => `<ellipse class="art__shadow" cx="200" cy="${cy}" rx="${rx}" ry="13" fill="rgba(31,35,29,.13)"/>`;
  const spring = d => `<path d="${d}" stroke="${C.steel}" stroke-width="9" stroke-dasharray="2.5 4"/>`;

  const ART = {
    reformer: `${shadow(168, 338)}<g class="art__obj">
      <rect x="42" y="282" width="14" height="52" rx="5" fill="${C.oak2}"/><rect x="344" y="282" width="14" height="52" rx="5" fill="${C.oak2}"/>
      <rect x="28" y="260" width="344" height="24" rx="8" fill="${C.oak}"/><rect x="28" y="276" width="344" height="8" rx="4" fill="${C.oak2}" opacity=".55"/>
      <rect x="28" y="248" width="40" height="14" rx="5" fill="${C.ink}"/>
      <path d="M70 260 C70 186 112 186 112 260" stroke="${C.steel}" stroke-width="8" stroke-linecap="round"/>
      ${spring('M112 252 H150')}
      <rect x="150" y="234" width="150" height="28" rx="11" fill="${C.pad}"/><rect x="268" y="224" width="34" height="16" rx="7" fill="${C.pad2}"/>
      <rect x="252" y="208" width="13" height="28" rx="6" fill="${C.ink}"/>
      <rect x="340" y="168" width="9" height="94" rx="4.5" fill="${C.steel}"/><circle cx="344.5" cy="166" r="8" fill="${C.ink}"/>
      <path d="M344 166 L246 214" stroke="${C.ink}" stroke-width="2.5"/><circle cx="238" cy="218" r="9" stroke="${C.clay}" stroke-width="5"/></g>`,
    chair: `${shadow(128)}<g class="art__obj">
      <rect x="150" y="186" width="156" height="146" rx="14" fill="${C.oak}"/><rect x="150" y="296" width="156" height="36" rx="14" fill="${C.oak2}" opacity=".5"/>
      <rect x="140" y="162" width="176" height="32" rx="13" fill="${C.pad}"/>
      ${spring('M160 228 L112 266')}
      <path d="M152 306 L96 284" stroke="${C.steel}" stroke-width="8" stroke-linecap="round"/>
      <rect x="56" y="262" width="78" height="20" rx="10" fill="${C.ink}" transform="rotate(-10 95 272)"/>
      <path d="M176 162 V100 Q176 86 190 86 H204" stroke="${C.steel}" stroke-width="7" stroke-linecap="round"/>
      <path d="M280 162 V100 Q280 86 266 86 H252" stroke="${C.steel}" stroke-width="7" stroke-linecap="round"/>
      <path d="M192 86 H206 M250 86 H264" stroke="${C.ink}" stroke-width="10" stroke-linecap="round"/></g>`,
    barrel: `${shadow(152)}<g class="art__obj">
      <rect x="62" y="294" width="276" height="38" rx="12" fill="${C.oak}"/><rect x="62" y="316" width="276" height="16" rx="8" fill="${C.oak2}" opacity=".5"/>
      <path d="M150 296 C150 186 316 186 316 296 Z" fill="${C.pad}"/>
      <path d="M170 296 C170 208 296 208 296 296" stroke="rgba(31,35,29,.14)" stroke-width="2.5"/>
      <rect x="76" y="262" width="92" height="36" rx="12" fill="${C.pad2}"/>
      <rect x="96" y="308" width="44" height="9" rx="4.5" fill="${C.ink}" opacity=".7"/></g>`,
    ring: `${shadow(104, 352)}<g class="art__obj">
      <circle cx="222" cy="206" r="118" stroke="${C.clay}" stroke-width="11" opacity=".4"/>
      <circle cx="194" cy="196" r="122" stroke="${C.ink}" stroke-width="13"/>
      <path d="M108 110 A122 122 0 0 1 250 88" stroke="rgba(255,255,255,.4)" stroke-width="3" stroke-linecap="round"/>
      <rect x="56" y="162" width="34" height="68" rx="16" fill="${C.pad}"/><rect x="298" y="162" width="34" height="68" rx="16" fill="${C.pad}"/>
      <rect x="84" y="174" width="12" height="44" rx="6" fill="${C.pad2}"/><rect x="292" y="174" width="12" height="44" rx="6" fill="${C.pad2}"/></g>`,
    mat: `${shadow(164, 350)}<g class="art__obj">
      <path d="M56 300 L236 236 L352 276 L172 344 Z" fill="${C.pad}" stroke="${C.pad}" stroke-width="14" stroke-linejoin="round"/>
      <path d="M96 300 L262 242 M130 314 L296 256 M164 328 L330 270" stroke="rgba(255,255,255,.3)" stroke-width="2"/>
      <g transform="rotate(-14 200 170)">
        <rect x="96" y="134" width="216" height="72" rx="36" fill="${C.pad2}"/>
        <rect x="150" y="134" width="12" height="72" fill="${C.ink}"/><rect x="232" y="134" width="12" height="72" fill="${C.ink}"/>
        <circle cx="276" cy="170" r="36" fill="${C.pad}"/>
        <circle cx="276" cy="170" r="24" stroke="rgba(31,35,29,.22)" stroke-width="2.5"/><circle cx="276" cy="170" r="12" stroke="rgba(31,35,29,.22)" stroke-width="2.5"/>
      </g></g>`,
    bands: `${shadow(138, 352)}<g class="art__obj">
      <ellipse cx="170" cy="186" rx="84" ry="124" transform="rotate(-22 170 186)" stroke="${C.pad}" stroke-width="30"/>
      <ellipse cx="232" cy="198" rx="84" ry="124" transform="rotate(18 232 198)" stroke="${C.clay}" stroke-width="30"/>
      <ellipse cx="200" cy="250" rx="128" ry="62" stroke="${C.lime}" stroke-width="30"/>
      <ellipse cx="200" cy="250" rx="128" ry="62" stroke="rgba(31,35,29,.2)" stroke-width="1.5" stroke-dasharray="5 6"/>
      <ellipse cx="232" cy="198" rx="84" ry="124" transform="rotate(18 232 198)" stroke="rgba(255,255,255,.35)" stroke-width="1.5" stroke-dasharray="5 6"/></g>`,
    tower: `${shadow(164)}<g class="art__obj">
      <rect x="48" y="300" width="304" height="30" rx="10" fill="${C.oak}"/><rect x="48" y="318" width="304" height="12" rx="6" fill="${C.oak2}" opacity=".5"/>
      <rect x="60" y="284" width="230" height="18" rx="9" fill="${C.pad}"/>
      <rect x="296" y="60" width="11" height="242" rx="5.5" fill="${C.steel}"/><rect x="328" y="60" width="11" height="242" rx="5.5" fill="${C.steel}"/>
      <rect x="288" y="52" width="60" height="12" rx="6" fill="${C.ink}"/><rect x="288" y="150" width="60" height="9" rx="4.5" fill="${C.ink}" opacity=".8"/>
      <path d="M300 154 L196 154" stroke="${C.steel}" stroke-width="8" stroke-linecap="round"/><path d="M196 134 V174" stroke="${C.ink}" stroke-width="10" stroke-linecap="round"/>
      ${spring('M312 66 L238 122')}<circle cx="230" cy="128" r="11" stroke="${C.clay}" stroke-width="5"/>
      ${spring('M312 98 L152 236')}<ellipse cx="141" cy="244" rx="13" ry="9" stroke="${C.ink}" stroke-width="5"/></g>`,
    dumbbells: `${shadow(142, 350)}<g class="art__obj">
      <g transform="rotate(-16 200 150)"><rect x="150" y="138" width="100" height="24" rx="9" fill="${C.clay2}"/>
        <rect x="104" y="112" width="52" height="76" rx="14" fill="${C.clay}"/><rect x="244" y="112" width="52" height="76" rx="14" fill="${C.clay}"/>
        <path d="M116 126 V174 M256 126 V174" stroke="rgba(255,255,255,.3)" stroke-width="3" stroke-linecap="round"/></g>
      <g transform="rotate(10 200 262)"><rect x="150" y="250" width="100" height="24" rx="9" fill="${C.pad2}"/>
        <rect x="104" y="224" width="52" height="76" rx="14" fill="${C.pad}"/><rect x="244" y="224" width="52" height="76" rx="14" fill="${C.pad}"/>
        <path d="M116 238 V286 M256 238 V286" stroke="rgba(255,255,255,.35)" stroke-width="3" stroke-linecap="round"/></g></g>`
  };

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const catalog = [...products, ...bundles];
  const byId = id => catalog.find(p => p.id === id);
  const money = n => '\u20B9' + n.toLocaleString('en-IN');

  // Delivery window for an order placed today, e.g. "29 Oct – 5 Nov"
  // (the open batch's dates come from the server so every visitor sees the same window)
  const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const shortDate = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const deliveryWindow = () =>
    `${shortDate(fromISO(SETTINGS.open_batch.start))} \u2013 ${shortDate(fromISO(SETTINGS.open_batch.end))}`;
  const depositFor = total => Math.ceil(total * BOOKING_SHARE);
  const longDate = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const productUrl = id => `product.html?id=${encodeURIComponent(id)}`;

  // Pre-order batches. The open batch is named after the month its delivery starts;
  // the batch(es) before it are shown as sold out.
  const batches = (() => {
    const start = fromISO(SETTINGS.open_batch.start), end = fromISO(SETTINGS.open_batch.end);
    const month = d => d.toLocaleDateString('en-IN', { month: 'long' });
    const list = [];
    for (let i = SOLD_OUT_BATCHES; i >= 1; i--) list.push({ name: `${month(new Date(start.getFullYear(), start.getMonth() - i, 1))} batch`, soldOut: true });
    list.push({ name: SETTINGS.open_batch.name, soldOut: false, window: `${shortDate(start)} \u2013 ${longDate(end)}` });
    return list;
  })();
  const openBatch = batches[batches.length - 1];
  bundles.forEach(b => {
    b.was = b.items.reduce((sum, id) => sum + byId(id).price, 0);
    b.specs = b.items.map(id => byId(id).name);
    b.badge = `Save ${money(b.was - b.price)}`;
  });
  // "Choose your setup" options for a product \u2014 priced by the server (product_options table)
  const optionCache = new Map();
  function optionsOf(item) {
    if (optionCache.has(item.id)) return optionCache.get(item.id);
    const list = (item.options || []).map(o => ({ ...o }));
    if (!list.length) list.push({ key: 'single', name: 'Single', note: (item.specs || [])[0] || '', price: item.price, was: item.was });
    list.forEach(o => { o.was = Math.max(o.was || 0, o.price); o.off = Math.round((1 - o.price / o.was) * 100); });
    optionCache.set(item.id, list);
    return list;
  }

  // Photos for the product page gallery
  function galleryOf(item) {
    if (item.items) return item.items.map(id => { const p = byId(id); return { id: p.id, src: p.photo, fallback: p.fallback, cut: p.cut, tone: p.tone, alt: p.name }; });
    const list = [{ src: item.photo, fallback: item.fallback, cut: item.cut, alt: item.name }];
    if (item.hover) list.push({ src: item.hover, cut: item.cut, alt: `${item.name}, another view` });
    (item.more || []).forEach(m => list.push({ alt: `${item.name}, view ${list.length + 1}`, ...m }));
    return list.map(g => ({ tone: item.tone, ...g }));
  }

  // A cart line is stored as "productId|optionKey"
  function lineInfo(key) {
    const [id, optKey] = String(key).split('|');
    const item = byId(id);
    if (!item) return null;
    const opts = optionsOf(item);
    const opt = opts.find(o => o.key === optKey) || opts[0];
    return { key: `${item.id}|${opt.key}`, item, opt, price: opt.price, was: opt.was, label: opts.length > 1 ? opt.name : '' };
  }

  const shippingFor = total => (total >= FREE_SHIPPING_AT || total === 0 ? 0 : SHIPPING_FEE);
  const reduceMotion = RESPECT_REDUCED_MOTION && matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.toggle('calm', reduceMotion);
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
  const initials = name => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const store = {
    get(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } }
  };

  // Drawn illustration of a product (last-resort fallback for a missing photo)
  const drawing = item => `<svg class="raw" viewBox="0 0 400 400">${ART[item.art]}</svg>`;
  const photoTag = (item, alt = '', src = item.photo) => `<img loading="lazy" decoding="async" width="900" height="1125" src="${src}"
    ${item.fallback && src === item.photo ? `data-fallback="${item.fallback}" ` : ''}data-art="${item.id}" alt="${esc(alt)}">`;

  // Product visual: its photo; bundles show a small stack of their items' photos
  function artOf(item, label = true) {
    if (item.items) {
      return `<span class="art art--stack" style="--tone:${item.tone}"${label ? ` role="img" aria-label="${esc(item.name)}"` : ' aria-hidden="true"'}>
        ${item.items.map(id => `<span class="art__tile${byId(id).cut ? ' is-cut' : ''}" style="--tone:${byId(id).tone}">${photoTag(byId(id))}</span>`).join('')}</span>`;
    }
    const hover = label && item.hover && canHover ? photoTag(item, '', item.hover).replace('<img ', '<img class="art__hover" ') : '';
    return `<span class="art art--photo${item.cut ? ' art--cut' : ''}" style="--tone:${item.tone}">${photoTag(item, label ? item.name : '')}${hover}</span>`;
  }

  // Horizontally centre an item inside its scroll strip without moving the page
  function centerInStrip(strip, el) {
    if (strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: el.offsetLeft - strip.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
  }

  // Show the live delivery window wherever the page mentions it
  $$('[data-delivery]').forEach(el => { el.textContent = deliveryWindow(); });

  // One rAF-throttled scroll loop shared by every scroll-driven effect
  const frameJobs = [];
  let frameQueued = false;
  function queueFrame() {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(() => { frameQueued = false; frameJobs.forEach(job => job()); });
  }
  window.addEventListener('scroll', queueFrame, { passive: true });
  window.addEventListener('resize', queueFrame, { passive: true });

  /* ------------------------------------------------------------------------
     Overlays — one manager for menu, search, quick view, cart, account, checkout
     ------------------------------------------------------------------------ */
  const Overlay = (() => {
    const root = document.documentElement;
    const backdrop = $('#backdrop');
    const burger = $('.burger');
    const onOpen = {};
    let active = null, returnFocus = null;

    function open(id) {
      const el = document.getElementById(id);
      if (!el || el === active) return;
      if (active) hide(active); else returnFocus = document.activeElement;
      active = el;
      root.style.setProperty('--sbw', `${window.innerWidth - root.clientWidth}px`);
      root.classList.add('is-locked');
      el.inert = false;
      el.classList.add('is-open');
      el.scrollTop = 0;
      backdrop.classList.add('is-open');
      if (id === 'menu') burger.setAttribute('aria-expanded', 'true');
      onOpen[id]?.();
      const target = $('[data-autofocus]', el) || el;
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
    function hide(el) {
      el.classList.remove('is-open');
      el.inert = true;
      if (el.id === 'menu') burger.setAttribute('aria-expanded', 'false');
    }
    function close({ restoreFocus = true } = {}) {
      if (!active) return;
      hide(active);
      active = null;
      backdrop.classList.remove('is-open');
      root.classList.remove('is-locked');
      if (restoreFocus && returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    }

    backdrop.addEventListener('click', () => close());
    document.addEventListener('keydown', e => {
      if (!active) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const focusable = $$('a[href], button:not([disabled]), input, select, summary, [tabindex]:not([tabindex="-1"])', active)
        .filter(n => n.offsetParent !== null && !n.closest('[inert]'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === active)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // Declarative triggers: [data-open="id"] and [data-close]
    document.addEventListener('click', e => {
      const opener = e.target.closest('[data-open]');
      if (opener) { open(opener.dataset.open); return; }
      const closer = e.target.closest('[data-close]');
      if (closer) {
        const goto = closer.dataset.goto;
        close({ restoreFocus: !goto });
        if (goto) {
          const target = $(goto);
          if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
          else location.href = `index.html${goto}`;
        }
      }
    });

    return { open, close, onOpen, get active() { return active; } };
  })();

  /* ------------------------------------------------------------------------
     Tabs & Forms — shared by the account popup and the checkout
     ------------------------------------------------------------------------ */
  function initTabs(root) {
    const list = $('.tabs__list', root);
    const tabs = $$('[role="tab"]', list);
    const views = $$('.tabs__view', root);
    const box = $('.tabs__views', root);

    // Animate the container to the height of the visible view
    function fit() {
      const current = views.find(v => v.classList.contains('is-active'));
      if (current && current.offsetHeight) box.style.height = `${current.offsetHeight}px`;
    }
    function show(name, focus = false) {
      tabs.forEach((tab, i) => {
        const on = tab.dataset.tab === name;
        tab.setAttribute('aria-selected', on);
        tab.tabIndex = on ? 0 : -1;
        if (on) { list.dataset.active = i; if (focus) tab.focus(); }
      });
      views.forEach(view => {
        const on = view.dataset.view === name;
        view.classList.toggle('is-active', on);
        view.inert = !on;
      });
      fit();
    }
    list.addEventListener('click', e => { const tab = e.target.closest('[role="tab"]'); if (tab) show(tab.dataset.tab); });
    list.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const i = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
      show(tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length].dataset.tab, true);
    });
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(fit); views.forEach(v => ro.observe(v)); }
    return { show, fit };
  }

  // Validates every field in a form, shows inline messages, focuses the first problem
  function validate(form) {
    let firstBad = null;
    $$('input, select', form).forEach(field => {
      if (field.type === 'radio') return;
      const value = field.type === 'checkbox' ? field.checked : field.value.trim();
      let message = '';
      if (field.required && !value) message = field.type === 'checkbox' ? 'Please tick this box to continue.' : 'This field is required.';
      else if (value && field.type === 'email' && !EMAIL.test(value)) message = 'Enter a valid email address.';
      else if (value && field.dataset.rule === 'phone' && !/^\+?[\d\s()-]{7,17}$/.test(value)) message = 'Enter a valid phone number.';
      else if (value && field.dataset.rule === 'zip' && !/^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/.test(value)) message = 'Enter a valid PIN / ZIP code.';
      else if (value && field.minLength > 0 && value.length < field.minLength) message = `Use at least ${field.minLength} characters.`;
      setError(field, message);
      if (message && !firstBad) firstBad = field;
    });
    firstBad?.focus();
    return !firstBad;
  }
  function setError(field, message) {
    field.setAttribute('aria-invalid', Boolean(message));
    const err = $('.f__err', field.closest('.f, .check') || document.createElement('i'));
    if (err) err.textContent = message;
  }
  // Clear a field's error as soon as the customer edits it
  document.addEventListener('input', e => {
    if (e.target.matches('.f input, .f select, .check input') && e.target.getAttribute('aria-invalid') === 'true') setError(e.target, '');
  });
  const formData = form => Object.fromEntries(new FormData(form));

  /* ------------------------------------------------------------------------
     Navigation — sticky header state, rails, keyboard shortcut
     ------------------------------------------------------------------------ */
  (() => {
    const header = $('#header');
    new IntersectionObserver(([entry]) => header.classList.toggle('is-scrolled', !entry.isIntersecting)).observe($('.announce'));

    // Scroll progress on the right-hand rail
    const bar = $('#rail-bar'), pct = $('#rail-pct');
    if (bar) frameJobs.push(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? clamp(window.scrollY / max) : 0;
      bar.style.transform = `scaleY(${p})`;
      pct.textContent = String(Math.round(p * 100)).padStart(2, '0');
    });

    document.addEventListener('keydown', e => {
      if (e.key === '/' && !Overlay.active && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        Overlay.open('search');
      }
    });
  })();

  /* ------------------------------------------------------------------------
     Mobile Menu — links close the drawer, then the page scrolls to the section
     ------------------------------------------------------------------------ */
  matchMedia('(min-width: 900px)').addEventListener('change', e => {
    if (e.matches && Overlay.active?.id === 'menu') Overlay.close({ restoreFocus: false });
  });
  $$('#menu a[href^="#"]').forEach(link => link.addEventListener('click', () => Overlay.close({ restoreFocus: false })));

  /* ------------------------------------------------------------------------
     Scroll Animations — reveal on enter, count-up numbers, scroll-linked motion
     ------------------------------------------------------------------------ */
  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          obs.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 })
    : null;
  function watchReveal(nodes) {
    nodes.forEach(n => (revealObserver ? revealObserver.observe(n) : n.classList.add('is-in')));
  }
  watchReveal($$('[data-reveal], [data-lines]'));

  // Count numbers up the first time they are seen
  (() => {
    const nodes = $$('[data-count]');
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        const el = entry.target, end = Number(el.dataset.count), decimals = Number(el.dataset.decimals || 0);
        const start = performance.now(), duration = 1400;
        (function tick(now) {
          const t = clamp((now - start) / duration);
          el.textContent = (end * (1 - Math.pow(1 - t, 3))).toFixed(decimals);
          if (t < 1) requestAnimationFrame(tick);
        })(start);
      });
    }, { threshold: 0.6 });
    nodes.forEach(n => obs.observe(n));
  })();

  // Scroll-linked progress: sets --p (0 → 1) while a [data-scrub] element enters the viewport
  (() => {
    const nodes = $$('[data-scrub]');
    if (reduceMotion) { nodes.forEach(n => n.style.setProperty('--p', 1)); return; }
    frameJobs.push(() => {
      const vh = window.innerHeight;
      nodes.forEach(n => {
        const rect = n.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        n.style.setProperty('--p', clamp((vh - rect.top) / (vh * 0.9)).toFixed(3));
      });
    });
  })();

  /* ------------------------------------------------------------------------
     Hero — pointer parallax on the floating elements + product chip
     ------------------------------------------------------------------------ */
  (() => {
    const visual = $('#hero-visual');
    $$('.hero__product-art[data-art]').forEach(slot => { slot.innerHTML = artOf(byId(slot.dataset.art), false); });
    if (!visual || !canHover || reduceMotion) return;
    const hero = $('.hero');
    hero.addEventListener('pointermove', e => {
      const rect = hero.getBoundingClientRect();
      visual.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width - 0.5).toFixed(3));
      visual.style.setProperty('--my', ((e.clientY - rect.top) / rect.height - 0.5).toFixed(3));
    });
    hero.addEventListener('pointerleave', () => { visual.style.setProperty('--mx', 0); visual.style.setProperty('--my', 0); });
  })();

  /* ------------------------------------------------------------------------
     Ticker — seamless loop at the same reading speed on every screen
     ------------------------------------------------------------------------ */
  (() => {
    const track = $('#ticker');
    if (!track) return;
    const SPEED = 70; // pixels per second
    const set = track.innerHTML;
    function build() {
      track.innerHTML = set;
      const single = track.scrollWidth;
      if (!single) return;
      const copies = Math.max(2, Math.ceil((window.innerWidth * 2) / single) + 1);
      track.innerHTML = set.repeat(copies);
      track.style.setProperty('--shift', `${-single}px`);
      track.style.animationDuration = `${single / SPEED}s`;
    }
    build();
    document.fonts?.ready.then(build);
    let last = window.innerWidth;
    window.addEventListener('resize', () => { if (window.innerWidth !== last) { last = window.innerWidth; build(); } }, { passive: true });
  })();

  /* ------------------------------------------------------------------------
     Collections — expanding panels that auto-cycle until the visitor takes over
     ------------------------------------------------------------------------ */
  (() => {
    const wrap = $('#panels');
    if (!wrap) return;
    const panels = $$('.pan', wrap);
    const DELAY = 5000;
    let index = 0, timer = null, auto = !reduceMotion;

    function activate(i) {
      index = i;
      panels.forEach((p, n) => {
        const on = n === i;
        p.classList.toggle('is-active', on);
        $('.pan__hit', p).setAttribute('aria-expanded', on);
        $('.pan__body', p).inert = !on;
      });
    }
    function stop() { auto = false; clearInterval(timer); timer = null; wrap.classList.remove('is-auto'); }
    function play() {
      if (!auto || timer) return;
      wrap.classList.add('is-auto');
      timer = setInterval(() => activate((index + 1) % panels.length), DELAY);
    }
    function pause() { clearInterval(timer); timer = null; wrap.classList.remove('is-auto'); }

    panels.forEach((p, i) => {
      $('.pan__hit', p).addEventListener('click', () => { stop(); activate(i); });
      if (canHover) p.addEventListener('mouseenter', () => { stop(); activate(i); });
    });
    wrap.style.setProperty('--delay', `${DELAY}ms`);
    activate(0);
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : pause()), { threshold: 0.35 }).observe(wrap);
  })();

  /* ------------------------------------------------------------------------
     Product grid + Product Filtering + sorting
     ------------------------------------------------------------------------ */
  const grid = $('#product-grid');
  let wishlist = new Set(boot.wishlist.filter(byId));   // saved in the database (wishlist_items)

  const priceHtml = p => `<span class="price">${money(p.price)}${p.was ? `<s>${money(p.was)}</s>` : ''}</span>`;

  function cardTemplate(p, i) {
    const saved = wishlist.has(p.id);
    return `
      <article class="card" data-reveal="zoom" data-id="${p.id}" data-filter="${p.filter}" style="--d:${(i % 4) * 70}ms">
        <div class="card__media">
          <a class="card__open" href="${productUrl(p.id)}" aria-label="${esc(p.name)}: view details and options">${artOf(p)}</a>
          ${p.stock === 0 ? '<span class="badge">Sold out</span>' : p.badge || p.was ? `<span class="badge${p.was ? ' badge--sale' : ''}">${p.was ? `Save ${Math.round((1 - p.price / p.was) * 100)}%` : esc(p.badge)}</span>` : ''}
          <button class="card__wish${saved ? ' is-saved' : ''}" type="button" data-wish="${p.id}"
            aria-pressed="${saved}" aria-label="Save ${esc(p.name)} to wishlist">${icon('heart')}</button>
          <button class="card__add" type="button" data-add="${p.id}" aria-label="Pre-book ${esc(p.name)}"${p.stock === 0 ? ' disabled' : ''}><span>${p.stock === 0 ? 'Sold out' : 'Pre-book'}</span>${icon('plus')}</button>
        </div>
        <div class="card__info">
          <p class="card__cat">${esc(p.category)}</p>
          <h3 class="card__name"><a href="${productUrl(p.id)}">${esc(p.name)}</a></h3>
          <div class="card__row">
            ${priceHtml(p)}
            <span class="card__rating" aria-label="Rated ${p.rating} out of 5">${icon('star')}${p.rating}<small>(${p.reviews})</small></span>
          </div>
          <p class="card__eta">${icon('truck')}Delivered in 3\u20134 weeks</p>
        </div>
      </article>`;
  }

  if (grid) {
    grid.innerHTML = products.map(cardTemplate).join('');
    watchReveal($$('.card', grid));
  }

  function applyFilter(filter) {
    if (!grid) return;
    let shown = 0;
    $$('.card', grid).forEach(card => {
      const match = filter === 'all' || card.dataset.filter === filter;
      card.hidden = !match;
      if (!match) return;
      card.style.setProperty('--i', shown++);
      card.classList.add('is-in');
      card.classList.remove('is-enter');
      void card.offsetWidth; // restart the entrance animation
      card.classList.add('is-enter');
    });
    $$('#filters .chip').forEach(chip => {
      const on = chip.dataset.filter === filter;
      chip.classList.toggle('is-active', on);
      chip.setAttribute('aria-pressed', on);
      if (on) centerInStrip($('#filters'), chip);
    });
    $('#filter-status').textContent = `${shown} product${shown === 1 ? '' : 's'} shown`;
  }

  $('#filters')?.addEventListener('click', e => { const chip = e.target.closest('.chip'); if (chip) applyFilter(chip.dataset.filter); });
  document.addEventListener('click', e => { const link = e.target.closest('[data-filter-link]'); if (link) applyFilter(link.dataset.filterLink); });

  $('#sort')?.addEventListener('change', e => {
    const sorters = { low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews };
    const order = e.target.value in sorters ? [...products].sort(sorters[e.target.value]) : products;
    order.forEach((p, i) => {
      const card = $(`.card[data-id="${p.id}"]`, grid);
      card.style.setProperty('--i', i);
      card.classList.add('is-in');
      card.classList.remove('is-enter');
      grid.append(card);
      void card.offsetWidth;
      card.classList.add('is-enter');
    });
  });

  // Wishlist + add-to-cart buttons anywhere on the page
  document.addEventListener('click', e => {
    const wish = e.target.closest('[data-wish]');
    if (wish) { toggleWish(wish); return; }
    const add = e.target.closest('[data-add]');
    if (add) Cart.add(add.dataset.add, 1);
  });

  // Heart buttons reflect the wishlist (also after signing in or out)
  function syncWishButtons() {
    $$('[data-wish]').forEach(btn => {
      const on = wishlist.has(btn.dataset.wish);
      btn.classList.toggle('is-saved', on);
      btn.setAttribute('aria-pressed', on);
    });
  }
  function setWishlist(ids) { wishlist = new Set((ids || []).filter(byId)); syncWishButtons(); }

  async function toggleWish(btn) {
    const id = btn.dataset.wish;
    const saved = !wishlist.has(id);
    saved ? wishlist.add(id) : wishlist.delete(id);   // update the heart straight away…
    syncWishButtons();
    toast(saved ? `${byId(id).name} saved to wishlist` : 'Removed from wishlist');
    try {                                             // …then save it on the server
      const data = await api(`/api/wishlist/${encodeURIComponent(id)}`, { method: saved ? 'PUT' : 'DELETE' });
      setWishlist(data.items);
    } catch (err) {
      saved ? wishlist.delete(id) : wishlist.add(id);
      syncWishButtons();
      toast(err.message);
    }
  }

  /* ------------------------------------------------------------------------
     Product Quick View
     ------------------------------------------------------------------------ */
  (() => {
    let current = null, qty = 1;
    const qtyEl = $('#quick-qty');
    const setQty = n => { qty = clamp(n, 1, 10); qtyEl.textContent = qty; };

    function open(id) {
      const p = byId(id);
      if (!p) return;
      current = p;
      setQty(1);
      $('#quick-media').innerHTML = artOf(p);
      $('#quick-cat').textContent = p.category;
      $('#quick-name').textContent = p.name;
      $('#quick-price').innerHTML = priceHtml(p);
      $('#quick-desc').textContent = p.description;
      $('#quick-rating').innerHTML = `${icon('star')}<strong>${p.rating}</strong> · ${p.reviews} reviews`;
      $('#quick-specs').innerHTML = p.specs.map(s => `<li>${esc(s)}</li>`).join('');
      $('#quick-more').href = productUrl(p.id);
      Overlay.open('quick');
    }

    $('#quick-minus').addEventListener('click', () => setQty(qty - 1));
    $('#quick-plus').addEventListener('click', () => setQty(qty + 1));
    $('#quick-add').addEventListener('click', () => { if (current) Cart.add(current.id, qty); });
    document.addEventListener('click', e => { const t = e.target.closest('[data-quick]'); if (t) open(t.dataset.quick); });
  })();

  /* ------------------------------------------------------------------------
     Cart — shown instantly in the browser and saved on the server (PUT /api/cart)
     ------------------------------------------------------------------------ */
  const Cart = (() => {
    const itemsEl = $('#cart-items');
    const listeners = [];
    const items = new Map();
    const MAX = SETTINGS.max_qty;
    // Load lines sent by the server ([{ id, option, qty }]) into the cart
    function load(list) {
      items.clear();
      (list || []).forEach(({ id, option, qty: q }) => {
        const line = lineInfo(`${id}|${option}`);
        if (line && q > 0) items.set(line.key, Math.min(MAX, (items.get(line.key) || 0) + q));
      });
    }
    load(boot.cart);
    const payload = () => [...items].map(([key, q]) => { const [id, option] = key.split('|'); return { id, option, qty: q }; });

    // Saves run one after another. Only the newest answer is applied, so fast clicks never jump back.
    let version = 0, saving = Promise.resolve();
    function save() {
      const v = ++version, body = { items: payload() };
      saving = saving
        .then(() => api('/api/cart', { method: 'PUT', body }))
        .then(data => { if (v === version) { load(data.items); render(); } })
        .catch(err => toast(err.offline ? err.message : `Your cart could not be saved: ${err.message}`));
      return saving;
    }
    let plan = store.get('pe-plan', 'deposit') === 'full' ? 'full' : 'deposit';
    let note = store.get('pe-note', '');

    const count = () => [...items.values()].reduce((a, b) => a + b, 0);
    const lines = () => [...items].map(([key, qty]) => ({ ...lineInfo(key), qty }));
    const subtotal = () => lines().reduce((sum, l) => sum + l.price * l.qty, 0);

    // Every figure the cart page and the checkout show
    function totals() {
      const all = lines();
      const sub = all.reduce((sum, l) => sum + l.price * l.qty, 0);
      const mrp = all.reduce((sum, l) => sum + l.was * l.qty, 0);
      const shipping = shippingFor(sub), total = sub + shipping;
      const due = plan === 'full' ? total : depositFor(total);
      return { n: count(), mrp, discount: mrp - sub, subtotal: sub, shipping, total, deposit: depositFor(total), due, balance: total - due, plan };
    }

    function render() {
      const n = count(), total = subtotal();
      $$('[data-cart-count]').forEach(el => { el.textContent = n; el.hidden = n === 0; });
      $('#cart-total-count').textContent = `(${n})`;
      $('#cart-subtotal').textContent = money(total);
      $('#cart-deposit').textContent = money(depositFor(total + shippingFor(total)));
      $('#cart-empty').hidden = n > 0;
      $('#cart-foot').hidden = n === 0;
      $('.cart__ship').hidden = n === 0;

      const left = FREE_SHIPPING_AT - total;
      $('#ship-text').innerHTML = left > 0
        ? `You’re <strong>${money(left)}</strong> away from free shipping`
        : 'You’ve unlocked <strong>free shipping</strong>';
      $('#ship-bar').style.transform = `scaleX(${clamp(total / FREE_SHIPPING_AT)})`;

      itemsEl.innerHTML = lines().map(({ key, item: p, label, price, was, qty: q }) => `
        <li class="citem" data-key="${esc(key)}">
          <a class="citem__thumb" href="${productUrl(p.id)}" tabindex="-1" aria-hidden="true">${artOf(p, false)}</a>
          <div class="citem__info">
            <p class="citem__name"><a href="${productUrl(p.id)}">${esc(p.name)}</a></p>
            <p class="citem__cat">${esc(label || p.category)}</p>
            <div class="qty qty--sm" role="group" aria-label="Quantity for ${esc(p.name)}">
              <button type="button" data-step="-1" aria-label="Decrease quantity">${icon('minus')}</button>
              <output>${q}</output>
              <button type="button" data-step="1" aria-label="Increase quantity">${icon('plus')}</button>
            </div>
          </div>
          <div class="citem__end"><strong>${money(price * q)}${was > price ? `<s>${money(was * q)}</s>` : ''}</strong><button type="button" class="link" data-remove>Remove</button></div>
        </li>`).join('');

      listeners.forEach(fn => fn());
    }
    // Something changed in the cart: show it, then save it
    function changed() { render(); return save(); }

    function add(id, qty = 1, optKey = '', { open = true } = {}) {
      const line = lineInfo(optKey ? `${id}|${optKey}` : id);
      if (!line) return false;
      // Stock (inventory) comes from the products table. The server checks it again at checkout.
      const item = byId(id);
      if (item && typeof item.stock === 'number') {
        let inCart = 0;
        items.forEach((q, k) => { if (k.split('|')[0] === id) inCart += q; });
        const room = item.stock - inCart;
        if (room <= 0) {
          toast(item.stock > 0 ? `Only ${item.stock} of ${item.name} left, and they're all in your cart.` : `${item.name} is sold out.`);
          return false;
        }
        if (qty > room) { qty = room; toast(`Only ${item.stock} of ${item.name} left.`); }
      }
      items.set(line.key, Math.min(MAX, (items.get(line.key) || 0) + qty));
      const done = changed();
      $$('[data-cart-count]').forEach(el => { el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump'); });
      if (open) Overlay.open('cart');
      return done;
    }
    function setQty(key, qty) {
      if (!items.has(key)) return;
      qty <= 0 ? items.delete(key) : items.set(key, Math.min(MAX, qty));
      changed();
    }
    // Replace the whole cart with what the server says (after sign-in, sign-out or an order)
    function replace(list) { version++; load(list); render(); }
    function setPlan(value) {
      plan = value === 'full' ? 'full' : 'deposit';
      store.set('pe-plan', plan);
      render();
    }
    function setNote(text) { note = text; store.set('pe-note', note); }

    itemsEl.addEventListener('click', e => {
      const row = e.target.closest('.citem');
      if (!row) return;
      const key = row.dataset.key;
      const step = e.target.closest('[data-step]');
      if (step) {
        setQty(key, items.get(key) + Number(step.dataset.step));
        ($(`.citem[data-key="${CSS.escape(key)}"] [data-step="${step.dataset.step}"]`) || $('#cart')).focus();
      } else if (e.target.closest('[data-remove]')) {
        setQty(key, 0);
        $('#cart').focus();
      }
    });

    render();
    return {
      add, setQty, replace, payload, count, subtotal, lines, totals, setPlan, setNote,
      saved: () => saving,
      qtyOf: key => items.get(key) || 0,
      onChange: fn => { listeners.push(fn); fn(); },
      get plan() { return plan; }, get note() { return note; }
    };
  })();

  /* ------------------------------------------------------------------------
     Server forms — shared helpers: busy state and showing the server's messages
     ------------------------------------------------------------------------ */
  // Runs `request` while the form's submit button shows it is busy. Returns null on failure.
  async function sendForm(form, request) {
    const btn = $('button[type="submit"]', form);
    if (btn) btn.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try {
      return await request();
    } catch (err) {
      showServerErrors(form, err);
      return null;
    } finally {
      if (btn) btn.disabled = false;
      form.removeAttribute('aria-busy');
    }
  }
  // The server answers {"error": "...", "fields": {"email": "..."}} — show each message under its field
  function showServerErrors(form, err) {
    let first = null;
    Object.entries(err.fields || {}).forEach(([name, message]) => {
      const field = form.elements[name];
      if (!(field instanceof Element)) return;
      setError(field, message);
      first = first || field;
    });
    first ? first.focus() : toast(err.message);
  }

  /* ------------------------------------------------------------------------
     Account — sign in / sign up / sign out, and the customer's pre-bookings
     (POST /api/auth/signup · /login · /logout · /forgot, GET /api/orders)
     ------------------------------------------------------------------------ */
  const STATUS = {
    booked: 'Booked', in_production: 'In production', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled'
  };
  const PAYMENT = { part_paid: 'Part paid', paid: 'Paid in full', refund_due: 'Refund due', refunded: 'Refunded' };
  const CANCELLABLE = ['booked', 'in_production'];

  const Account = (() => {
    const tabs = initTabs($('#auth-tabs'));
    const listeners = [];
    let user = boot.user;

    function render() {
      const signedIn = Boolean(user);
      $('#auth-guest').hidden = signedIn;
      $('#auth-user').hidden = !signedIn;
      $$('.acct-dot').forEach(dot => { dot.hidden = !signedIn; });
      $('#menu-acct-title').textContent = signedIn ? `Hi, ${user.name.split(' ')[0]}` : 'Sign in';
      $('#menu-acct-sub').textContent = signedIn ? user.email : 'or create an account';
      $('#menu-avatar').innerHTML = signedIn ? esc(initials(user.name)) : icon('user');
      if (signedIn) {
        $('#auth-avatar').textContent = initials(user.name);
        $('#auth-name').textContent = user.name;
        $('#auth-email').textContent = user.email;
      }
      listeners.forEach(fn => fn(user));
    }

    // The server sends { user, cart, wishlist } after sign-in, sign-up and sign-out
    function apply(data) {
      user = data.user;
      Cart.replace(data.cart);
      setWishlist(data.wishlist);
      render();
    }

    async function signIn(form, { email, password, remember }) {
      const data = await sendForm(form, () => api('/api/auth/login', {
        method: 'POST', body: { email: email.trim(), password, remember: remember !== undefined ? Boolean(remember) : true } }));
      if (data) apply(data);
      return data;
    }

    $('#form-signin').addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.target;
      if (!validate(form)) return;
      const values = formData(form);
      if (!(await signIn(form, { ...values, remember: form.elements.remember.checked }))) return;
      form.reset();
      Overlay.close();
      toast(`Welcome back, ${user.name.split(' ')[0]}`);
    });

    $('#form-signup').addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.target;
      if (!validate(form)) return;
      const { name, email, password } = formData(form);
      const data = await sendForm(form, () => api('/api/auth/signup', {
        method: 'POST', body: { name: name.trim(), email: email.trim(), password } }));
      if (!data) return;
      apply(data);
      form.reset();
      Overlay.close();
      toast(`Account created. Welcome, ${user.name.split(' ')[0]}`);
    });

    // Forgot password: uses the email typed in the sign-in form
    $('[data-forgot]').addEventListener('click', async () => {
      const form = $('#form-signin'), field = form.elements.email;
      if (!EMAIL.test(field.value.trim())) {
        setError(field, 'Enter your email here first, then tap “Forgot password?”.');
        field.focus();
        return;
      }
      try {
        const data = await api('/api/auth/forgot', { method: 'POST', body: { email: field.value.trim() } });
        toast(data.message);
      } catch (err) { showServerErrors(form, err); }
    });

    $('#signout').addEventListener('click', async () => {
      try {
        apply(await api('/api/auth/logout', { method: 'POST' }));
        tabs.show('signin');
        toast('You have been signed out.');
      } catch (err) { toast(err.message); }
    });

    /* "Your pre-bookings" inside the account popup */
    const ordersBox = $('#auth-orders'), ordersList = $('#auth-order-list');
    const orderTemplate = o => `
      <li class="ord">
        <div class="ord__head">
          <strong>${esc(o.booking_no)}</strong>
          <span class="ord__status ord__status--${esc(o.status)}">${esc(STATUS[o.status] || o.status)}</span>
        </div>
        <p class="ord__items">${o.items.map(i => `${i.qty} × ${esc(i.name)}${i.option_name ? ` <small>(${esc(i.option_name)})</small>` : ''}`).join('<br>')}</p>
        <p class="ord__meta">${money(o.totals.total)} · ${esc(PAYMENT[o.payment_status] || o.payment_status)}${o.totals.balance > 0 && o.status !== 'cancelled' ? ` · ${money(o.totals.balance)} due before dispatch` : ''}</p>
        <p class="ord__meta">${esc(o.batch.name)} · est. ${shortDate(fromISO(o.batch.start))} – ${longDate(fromISO(o.batch.end))}</p>
        ${CANCELLABLE.includes(o.status) ? `<button type="button" class="link ord__cancel" data-cancel="${esc(o.booking_no)}">Cancel pre-booking</button>` : ''}
      </li>`;

    async function loadOrders() {
      if (!user || !ordersBox) return;
      ordersBox.hidden = false;
      ordersList.innerHTML = '<li class="ord ord--empty">Loading your pre-bookings…</li>';
      try {
        const { orders } = await api('/api/orders');
        ordersList.innerHTML = orders.length ? orders.map(orderTemplate).join('')
          : '<li class="ord ord--empty">No pre-bookings yet. Everything you pre-book will appear here.</li>';
      } catch (err) {
        ordersList.innerHTML = `<li class="ord ord--empty">${esc(err.message)}</li>`;
      }
    }
    ordersList?.addEventListener('click', async e => {
      const btn = e.target.closest('[data-cancel]');
      if (!btn) return;
      if (!confirm(`Cancel pre-booking ${btn.dataset.cancel}? Anything you have paid will be refunded.`)) return;
      btn.disabled = true;
      try {
        await api(`/api/orders/${encodeURIComponent(btn.dataset.cancel)}/cancel`, { method: 'POST' });
        toast(`Pre-booking ${btn.dataset.cancel} cancelled. Your refund is on its way.`);
        loadOrders();
      } catch (err) { btn.disabled = false; toast(err.message); }
    });

    document.addEventListener('click', e => { if (e.target.closest('[data-account]')) Overlay.open('auth'); });
    Overlay.onOpen.auth = () => { requestAnimationFrame(tabs.fit); if (user) loadOrders(); else if (ordersBox) ordersBox.hidden = true; };

    render();
    return {
      signIn, apply,
      update: fields => { if (user) { user = { ...user, ...fields }; render(); } },
      onChange: fn => { listeners.push(fn); fn(user); },
      get user() { return user; }
    };
  })();

  /* ------------------------------------------------------------------------
     Checkout — popup with "New customer" / "I have an account" tabs
     The order is priced and saved by the server: POST /api/orders
     ------------------------------------------------------------------------ */
  (() => {
    const panel = $('#checkout');
    const tabs = initTabs($('#co-tabs'));
    const orderForm = $('#form-order');
    const loginForm = $('#form-co-login');
    $$('[data-batch-name]').forEach(el => { el.textContent = openBatch.name; });

    // Price details, laid out like the cart page: MRP, discount, total, then part payment
    function renderSummary() {
      const t = Cart.totals();
      $('#co-items').innerHTML = Cart.lines().map(({ item, label, price, was, qty }) => `
        <li><span class="co-thumb">${artOf(item, false)}<b>${qty}</b></span>
          <span>${esc(item.name)}<small>${esc(label || item.category)}</small></span>
          <strong>${money(price * qty)}${was > price ? `<s>${money(was * qty)}</s>` : ''}</strong></li>`).join('');
      $('#co-count').textContent = `(${t.n} item${t.n === 1 ? '' : 's'})`;
      $('#co-mrp').textContent = money(t.mrp);
      $('#co-discount').textContent = t.discount ? `−${money(t.discount)}` : money(0);
      $('#co-subtotal').textContent = money(t.subtotal);
      $('#co-shipping').textContent = t.shipping ? money(t.shipping) : 'Free';
      $('#co-total').textContent = $('#co-total-top').textContent = money(t.total);
      $('#co-plan-name').textContent = t.plan === 'full' ? 'Pay in full' : `Part payment – ${money(t.due)}`;
      $('#co-plan-text').textContent = t.plan === 'full'
        ? `${money(t.total)} to be paid now. Nothing left to pay at dispatch.`
        : `${money(t.due)} to be paid now and the balance ${money(t.balance)} later, before dispatch.`;
      $('#co-due').textContent = money(t.due);
      $('#co-balance').textContent = money(t.balance);
      $('#plan-deposit').textContent = `${money(t.deposit)} now, ${money(t.total - t.deposit)} before dispatch`;
      $('#plan-full').textContent = `${money(t.total)} now`;
      $('#co-submit').textContent = `Pay ${money(t.due)} · Confirm pre-booking`;
      return t;
    }

    // Reflect the signed-in state in both tabs and pre-fill the saved delivery details
    Account.onChange(user => {
      loginForm.hidden = Boolean(user);
      $('#co-signed').hidden = !user;
      $('#co-note').hidden = !user;
      if (user) {
        $('#co-user').textContent = user.email;
        $('#co-avatar').textContent = initials(user.name);
        $('#co-note').innerHTML = `Signed in as <strong>${esc(user.name)}</strong>. Confirm your delivery details below.`;
        const fill = { email: user.email, name: user.name, ...(user.saved || {}) };
        Object.entries(fill).forEach(([key, value]) => {
          const field = orderForm.elements[key];
          if (field instanceof Element && !field.value && value) field.value = value;
        });
      }
      tabs.fit();
    });

    function open() {
      if (!Cart.count()) { toast('Nothing pre-booked yet.'); return; }
      panel.classList.remove('is-done');
      $('#co-main').hidden = $('#co-summary').hidden = false;
      $('#co-done').hidden = true;
      $('#co-details').open = matchMedia('(min-width: 900px)').matches;
      orderForm.elements.plan.value = Cart.plan;
      renderSummary();
      tabs.show('new');
      Overlay.open('checkout');
    }
    Overlay.onOpen.checkout = () => requestAnimationFrame(tabs.fit);
    // Any [data-checkout] button (cart drawer, cart page) opens the checkout popup
    document.addEventListener('click', e => { if (e.target.closest('[data-checkout]')) open(); });
    Cart.onChange(() => { if (panel.classList.contains('is-open') && !panel.classList.contains('is-done')) renderSummary(); });
    orderForm.addEventListener('change', e => {
      if (e.target.name === 'plan') Cart.setPlan(e.target.value);
      if (e.target.name === 'city' || e.target.name === 'country') {
        const { city, country } = formData(orderForm);
        $('#eta-place').textContent = [city, country].filter(Boolean).join(', ') || 'your address';
      }
    });

    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validate(loginForm)) { tabs.fit(); return; }
      if (!(await Account.signIn(loginForm, formData(loginForm)))) { tabs.fit(); return; }
      loginForm.reset();
      renderSummary();
      tabs.show('new');
      toast('Signed in. Confirm where we should deliver.');
    });
    $('#co-continue').addEventListener('click', () => { tabs.show('new'); orderForm.elements.phone.focus(); });

    orderForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validate(orderForm)) { tabs.fit(); return; }
      const data = formData(orderForm);
      await Cart.saved();   // make sure the last cart change reached the server
      const result = await sendForm(orderForm, () => api('/api/orders', {
        method: 'POST',
        body: { ...data, agree: orderForm.elements.agree.checked, plan: Cart.plan, note: Cart.note, items: Cart.payload() }
      }));
      if (!result) { tabs.fit(); return; }

      // Show the confirmation exactly as the server saved it
      const o = result.order, t = o.totals;
      $('#done-name').textContent = o.customer.name.split(' ')[0];
      $('#done-email').textContent = o.customer.email;
      $('#done-no').textContent = o.booking_no;
      $('#done-place').textContent = `${o.delivery.address}, ${o.delivery.city}`;
      $('#done-eta').textContent = `${shortDate(fromISO(o.batch.start))} – ${longDate(fromISO(o.batch.end))}`;
      $('#done-totals').innerHTML = `
        <div><dt>Batch</dt><dd>${esc(o.batch.name)}</dd></div>
        <div><dt>Items</dt><dd>${t.n}</dd></div>
        <div><dt>Payment</dt><dd>${esc(o.pay_method)} · ${o.plan === 'full' ? 'Paid in full' : 'Part payment'}</dd></div>
        <div><dt>Order total</dt><dd>${money(t.total)}</dd></div>
        <div><dt>Balance before dispatch</dt><dd>${money(t.balance)}</dd></div>
        <div class="co-totals__grand"><dt>Paid today</dt><dd>${money(t.paid)}</dd></div>`;
      $('#co-main').hidden = $('#co-summary').hidden = true;
      $('#co-done').hidden = false;
      panel.classList.add('is-done');
      panel.scrollTop = 0;
      Cart.replace([]);     // the server has already emptied the saved cart
      Cart.setNote('');
      if ($('#cp-note')) $('#cp-note').value = '';
      orderForm.elements.agree.checked = false;
      if (Account.user) Account.update({ saved: { phone: o.customer.phone, ...o.delivery } });
      panel.focus();
    });
  })();

  /* ------------------------------------------------------------------------
     Search
     ------------------------------------------------------------------------ */
  (() => {
    const input = $('#search-input');
    const results = $('#search-results');
    const label = $('#search-label');

    $('#search-chips').innerHTML = popularSearches
      .map(term => `<button type="button" class="chip chip--sm" data-term="${esc(term)}">${esc(term)}</button>`).join('');

    const resultTemplate = p => `
      <li><button type="button" class="result" data-quick="${p.id}">
        <span class="result__thumb">${artOf(p, false)}</span>
        <span class="result__info"><strong>${esc(p.name)}</strong><small>${esc(p.category)}</small></span>
        <span class="result__price">${money(p.price)}</span>
      </button></li>`;

    function run() {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        label.textContent = 'Popular right now';
        results.innerHTML = products.filter(p => p.badge).slice(0, 4).map(resultTemplate).join('');
        return;
      }
      // Match on word starts ("ring" finds Flex Ring, not "spring"); name matches rank first
      const words = q.split(/\s+/).map(w => (w.length > 3 ? w.replace(/s$/, '') : w));
      const tokens = text => text.toLowerCase().split(/[^a-z0-9]+/);
      const hits = (text, w) => tokens(text).some(t => t.startsWith(w));
      const matches = catalog
        .map(p => ({
          p,
          all: words.every(w => hits(`${p.name} ${p.category} ${p.filter || ''} ${p.description}`, w)),
          inName: words.every(w => hits(p.name, w))
        }))
        .filter(m => m.all)
        .sort((x, y) => y.inName - x.inName)
        .map(m => m.p);
      label.textContent = matches.length
        ? `${matches.length} result${matches.length === 1 ? '' : 's'} for “${input.value.trim()}”`
        : `No results for “${input.value.trim()}”. Try “reformer” or “mat”.`;
      results.innerHTML = matches.map(resultTemplate).join('');
    }

    input.addEventListener('input', run);
    $('#search-chips').addEventListener('click', e => {
      const chip = e.target.closest('[data-term]');
      if (!chip) return;
      input.value = chip.dataset.term;
      run();
      input.focus();
    });
    run();
  })();

  /* ------------------------------------------------------------------------
     Bundles + "Shop the look"
     ------------------------------------------------------------------------ */
  if ($('#bundle-grid')) $('#bundle-grid').innerHTML = bundles.map((b, i) => `
    <article class="bundle" data-reveal="${i % 2 ? 'right' : 'left'}" style="--tone:${b.tone}">
      <button class="bundle__media" type="button" data-quick="${b.id}" aria-label="Quick view: ${esc(b.name)}">
        ${artOf(b)}<span class="badge badge--sale">${esc(b.badge)}</span>
      </button>
      <div class="bundle__body">
        <p class="eyebrow">${b.items.length}-piece set</p>
        <h3>${esc(b.name)}</h3>
        <p class="bundle__desc">${esc(b.description)}</p>
        <ul class="bundle__items">${b.items.map(id => `<li>${icon('check')}${esc(byId(id).name)}<span>${money(byId(id).price)}</span></li>`).join('')}</ul>
        <div class="bundle__foot">
          ${priceHtml(b)}
          <button class="btn btn--dark" type="button" data-add="${b.id}"><span>Pre-book set</span>${icon('arrow')}</button>
        </div>
      </div>
    </article>`).join('');
  watchReveal($$('.bundle'));

  $('#look')?.insertAdjacentHTML('beforeend', ['flow-yoga-mat', 'stability-ball'].map(id => {
    const p = byId(id);
    return `<button type="button" class="look__item" data-quick="${p.id}" aria-label="Quick view: ${esc(p.name)}">
      <span class="look__thumb">${artOf(p, false)}</span><span><strong>${esc(p.name)}</strong><small>${money(p.price)}</small></span></button>`;
  }).join(''));

  /* ------------------------------------------------------------------------
     Shop by movement (tabs)
     ------------------------------------------------------------------------ */
  (() => {
    const tabsEl = $('#movement-tabs');
    if (!tabsEl) return;
    const imagesEl = $('#movement-images');
    const panel = $('#movement-panel');

    tabsEl.innerHTML = movements.map((m, i) => `
      <button type="button" role="tab" class="mtab" id="mtab-${m.id}" aria-controls="movement-panel"
        aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-index="${i}"><span>0${i + 1}</span>${esc(m.name)}</button>`).join('');
    imagesEl.innerHTML = movements.map((m, i) => `
      <img class="${i === 0 ? 'is-active' : ''}" loading="lazy" decoding="async" width="1000" height="1100"
        src="${m.image}" data-fallback="${m.fallback}" alt="${esc(m.alt)}">`).join('');

    const tabs = $$('.mtab', tabsEl);
    const images = $$('img', imagesEl);

    function renderPanel(m) {
      panel.setAttribute('aria-labelledby', `mtab-${m.id}`);
      panel.innerHTML = `
        <p class="eyebrow">${esc(m.name)}</p>
        <h3 class="movement__title">${esc(m.title)}</h3>
        <p class="movement__text">${esc(m.text)}</p>
        <p class="movement__pick">Our pick<strong>${esc(m.pick)}</strong></p>
        <a class="btn btn--dark" href="#shop" data-filter-link="${m.filter}"><span>Shop ${esc(m.name.toLowerCase())}</span>${icon('arrow')}</a>`;
    }
    function select(index, focus = false) {
      tabs.forEach((t, i) => { t.setAttribute('aria-selected', i === index); t.tabIndex = i === index ? 0 : -1; });
      images.forEach((im, i) => im.classList.toggle('is-active', i === index));
      renderPanel(movements[index]);
      panel.classList.remove('is-swap'); void panel.offsetWidth; panel.classList.add('is-swap');
      if (focus) tabs[index].focus();
      centerInStrip(tabsEl, tabs[index]);
    }

    tabsEl.addEventListener('click', e => { const tab = e.target.closest('.mtab'); if (tab) select(Number(tab.dataset.index)); });
    if (canHover) tabsEl.addEventListener('mouseover', e => {
      const tab = e.target.closest('.mtab');
      if (tab && tab.getAttribute('aria-selected') !== 'true') select(Number(tab.dataset.index));
    });
    tabsEl.addEventListener('keydown', e => {
      const current = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
      const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      let next = current;
      if (e.key in moves) next = (current + moves[e.key] + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      else return;
      e.preventDefault();
      select(next, true);
    });
    renderPanel(movements[0]);
  })();

  /* ------------------------------------------------------------------------
     Testimonials — transform-based slider: smooth easing, swipe, autoplay
     ------------------------------------------------------------------------ */
  (() => {
    const viewport = $('#voice-viewport');
    if (!viewport) return;
    const track = $('#voice-track');
    const dotsEl = $('#voice-dots');
    const tones = ['var(--surface)', 'var(--sage-soft)', 'var(--peach)', 'var(--lime-soft)'];
    const AUTOPLAY = 5500;

    track.innerHTML = reviews.map((r, i) => `
      <figure class="voice" style="--tone:${tones[i % tones.length]}" aria-label="Review ${i + 1} of ${reviews.length}">
        <div class="stars" aria-label="5 out of 5 stars">${icon('star').repeat(5)}</div>
        <blockquote>“${esc(r.quote)}”</blockquote>
        <figcaption><span class="avatar" aria-hidden="true">${esc(initials(r.name))}</span>
          <span><strong>${esc(r.name)}</strong>${esc(r.role)}</span><em>${esc(r.product)}</em></figcaption>
      </figure>`).join('');
    dotsEl.innerHTML = reviews.map((_, i) => `<button type="button" aria-label="Go to review ${i + 1}"></button>`).join('');

    const slides = $$('.voice', track);
    const dots = $$('button', dotsEl);
    let index = 0, offset = 0, timer = null, inView = false, hovering = false;

    function position(i) {
      const pad = parseFloat(getComputedStyle(viewport).paddingLeft) || 0;
      const inner = viewport.clientWidth - pad * 2;
      const slide = slides[i];
      const centred = inner / 2 - (slide.offsetLeft + slide.offsetWidth / 2);
      return clamp(centred, Math.min(0, inner - track.scrollWidth), 0);
    }
    function go(i, animate = true) {
      index = (i + slides.length) % slides.length;
      offset = position(index);
      track.style.transition = animate && !reduceMotion ? '' : 'none';
      track.style.transform = `translate3d(${offset}px, 0, 0)`;
      slides.forEach((s, n) => s.classList.toggle('is-active', n === index));
      dots.forEach((d, n) => { d.classList.toggle('is-active', n === index); d.setAttribute('aria-current', n === index); });
    }
    function schedule() {
      clearInterval(timer);
      timer = null;
      if (reduceMotion || !inView || hovering) return;
      timer = setInterval(() => go(index + 1), AUTOPLAY);
    }
    const user = fn => () => { fn(); schedule(); };

    $('#voice-prev').addEventListener('click', user(() => go(index - 1)));
    $('#voice-next').addEventListener('click', user(() => go(index + 1)));
    dots.forEach((d, i) => d.addEventListener('click', user(() => go(i))));
    viewport.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); schedule(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); schedule(); }
    });
    viewport.addEventListener('mouseenter', () => { hovering = true; schedule(); });
    viewport.addEventListener('mouseleave', () => { hovering = false; schedule(); });
    viewport.addEventListener('focusin', () => { hovering = true; schedule(); });
    viewport.addEventListener('focusout', () => { hovering = false; schedule(); });

    // Swipe / drag
    let startX = 0, startY = 0, dragging = false, pointer = null;
    viewport.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointer = e.pointerId; startX = e.clientX; startY = e.clientY; dragging = false;
    });
    viewport.addEventListener('pointermove', e => {
      if (e.pointerId !== pointer) return;
      const dx = e.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - startY)) return;
        dragging = true;
        viewport.setPointerCapture(pointer);
        track.style.transition = 'none';
        clearInterval(timer);
      }
      track.style.transform = `translate3d(${offset + dx}px, 0, 0)`;
    });
    function end(e) {
      if (e.pointerId !== pointer) return;
      pointer = null;
      if (!dragging) return;
      dragging = false;
      const dx = e.clientX - startX;
      go(Math.abs(dx) > 48 ? index + (dx < 0 ? 1 : -1) : index);
      schedule();
    }
    viewport.addEventListener('pointerup', end);
    viewport.addEventListener('pointercancel', end);

    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; schedule(); }, { threshold: 0.4 }).observe(viewport);
    window.addEventListener('resize', () => go(index, false), { passive: true });
    document.fonts?.ready.then(() => go(index, false));
    go(0, false);
  })();

  /* ------------------------------------------------------------------------
     FAQ accordion
     ------------------------------------------------------------------------ */
  (() => {
    const list = $('#faq-list');
    if (!list) return;
    list.innerHTML = faqs.map((f, i) => `
      <div class="qa${i === 0 ? ' is-open' : ''}">
        <h3><button type="button" class="qa__q" aria-expanded="${i === 0}" aria-controls="qa-${i}" id="qa-btn-${i}">
          <span>${esc(f.q)}</span><i aria-hidden="true"></i></button></h3>
        <div class="qa__a" id="qa-${i}" role="region" aria-labelledby="qa-btn-${i}"><div><p>${esc(f.a)}</p></div></div>
      </div>`).join('');
    list.addEventListener('click', e => {
      const btn = e.target.closest('.qa__q');
      if (!btn) return;
      const item = btn.closest('.qa');
      const open = !item.classList.contains('is-open');
      $$('.qa', list).forEach(other => {
        const on = other === item && open;
        other.classList.toggle('is-open', on);
        $('.qa__q', other).setAttribute('aria-expanded', on);
      });
    });
  })();

  /* ------------------------------------------------------------------------
     Featured reformer — finish swatches
     ------------------------------------------------------------------------ */
  $$('.swatch').forEach(swatch => swatch.addEventListener('click', () => {
    $$('.swatch').forEach(s => { const on = s === swatch; s.classList.toggle('is-active', on); s.setAttribute('aria-pressed', on); });
    $('#reformer').dataset.finish = swatch.dataset.finish;
    $('#finish-name').textContent = swatch.dataset.name;
  }));

  /* ------------------------------------------------------------------------
     Newsletter
     ------------------------------------------------------------------------ */
  (() => {
    const form = $('#newsletter-form');
    if (!form) return;
    const input = $('#email');
    const msg = $('#news-msg');

    // A short burst of confetti when someone subscribes
    function celebrate() {
      if (reduceMotion) return;
      const box = $('#confetti');
      const colours = ['#1F231D', '#C8775A', '#5F6E55', '#FFFFFF', '#F3DCCB'];
      box.innerHTML = Array.from({ length: 30 }, (_, i) => {
        const angle = (i / 30) * Math.PI * 2, distance = 70 + Math.random() * 120;
        return `<i style="--x:${(Math.cos(angle) * distance).toFixed(0)}px;--y:${(Math.sin(angle) * distance - 50).toFixed(0)}px;--r:${Math.round(Math.random() * 720 - 360)}deg;--c:${colours[i % colours.length]};animation-delay:${(Math.random() * 0.12).toFixed(2)}s"></i>`;
      }).join('');
      setTimeout(() => { box.innerHTML = ''; }, 1700);
    }

    function say(text, ok) {
      msg.textContent = text;
      msg.classList.toggle('is-error', !ok);
      msg.classList.toggle('is-ok', ok);
      input.setAttribute('aria-invalid', !ok);
    }
    // Saved in the subscribers table: POST /api/newsletter
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!EMAIL.test(input.value.trim())) { say('Please enter a valid email address.', false); input.focus(); return; }
      const btn = $('button[type="submit"], button:not([type])', form);
      if (btn) btn.disabled = true;
      try {
        const data = await api('/api/newsletter', { method: 'POST', body: { email: input.value.trim() } });
        say(data.message, true);
        form.reset();
        if (data.created) celebrate();
      } catch (err) {
        say(err.message, false);
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  })();

  /* ------------------------------------------------------------------------
     Product page (product.html?id=...) — gallery, setup options, batches, pre-book
     ------------------------------------------------------------------------ */
  (() => {
    const root = $('#pdp');
    if (!root) return;
    const p = byId(new URLSearchParams(location.search).get('id'));
    if (!p) { root.hidden = true; $('#pdp-info').hidden = true; $('#pdp-missing').hidden = false; return; }

    const opts = optionsOf(p);
    const photos = galleryOf(p);
    let opt = opts[0], qty = 1, slide = 0;

    document.title = `${p.name} — Pre-book | Pilates equipment`;
    $('meta[name="description"]')?.setAttribute('content', `${p.description} Pre-book now, delivered in 3–4 weeks.`);
    $('#crumb-name').textContent = p.name;
    $('#pdp-tag').textContent = p.items ? `${p.items.length}-piece set · Pre-booking open` : `${p.category} · Pre-booking open`;
    $('#pdp-name').textContent = p.name;
    $('#pdp-sub').textContent = p.specs.join(' • ');
    $('#pdp-desc').textContent = p.description;
    $('#pdp-rating').innerHTML = `<span class="stars" aria-hidden="true">${icon('star').repeat(5)}</span><strong>${p.rating} / 5</strong><span>(${p.reviews} reviews)</span>`;
    $('#pdp-rating').setAttribute('aria-label', `Rated ${p.rating} out of 5 from ${p.reviews} reviews`);
    $('#pdp-wish').dataset.wish = p.id;
    if (wishlist.has(p.id)) { $('#pdp-wish').classList.add('is-saved'); $('#pdp-wish').setAttribute('aria-pressed', 'true'); }
    $('#pdp-stats').innerHTML = [
      [`${p.rating}<small>/5</small>`, `${p.reviews} reviews`],
      ['3–4 wks', 'Made-to-order delivery'],
      [`${Math.round(BOOKING_SHARE * 100)}%`, 'To pre-book today']
    ].map(([v, l]) => `<li><strong>${v}</strong><span>${l}</span></li>`).join('');

    /* Gallery */
    const stage = $('#gal-stage'), thumbs = $('#gal-thumbs');
    const img = (g, eager) => `<img src="${g.src}" ${g.fallback ? `data-fallback="${g.fallback}" ` : ''}data-art="${g.id || p.id}" alt="${esc(g.alt)}" width="900" height="1125" decoding="async"${eager ? ' fetchpriority="high"' : ' loading="lazy"'}>`;
    stage.innerHTML = photos.map((g, i) => `
      <figure class="gal__slide${i === 0 ? ' is-active' : ''}" aria-hidden="${i !== 0}">
        <span class="art art--photo${g.cut ? ' art--cut' : ''}" style="--tone:${g.tone}">${img(g, i === 0)}</span></figure>`).join('');
    thumbs.innerHTML = photos.map((g, i) => `
      <button type="button" class="gal__thumb" data-slide="${i}" aria-label="Show photo ${i + 1} of ${photos.length}" aria-current="${i === 0}">
        <span class="art art--photo${g.cut ? ' art--cut' : ''}" style="--tone:${g.tone}">${img(g, false).replace(/ alt="[^"]*"/, ' alt=""')}</span></button>`).join('');
    const slides = $$('.gal__slide', stage), thumbBtns = $$('.gal__thumb', thumbs);
    $('#gal').classList.toggle('is-single', photos.length < 2);
    thumbs.hidden = photos.length < 2;

    function show(i) {
      slide = (i + photos.length) % photos.length;
      slides.forEach((s, n) => { s.classList.toggle('is-active', n === slide); s.setAttribute('aria-hidden', n !== slide); });
      thumbBtns.forEach((t, n) => t.setAttribute('aria-current', n === slide));
      $('#gal-count').textContent = `${slide + 1} / ${photos.length}`;
      centerInStrip(thumbs, thumbBtns[slide]);
    }
    $('#gal-prev').addEventListener('click', () => show(slide - 1));
    $('#gal-next').addEventListener('click', () => show(slide + 1));
    thumbs.addEventListener('click', e => { const t = e.target.closest('[data-slide]'); if (t) show(Number(t.dataset.slide)); });
    stage.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(slide + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(slide - 1); }
    });
    let startX = null;
    stage.addEventListener('pointerdown', e => { startX = e.clientX; });
    stage.addEventListener('pointerup', e => {
      if (startX === null) return;
      const dx = e.clientX - startX; startX = null;
      if (Math.abs(dx) > 40) show(slide + (dx < 0 ? 1 : -1));
    });
    show(0);

    /* Choose your setup */
    $('#pdp-options').innerHTML = opts.map((o, i) => `
      <label class="pick">
        <input type="radio" name="setup" value="${o.key}"${i === 0 ? ' checked' : ''}>
        <span class="pick__box">
          <span class="pick__head"><span class="pick__name">${esc(o.name)}</span>${o.best ? '<em class="pill pill--lime">Best value</em>' : ''}</span>
          ${o.note ? `<span class="pick__note">${esc(o.note)}</span>` : ''}
          <span class="pick__price"><strong>${money(o.price)}</strong>${o.off > 0 ? `<b>(−${o.off}%)</b>` : ''}</span>
          <span class="pick__mrp">${o.off > 0 ? `MRP <s>${money(o.was)}</s>` : 'Inclusive of all taxes'}<i>Exclusive pre-order offer</i></span>
        </span>
      </label>`).join('');
    $('#pdp-options').addEventListener('change', e => { opt = opts.find(o => o.key === e.target.value) || opts[0]; update(); });

    /* Choose your batch */
    $('#pdp-batches').innerHTML = batches.map(b => b.soldOut ? `
      <div class="batch is-sold" aria-disabled="true">
        <span class="batch__head"><strong>${esc(b.name)}</strong><em class="pill pill--clay">Sold out</em></span>
        <span class="batch__state">Sold out</span>
        <small>This batch is fully booked.</small>
      </div>` : `
      <label class="batch">
        <input type="radio" name="batch" value="${esc(b.name)}" checked>
        <span class="batch__box">
          <span class="batch__head"><strong>${esc(b.name)}</strong><em class="pill pill--lime">Pre-book</em></span>
          <span class="batch__state">Estimated delivery</span>
          <small>${b.window}</small>
        </span>
      </label>`).join('');

    /* Quantity, price and the pre-book amount */
    const qtyEl = $('#pdp-qty');
    $('#pdp-minus').addEventListener('click', () => { qty = Math.max(1, qty - 1); update(); });
    const maxQty = typeof p.stock === 'number' ? Math.max(1, Math.min(10, p.stock)) : 10;
    $('#pdp-plus').addEventListener('click', () => { qty = Math.min(maxQty, qty + 1); update(); });

    function update() {
      const amount = opt.price * qty, deposit = depositFor(amount);
      qtyEl.textContent = qty;
      $('#pdp-deposit').textContent = money(deposit);
      $('#pdp-balance').textContent = money(amount - deposit);
      $('#pdp-cta-amt').textContent = money(deposit);
      $('#pdp-price-line').innerHTML = `<strong>${money(amount)}</strong>${opt.off > 0 ? `<s>${money(opt.was * qty)}</s><b>You save ${money((opt.was - opt.price) * qty)}</b>` : ''}`;
      $('#pdp-included').innerHTML = opts.map(o => `<li${o === opt ? ' class="is-current"' : ''}><strong>${esc(o.name)}</strong>${esc(o.note || p.name)}</li>`).join('');
    }

    $('#pdp-prebook').addEventListener('click', async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      // wait until the cart is saved, then go to it
      if (await Cart.add(p.id, qty, opt.key, { open: false }) === false) { btn.disabled = p.stock === 0; return; }
      location.href = 'cart.html';
    });
    $('#pdp-add').addEventListener('click', () => Cart.add(p.id, qty, opt.key));

    $('#pdp-batch-copy').textContent = `${openBatch.name}: estimated delivery ${openBatch.window}.`
      + (p.stock === 0 ? ' Sold out for now.' : p.stock <= 10 ? ` Only ${p.stock} left to book.` : '');
    if (p.stock === 0) ['#pdp-add', '#pdp-prebook'].forEach(sel => { $(sel).disabled = true; });

    /* You may also like */
    const related = [...products.filter(x => x.id !== p.id && x.filter === (p.filter || 'yoga')), ...products.filter(x => x.id !== p.id && x.filter !== (p.filter || 'yoga'))].slice(0, 4);
    $('#pdp-related').innerHTML = related.map(cardTemplate).join('');
    watchReveal($$('#pdp-related .card'));

    update();
  })();

  /* ------------------------------------------------------------------------
     Cart page (cart.html)
     ------------------------------------------------------------------------ */
  (() => {
    const root = $('#cart-page');
    if (!root) return;
    const rows = $('#cp-rows');

    function render() {
      const t = Cart.totals(), all = Cart.lines();
      $('#cp-filled').hidden = t.n === 0;
      $('#cp-empty').hidden = t.n > 0;
      $('#cp-count').textContent = t.n ? `${t.n} item${t.n === 1 ? '' : 's'}` : '';
      rows.innerHTML = all.map(({ key, item, label, price, was, qty }) => `
        <li class="cp-row" data-key="${esc(key)}">
          <a class="cp-row__thumb" href="${productUrl(item.id)}" tabindex="-1" aria-hidden="true">${artOf(item, false)}</a>
          <div class="cp-row__info">
            <a class="cp-row__name" href="${productUrl(item.id)}">${esc(item.name)}</a>
            <p class="cp-row__opt">${esc(label || item.category)}</p>
            <p class="cp-row__unit">${money(price)} each${was > price ? ` · MRP <s>${money(was)}</s>` : ''}</p>
            <p class="cp-row__eta">${icon('truck')}${esc(openBatch.name)} · est. ${openBatch.window}</p>
          </div>
          <div class="cp-row__qty">
            <div class="qty" role="group" aria-label="Quantity for ${esc(item.name)}">
              <button type="button" data-step="-1" aria-label="Decrease quantity">${icon('minus')}</button>
              <output>${qty}</output>
              <button type="button" data-step="1" aria-label="Increase quantity">${icon('plus')}</button>
            </div>
            <button type="button" class="link" data-remove>Remove</button>
          </div>
          <div class="cp-row__total"><strong>${money(price * qty)}</strong>${was > price ? `<s>${money(was * qty)}</s>` : ''}</div>
        </li>`).join('');

      $('#cp-mrp').textContent = money(t.mrp);
      $('#cp-discount').textContent = t.discount ? `−${money(t.discount)}` : money(0);
      $('#cp-subtotal').textContent = money(t.subtotal);
      $('#cp-shipping').textContent = t.shipping ? money(t.shipping) : 'Free';
      $('#cp-total').textContent = money(t.total);
      $('#cp-tax').textContent = t.shipping
        ? `Including taxes • Add ${money(FREE_SHIPPING_AT - t.subtotal)} more for free shipping`
        : 'Including taxes • Free shipping across India';
      $('#cp-dep').textContent = money(t.deposit);
      $('#cp-dep-text').textContent = `${money(t.deposit)} to be paid now and the balance ${money(t.total - t.deposit)} later`;
      $('#cp-full').textContent = money(t.total);
      $$('input[name="cp-plan"]').forEach(r => { r.checked = r.value === t.plan; });
      $('#cp-checkout-amt').textContent = money(t.due);
    }

    rows.addEventListener('click', e => {
      const row = e.target.closest('.cp-row');
      if (!row) return;
      const key = row.dataset.key;
      const step = e.target.closest('[data-step]');
      if (step) {
        Cart.setQty(key, Cart.qtyOf(key) + Number(step.dataset.step));
        ($(`.cp-row[data-key="${CSS.escape(key)}"] [data-step="${step.dataset.step}"]`) || $('#cp-title')).focus();
      } else if (e.target.closest('[data-remove]')) {
        Cart.setQty(key, 0);
        toast('Removed from your cart');
        $('#cp-title').focus();
      }
    });
    root.addEventListener('change', e => { if (e.target.name === 'cp-plan') Cart.setPlan(e.target.value); });

    // Note for the seller (kept on this device, sent with the order)
    const noteBtn = $('#cp-note-toggle'), noteBox = $('#cp-note-box'), note = $('#cp-note');
    note.value = Cart.note;
    if (Cart.note) { noteBox.hidden = false; noteBtn.setAttribute('aria-expanded', 'true'); }
    noteBtn.addEventListener('click', () => {
      const open = noteBox.hidden;
      noteBox.hidden = !open;
      noteBtn.setAttribute('aria-expanded', open);
      if (open) note.focus();
    });
    note.addEventListener('input', () => Cart.setNote(note.value));

    $$('[data-batch-window]').forEach(el => { el.textContent = openBatch.window; });
    $$('[data-batch-name]').forEach(el => { el.textContent = openBatch.name; });
    Cart.onChange(render);
  })();

  /* ------------------------------------------------------------------------
     Pre-booking terms page — live dates in the worked example
     ------------------------------------------------------------------------ */
  $$('[data-batch-window]').forEach(el => { el.textContent = openBatch.window; });
  $$('[data-batch-name]').forEach(el => { el.textContent = openBatch.name; });

  /* ------------------------------------------------------------------------
     Image Fallback — never show a broken-image icon
     If a file is missing, products show their drawing and other photos a soft placeholder.
     ------------------------------------------------------------------------ */
  (() => {
    function handle(image) {
      if (image.dataset.failed === '2') return;
      if (image.dataset.fallback && !image.dataset.failed) {
        image.dataset.failed = '1';
        image.removeAttribute('srcset');
        image.src = image.dataset.fallback;
        return;
      }
      image.dataset.failed = '2';
      // Product photos fall back to a drawn illustration; other photos to a soft placeholder
      const product = image.dataset.art && byId(image.dataset.art);
      const holder = image.closest('.art__tile, .art');
      if (product && holder) { holder.classList.remove('art--photo'); holder.innerHTML = drawing(product); return; }
      image.classList.add('is-broken');
      image.closest('.media')?.classList.add('is-fallback');
    }
    // `error` does not bubble, so listen in the capture phase
    document.addEventListener('error', e => { if (e.target instanceof HTMLImageElement) handle(e.target); }, true);
    // Catch images that failed before this script ran
    $$('img').forEach(image => { if (image.complete && image.currentSrc && image.naturalWidth === 0) handle(image); });
  })();

  queueFrame();
})();
