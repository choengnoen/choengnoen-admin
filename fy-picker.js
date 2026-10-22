/* ===== ปุ่มเลือกปีงบประมาณ — แบบมาตรฐานเดียวของทุกระบบ (แบบ 6 มินิมอล ขีดเส้นใต้) =====
   กฎ: ที่ไหนในระบบต้องมี “เลือกปีงบประมาณ” ให้ใช้ไฟล์นี้เท่านั้น ห้ามเขียนปุ่ม/สไตล์ปีงบเอง

   วิธีใช้ (3 บรรทัด)
   1) <script src="fy-picker.js"></script>        (ใส่หลัง dsel.js)
   2) <select id="xxx-fy" data-fy onchange="..."></select>   ← ใส่ data-fy ที่ <select> ตามเดิม
        data-fy="nolabel"  = ไม่แสดงคำว่า “ปีงบประมาณ” ในปุ่ม (ใช้เมื่อมีป้ายกำกับอยู่ข้างนอกแล้ว)
   3) เติมตัวเลือกด้วย FYPicker.fill(sel, [2570,2569,2568], {all:'ทุกปี', value:2570})  หรือ innerHTML ตามเดิมก็ได้

        data-fy-label="สายทาง" = ใช้ปุ่มแบบเดียวกันกับตัวเลือกอื่นที่ไม่ใช่ปี (ป้ายตั้งเองได้ ตัดข้อความหลัง " — " ในปุ่ม)
   - ตัว <select> เดิมยังอยู่ (ซ่อนไว้) โค้ดเดิมที่อ่าน/ตั้ง .value หรือฟัง change ทำงานเหมือนเดิมทุกอย่าง
   - เปลี่ยนตัวเลือก (innerHTML) หรือสั่ง .value = ... ปุ่มจะอัปเดตเอง ช่องที่สร้างทีหลังก็ได้แบบเดียวกันอัตโนมัติ
   - FYPicker.fiscalYearOf('2026-10-20') → 2570 (วันที่ ISO → ปีงบประมาณ พ.ศ.)
   ไฟล์นี้เหมือนกันทุกที่ แก้ที่หนึ่งให้คัดลอกไปทุกระบบ (ปัจจุบัน: งานบริหารหมวด) */
