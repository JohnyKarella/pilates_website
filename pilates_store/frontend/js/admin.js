/* ==========================================================================
   Store admin — admin.js (vanilla JS)
   Uses the admin API in backend/routes/admin.py. Only accounts with
   is_admin = true can open it (first admin: see ADMIN_EMAIL in backend/.env).
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = iso => iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const day = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const STATUS = { booked: 'Booked', in_production: 'In production', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled' };
  const PAYMENT = { part_paid: 'Part paid', paid: 'Paid in full', refund_due: 'Refund due', refunded: 'Refunded' };
  const pill = (key, labels) => `<span class="pill pill--${esc(key)}">${esc(labels[key] || key)}</span>`;
  const options = (labels, current) => Object.entries(labels).map(([k, v]) => `<option value="${k}"${k === current ? ' selected' : ''}>${v}</option>`).join('');

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method, credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) { showLogin(data.error); throw new Error(data.error); }
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }

  let toastTimer;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
  }

  /* ---- Sign in --------------------------------------------------------- */
  function showLogin(message = '') {
    $('#app').hidden = true;
    $('#login').hidden = false;
    $('#login-err').textContent = message && !/sign in as an admin/i.test(message) ? message : '';
  }
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target, err = $('#login-err');
    const btn = $('button', form);
    btn.disabled = true;
    err.textContent = '';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.value, password: form.password.value, remember: false })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (!data.user.is_admin) {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        throw new Error('This account is not an admin account.');
      }
      form.reset();
      start(data.user);
    } catch (ex) { err.textContent = ex.message || 'Could not sign in.'; }
    finally { btn.disabled = false; }
  });
  $('#logout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    showLogin();
  });

  /* ---- Tabs -------------------------------------------------------------- */
  const loaders = {};
  function show(tab) {
    $$('.tabs button').forEach(b => (b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    $$('.view').forEach(v => { v.hidden = v.dataset.view !== tab; });
    try { sessionStorage.setItem('admin-tab', tab); } catch { /* ignore */ }
    loaders[tab]?.();
  }
  $('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); });

  /* ---- Overview --------------------------------------------------------- */
  const orderRow = o => `
    <tr class="is-click" data-order="${esc(o.booking_no)}">
      <td><strong>${esc(o.booking_no)}</strong><small>${when(o.created_at)}</small></td>
      <td>${esc(o.customer.name)}<small>${esc(o.customer.email)} · ${esc(o.customer.phone)}</small></td>
      <td>${esc(o.delivery.city)}<small>${esc(o.batch.name)}</small></td>
      <td class="num">${o.totals.n}</td>
      <td class="num">${money(o.totals.total)}<small>paid ${money(o.totals.paid)}</small></td>
      <td>${pill(o.status, STATUS)}</td>
      <td>${pill(o.payment_status, PAYMENT)}</td>
    </tr>`;
  const orderHead = `<thead><tr><th>Booking</th><th>Customer</th><th>Deliver to</th><th class="num">Items</th><th class="num">Total</th><th>Status</th><th>Payment</th></tr></thead>`;
  const emptyRow = (cols, text) => `<tr><td class="empty" colspan="${cols}">${text}</td></tr>`;

  loaders.overview = async () => {
    const [s, { orders }] = await Promise.all([api('/api/admin/stats'), api('/api/admin/orders')]);
    $('#stats').innerHTML = [
      [s.orders, 'Orders in total'], [s.open_orders, 'Open (booked or in production)'],
      [money(s.booked_value), 'Booked value (not cancelled)'], [money(s.collected), 'Collected so far'],
      [money(s.balance_due), 'Balance still due'], [s.customers, 'Customer accounts'], [s.subscribers, 'Newsletter subscribers']
    ].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
    $('#status-row').innerHTML = Object.entries(s.by_status).map(([k, n]) => `${pill(k, STATUS)} <span>${n}</span>`).join(' &nbsp; ');
    $('#latest').innerHTML = orderHead + `<tbody>${orders.slice(0, 8).map(orderRow).join('') || emptyRow(7, 'No orders yet.')}</tbody>`;
  };

  /* ---- Orders ------------------------------------------------------------ */
  $('#order-status').insertAdjacentHTML('beforeend', options(STATUS));
  let searchTimer;
  loaders.orders = async () => {
    const q = $('#order-q').value.trim(), status = $('#order-status').value;
    const qs = new URLSearchParams({ ...(q && { q }), ...(status && { status }) }).toString();
    $('#csv').href = `/api/admin/orders.csv${qs ? `?${qs}` : ''}`;
    const { orders } = await api(`/api/admin/orders${qs ? `?${qs}` : ''}`);
    $('#orders').innerHTML = orderHead + `<tbody>${orders.map(orderRow).join('') || emptyRow(7, 'No orders match.')}</tbody>`;
  };
  $('#order-q').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loaders.orders, 250); });
  $('#order-status').addEventListener('change', () => loaders.orders());
  document.addEventListener('click', e => { const row = e.target.closest('[data-order]'); if (row) openOrder(row.dataset.order); });

  /* ---- Order drawer --------------------------------------------------- */
  const drawer = $('#drawer'), shade = $('#shade');
  function closeDrawer() { drawer.classList.remove('is-open'); drawer.inert = true; drawer.setAttribute('aria-hidden', 'true'); shade.hidden = true; }
  $('#drawer-close').addEventListener('click', closeDrawer);
  shade.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  async function openOrder(no) {
    const { order: o } = await api(`/api/admin/orders/${encodeURIComponent(no)}`);
    const t = o.totals, d = o.delivery;
    $('#drawer-body').innerHTML = `
      <p class="eyebrow">${when(o.created_at)}</p>
      <h2>${esc(o.booking_no)}</h2>
      <p>${pill(o.status, STATUS)} ${pill(o.payment_status, PAYMENT)}</p>
      <div class="box">
        <h3>Update</h3>
        <form class="controls" id="order-update">
          <label class="field"><span>Order status</span><select name="status">${options(STATUS, o.status)}</select></label>
          <label class="field"><span>Payment</span><select name="payment_status">${options(PAYMENT, o.payment_status)}</select></label>
          <button class="btn" type="submit">Save changes</button>
        </form>
        <p class="hint">Choosing “Paid in full” records the balance as received.</p>
      </div>
      <div class="box">
        <h3>Items</h3>
        <ul>${o.items.map(i => `<li><span>${i.qty} × ${esc(i.name)}${i.option_name ? ` <small>(${esc(i.option_name)})</small>` : ''}</span><strong>${money(i.line_total)}</strong></li>`).join('')}</ul>
        <dl>
          <dt>MRP</dt><dd>${money(t.mrp)}</dd><dt>Discount</dt><dd>−${money(t.discount)}</dd>
          <dt>Shipping</dt><dd>${t.shipping ? money(t.shipping) : 'Free'}</dd><dt>Total</dt><dd><strong>${money(t.total)}</strong></dd>
          <dt>Paid</dt><dd>${money(t.paid)} · ${esc(o.pay_method)} · ${o.plan === 'full' ? 'Pay in full' : 'Part payment'}</dd>
          <dt>Balance</dt><dd>${money(t.balance)}</dd>
        </dl>
      </div>
      <div class="box">
        <h3>Customer and delivery</h3>
        <dl>
          <dt>Name</dt><dd>${esc(o.customer.name)}</dd><dt>Email</dt><dd><a href="mailto:${esc(o.customer.email)}">${esc(o.customer.email)}</a></dd>
          <dt>Phone</dt><dd><a href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a></dd>
          <dt>Address</dt><dd>${esc(d.address)}<br>${esc(d.city)}, ${esc(d.state)} ${esc(d.zip)}<br>${esc(d.country)}</dd>
          <dt>Batch</dt><dd>${esc(o.batch.name)} · ${day(o.batch.start)} – ${day(o.batch.end)}</dd>
          <dt>Account</dt><dd>${o.user_id ? 'Signed-in customer' : 'Guest checkout'}</dd>
          ${o.note ? `<dt>Note</dt><dd>${esc(o.note)}</dd>` : ''}
        </dl>
      </div>`;
    $('#order-update').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('button', e.target);
      btn.disabled = true;
      try {
        await api(`/api/admin/orders/${encodeURIComponent(o.booking_no)}`, { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) });
        toast(`${o.booking_no} updated`);
        closeDrawer();
        loaders[sessionStorageTab()]?.();
      } catch (ex) { toast(ex.message); btn.disabled = false; }
    });
    drawer.inert = false;
    drawer.setAttribute('aria-hidden', 'false');
    shade.hidden = false;
    drawer.classList.add('is-open');
    drawer.scrollTop = 0;
  }
  const sessionStorageTab = () => $('.tabs [aria-current="page"]')?.dataset.tab || 'overview';

  /* ---- Products --------------------------------------------------------- */
  loaders.products = async () => {
    const { products } = await api('/api/admin/products');
    $('#products').innerHTML = `<thead><tr><th>Product</th><th>Prices — option · price · MRP (₹)</th><th>Badge</th><th>Stock</th><th>In shop</th><th></th></tr></thead><tbody>${
      products.map(p => `
        <tr data-product="${esc(p.id)}" class="${p.is_active ? '' : 'is-off'}">
          <td><strong>${esc(p.name)}</strong><small>${esc(p.kind === 'bundle' ? 'Bundle' : p.category)} · ${esc(p.id)}</small></td>
          <td>${p.options.map(o => `
            <div class="opt" data-key="${esc(o.key)}"><span>${esc(o.name)}</span>
              <input type="number" min="1" step="1" name="price" value="${o.price}" aria-label="${esc(o.name)} price">
              <input type="number" min="0" step="1" name="was" value="${o.was > o.price ? o.was : ''}" placeholder="MRP" aria-label="${esc(o.name)} MRP"></div>`).join('')}</td>
          <td>${p.kind === 'bundle' ? '<small>automatic</small>' : `<input type="text" name="badge" value="${esc(p.badge)}" maxlength="60">`}</td>
          <td><input type="number" min="0" step="1" name="stock" value="${p.stock}" aria-label="${esc(p.name)} stock"${p.stock <= 5 ? ' class="is-low" title="Low stock"' : ''}></td>
          <td><input type="checkbox" name="is_active" ${p.is_active ? 'checked' : ''} aria-label="Show in shop"></td>
          <td><button type="button" class="btn btn--sm" data-save>Save</button></td>
        </tr>`).join('')}</tbody>`;
  };
  $('#products').addEventListener('click', async e => {
    const btn = e.target.closest('[data-save]');
    if (!btn) return;
    const row = btn.closest('tr');
    const body = {
      is_active: $('[name=is_active]', row).checked,
      stock: $('[name=stock]', row).value,
      options: $$('.opt', row).map(o => ({ key: o.dataset.key, price: $('[name=price]', o).value, was: $('[name=was]', o).value }))
    };
    const badge = $('[name=badge]', row);
    if (badge) body.badge = badge.value;
    btn.disabled = true;
    try {
      const { product } = await api(`/api/admin/products/${encodeURIComponent(row.dataset.product)}`, { method: 'PATCH', body });
      row.classList.toggle('is-off', !product.is_active);
      toast(`${product.name} saved`);
    } catch (ex) { toast(ex.message); }
    finally { btn.disabled = false; }
  });

  /* ---- Customers & subscribers -------------------------------------------- */
  loaders.customers = async () => {
    const { customers } = await api('/api/admin/customers');
    $('#customers').innerHTML = `<thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>City</th><th class="num">Orders</th><th class="num">Booked value</th><th>Joined</th></tr></thead><tbody>${
      customers.map(c => `<tr><td>${esc(c.name)}${c.is_admin ? ' <span class="pill">Admin</span>' : ''}</td><td>${esc(c.email)}</td><td>${esc(c.saved.phone)}</td>
        <td>${esc(c.saved.city)}</td><td class="num">${c.orders}</td><td class="num">${money(c.spent)}</td><td>${when(c.created_at)}</td></tr>`).join('') || emptyRow(7, 'No customers yet.')}</tbody>`;
  };
  loaders.subscribers = async () => {
    const { subscribers } = await api('/api/admin/subscribers');
    $('#subscribers').innerHTML = `<thead><tr><th>Email</th><th>Subscribed</th></tr></thead><tbody>${
      subscribers.map(s => `<tr><td>${esc(s.email)}</td><td>${when(s.created_at)}</td></tr>`).join('') || emptyRow(2, 'No subscribers yet.')}</tbody>`;
  };

  /* ---- Start -------------------------------------------------------------- */
  function start(user) {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#admin-name').textContent = user.name;
    let tab = 'overview';
    try { tab = sessionStorage.getItem('admin-tab') || tab; } catch { /* ignore */ }
    show(loaders[tab] ? tab : 'overview');
  }

  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(r => r.json())
    .then(data => (data.user && data.user.is_admin ? start(data.user) : showLogin()))
    .catch(() => showLogin('Cannot reach the server. Is python app.py running?'));
})();