(function () {
  'use strict';
  if (window.FYPicker) return;

  var css =
    '.fyp{position:relative;display:inline-block;vertical-align:middle}' +
    '.fyp-btn{display:inline-flex;align-items:center;gap:6px;background:transparent;border:0;border-bottom:2px solid #0a2540;border-radius:0;padding:6px 2px 5px;cursor:pointer;' +
    'font-family:"Kanit","Sarabun",sans-serif;font-size:15px;font-weight:600;color:#0a2540;line-height:1.25;white-space:nowrap;box-shadow:none}' +
    '.fyp-lab{font-family:"Sarabun",sans-serif;font-weight:400;font-size:13px;color:#4d5a66}' +
    '.fyp-btn:hover,.fyp-btn.open,.fyp-btn:focus-visible{border-bottom-color:#e0620f;color:#e0620f;outline:0}' +
    '.fyp-btn[disabled]{opacity:.5;cursor:default}' +
    '.fyp-caret{width:10px;height:10px;flex:none;transition:transform .15s}' +
    '.fyp-btn.open .fyp-caret{transform:rotate(180deg)}' +
    '.fyp-src{display:none!important}' +
    '.fyp-menu{position:fixed;z-index:2147483000;box-sizing:border-box;width:max-content;min-width:170px;max-width:min(420px,92vw);max-height:280px;overflow:auto;' +
    'background:#fff;border:1px solid #dfe2dd;border-radius:10px;box-shadow:0 12px 30px -10px rgba(0,0,0,.25);font-family:"Sarabun",sans-serif;color:#182430;text-align:left}' +
    '.fyp-item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 12px;cursor:pointer;font-size:14px;line-height:1.35;border-bottom:1px solid #eceee9}' +
    '.fyp-item:last-child{border-bottom:0}.fyp-item.active{background:#fdf1de}.fyp-item.sel{font-weight:600}' +
    '.fyp-tick{color:#e0620f;font-size:13px;margin-left:12px;flex:none}' +
    '@media print{.fyp{display:none!important}}';
  var st = document.createElement('style');
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  var CARET = '<svg class="fyp-caret" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5 5 6.5 8 3.5"/></svg>';
  var valDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  var idxDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  var menu = null, cur = null, active = -1;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function shortText(t) { return String(t).replace(/^\s*ปีงบประมาณ\s*/, ''); }

  /* วันที่ ISO (YYYY-MM-DD) → ปีงบประมาณ พ.ศ. (ต.ค.–ธ.ค. นับเป็นปีถัดไป) */
  function fiscalYearOf(iso) {
    if (!iso) return null;
    var m = /^(\d{4})-(\d{2})/.exec(String(iso));
    if (!m) return null;
    var y = +m[1] + 543, mo = +m[2];
    return mo >= 10 ? y + 1 : y;
  }
  function currentFiscalYear() { return fiscalYearOf(new Date().toISOString().slice(0, 10)); }

  function refresh(sel) {
    var w = sel.__fyp;
    if (!w) return;
    var o = sel.options[sel.selectedIndex];
    var txt = o ? shortText(o.text) : '—';
    var own = sel.getAttribute('data-fy-label');
    if (own) txt = txt.split(' — ')[0];   // ตัวเลือกชื่อยาว (เช่น สายทาง — ตอน) ให้ปุ่มโชว์แค่ส่วนหน้า เมนูยังเห็นครบ
    var lab = own ? '<span class="fyp-lab">' + esc(own) + '</span> ' : (sel.getAttribute('data-fy') === 'nolabel' ? '' : '<span class="fyp-lab">ปีงบประมาณ</span> ');
    w.btn.innerHTML = lab + esc(txt) + CARET;
    w.btn.disabled = !!sel.disabled || sel.options.length === 0;
    if (cur === sel && menu && menu.style.display !== 'none') build();
  }

  function enhance(sel) {
    if (!sel || sel.__fyp || sel.tagName !== 'SELECT') return;
    var wrap = document.createElement('span');
    wrap.className = 'fyp';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fyp-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    wrap.appendChild(btn);
    sel.parentNode.insertBefore(wrap, sel);
    sel.classList.add('fyp-src');
    sel.__fyp = { wrap: wrap, btn: btn };
    // ตั้ง .value / .selectedIndex ด้วยโค้ด → ปุ่มอัปเดตตาม
    Object.defineProperty(sel, 'value', { configurable: true, get: function () { return valDesc.get.call(sel); }, set: function (v) { valDesc.set.call(sel, v); refresh(sel); } });
    Object.defineProperty(sel, 'selectedIndex', { configurable: true, get: function () { return idxDesc.get.call(sel); }, set: function (v) { idxDesc.set.call(sel, v); refresh(sel); } });
    new MutationObserver(function () { refresh(sel); }).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected'] });
    sel.addEventListener('change', function () { refresh(sel); });
    btn.addEventListener('click', function (e) { e.stopPropagation(); if (cur === sel && isOpen()) close(); else open(sel); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!isOpen() || cur !== sel) open(sel); else move(e.key === 'ArrowDown' ? 1 : -1); }
      else if ((e.key === 'Enter' || e.key === ' ') && isOpen() && cur === sel) { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') close();
    });
    refresh(sel);
  }

  function ensureMenu() {
    if (menu) return menu;
    menu = document.createElement('div');
    menu.className = 'fyp-menu';
    menu.setAttribute('role', 'listbox');
    menu.style.display = 'none';
    menu.addEventListener('mousedown', function (e) { e.preventDefault(); });
    menu.addEventListener('click', function (e) { var el = e.target.closest('.fyp-item'); if (el) choose(Number(el.dataset.i)); });
    menu.addEventListener('mousemove', function (e) {
      var el = e.target.closest('.fyp-item');
      if (el && Number(el.dataset.i) !== active) { active = Number(el.dataset.i); paint(); }
    });
    document.body.appendChild(menu);
    return menu;
  }
  function isOpen() { return !!(menu && menu.style.display !== 'none'); }
  function build() {
    var h = '';
    [].forEach.call(cur.options, function (o, i) {
      var s = i === cur.selectedIndex;
      h += '<div class="fyp-item' + (s ? ' sel' : '') + '" role="option" data-i="' + i + '"><span>' + esc(o.text) + '</span>' + (s ? '<span class="fyp-tick">✓</span>' : '') + '</div>';
    });
    menu.innerHTML = h;
    paint();
  }
  function paint() {
    [].forEach.call(menu.children, function (el) { el.classList.toggle('active', Number(el.dataset.i) === active); });
    var el = menu.querySelector('.fyp-item.active');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
  function place() {
    var r = cur.__fyp.btn.getBoundingClientRect();
    menu.style.left = '0px'; menu.style.top = '0px';
    var mh = menu.offsetHeight, mw = menu.offsetWidth;
    var top = r.bottom + 6;
    if (top + mh > window.innerHeight - 8 && r.top - mh - 6 > 8) top = r.top - mh - 6;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - mw - 8);
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
  }
  function open(sel) {
    if (sel.disabled || !sel.options.length) return;
    close();
    ensureMenu();
    cur = sel;
    active = sel.selectedIndex;
    menu.style.display = 'block';
    build();
    place();
    sel.__fyp.btn.classList.add('open');
  }
  function close() {
    if (menu) menu.style.display = 'none';
    if (cur && cur.__fyp) cur.__fyp.btn.classList.remove('open');
  }
  function move(d) {
    var n = cur.options.length;
    if (!n) return;
    active = (active + d + n) % n;
    paint();
  }
  function choose(i) {
    if (!cur || i < 0 || i >= cur.options.length) return;
    var sel = cur;
    close();
    if (sel.selectedIndex !== i) {
      idxDesc.set.call(sel, i);
      refresh(sel);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    sel.__fyp.btn.focus();
  }

  document.addEventListener('mousedown', function (e) { if (isOpen() && !menu.contains(e.target) && !(cur && cur.__fyp.wrap.contains(e.target))) close(); });
  window.addEventListener('resize', close);
  window.addEventListener('scroll', function (e) { if (isOpen() && !menu.contains(e.target)) close(); }, true);

  /* เติมตัวเลือกปี: years = [2570,2569,...]  opts = { all:'ทุกปี' (ใส่ถ้าต้องมีตัวเลือกทั้งหมด, ค่า=''), value: ค่าที่เลือก, suffix:{2570:' (ปีนี้)'} } */
  function fill(sel, years, opts) {
    opts = opts || {};
    var want = opts.value != null ? String(opts.value) : valDesc.get.call(sel);
    var h = opts.all ? '<option value="">' + esc(opts.all) + '</option>' : '';
    years.forEach(function (y) { h += '<option value="' + y + '">ปีงบประมาณ ' + y + ((opts.suffix && opts.suffix[y]) || '') + '</option>'; });
    sel.innerHTML = h;
    var ok = [].some.call(sel.options, function (o) { return o.value === want; });
    sel.value = ok ? want : (sel.options[0] ? sel.options[0].value : '');
    refresh(sel);
  }

  function scan(root) { [].forEach.call((root || document).querySelectorAll('select[data-fy]'), enhance); }
  window.FYPicker = { enhance: enhance, scan: scan, fill: fill, refresh: refresh, fiscalYearOf: fiscalYearOf, currentFiscalYear: currentFiscalYear };

  function start() {
    scan();
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) { if (n.matches && n.matches('select[data-fy]')) enhance(n); else if (n.querySelectorAll) scan(n); } }); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
