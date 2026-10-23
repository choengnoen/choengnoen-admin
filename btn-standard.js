/* btn-standard.js — มาตรฐานปุ่มระบบบริหารหมวด (ไฟล์กลาง)
 * ใช้: <button class="btn btn-ghost btn-ic" data-ic="print" data-tip="พิมพ์"></button>   ← ปุ่มไอคอนล้วน
 *      <button class="btn btn-primary" data-ic="plus">เพิ่มรายการ</button>               ← ปุ่มข้อความ + ไอคอนนำหน้า
 * ท้ายแถวตาราง: เพิ่ม btn-sm (28px). ปุ่มลบ: เพิ่ม btn-ic-danger
 * กฎ: หัวการ์ด = ตัวกรอง → <span class="tb-sep"> → ไอคอนรอง → ปุ่มส้ม 1 ปุ่มชิดขวา; ข้อความประกอบใต้ชื่อใช้ <small class="hd-sub">
 * data-ic ที่ใส่ภายหลัง (innerHTML) จะถูกเติมไอคอนให้อัตโนมัติ */
(function(){
  var P={
    plus:'<path d="M12 5v14M5 12h14"/>',
    print:'<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    calq:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="14.5" cy="15.5" r="2.2"/><path d="m16.2 17.2 1.8 1.8"/>',
    down:'<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    up:'<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    pen:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    undo:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    hist:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    left:'<path d="m15 5-7 7 7 7"/>',
    right:'<path d="m9 5 7 7-7 7"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    check:'<path d="m5 12 5 5 9-10"/>',
    x:'<path d="M6 6l12 12M18 6 6 18"/>',
    search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    wand:'<path d="m5 19 9-9M13 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM18 11l.7 1.3 1.3.7-1.3.7-.7 1.3-.7-1.3-1.3-.7 1.3-.7z"/>',
    doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>',
    save:'<path d="M5 4h12l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    caret:'<path d="m6 9 6 6 6-6"/>'
  };
  var css=
  '.btn-ic{width:36px;height:36px;padding:0!important;justify-content:center;position:relative;flex:none;color:var(--ink-600,#5b6475)}'+
  '.btn-ic.btn-sm{width:28px;height:28px;border-radius:7px}'+
  '.btn-ic.btn-primary{color:#fff}'+
  '.btn-ic-danger{color:var(--danger,#c0392b)}'+
  '.btn-ic.btn-ghost:hover{color:var(--ink-900,#1d2433)}'+
  '.btn-ic.btn-ic-danger:hover{color:var(--danger,#c0392b)}'+
  '.icb svg.bs-i{width:17px;height:17px}'+
  '.btn svg.bs-i{width:1.15em;height:1.15em;flex:none}'+
  '.btn-ic svg.bs-i{width:17px;height:17px}.btn-ic.btn-sm svg.bs-i{width:15px;height:15px}'+
  '[data-tip]:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#14263f;color:#fff;font:500 11.5px "Sarabun",sans-serif;padding:3px 8px;border-radius:6px;white-space:nowrap;z-index:60;pointer-events:none}'+
  '.tb-sep{width:1px;height:22px;background:var(--line,#e4e4e0);flex:none;align-self:center}'+
  '.hd-sub{display:block;font-family:"Sarabun",sans-serif;font-size:11.5px;font-weight:400;color:var(--ink-400,#8b93a1);margin-top:1px;line-height:1.3}'+
  '.btn-split{display:inline-flex;position:relative}'+
  '.btn-split.hidden{display:none}'+
  '.btn-split>.btn:first-child{border-top-right-radius:0;border-bottom-right-radius:0}'+
  '.btn-split>.bs-caret{border-top-left-radius:0;border-bottom-left-radius:0;padding:0 9px!important;border-left:1px solid rgba(255,255,255,.45)}'+
  '.bs-menu{position:absolute;right:0;top:calc(100% + 6px);background:#fff;border:1px solid var(--line,#e4e4e0);border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.16);min-width:200px;z-index:70;padding:5px;display:none}'+
  '.bs-menu.open{display:block}'+
  '.bs-menu button{display:flex;gap:8px;align-items:center;width:100%;text-align:left;background:none;border:none;border-radius:7px;padding:8px 10px;font:600 13px "Sarabun",sans-serif;color:var(--ink-900,#1d2433);cursor:pointer}'+
  '.bs-menu button:hover{background:var(--paper-100,#f4f4f2)}';
  /* ช่องค้นหา (.search-box) แบบ 4: เป็นไอคอนแว่นขยายก่อน กดแล้วขยายเป็นช่องพิมพ์เอง มีข้อความค้างอยู่ก็คงขยายไว้ */
  var SX_ON='.search-box:focus-within,.search-box:has(input:not(:placeholder-shown))';
  css+=
  '.search-box[data-sx]{box-sizing:border-box;position:relative;gap:6px;width:34px;height:34px;min-width:0!important;max-width:none!important;flex:none!important;padding:0 7px;overflow:hidden;cursor:pointer;background:transparent;border:1px solid transparent;border-bottom:2px solid transparent;border-radius:7px;color:var(--ink-600,#5b6475);transition:width .18s ease}'+
  '.search-box[data-sx] svg.sx-i{width:19px;height:19px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}'+
  '.search-box[data-sx] input{width:0;min-width:0;opacity:0;padding:0}'+
  '.search-box[data-sx]:hover{color:var(--orange-600,#e0620f)}'+
  SX_ON.split(',').map(function(s){return s.replace('.search-box','.search-box[data-sx]');}).join(',')+'{width:230px;overflow:visible;cursor:text;color:var(--orange-600,#e0620f);border-radius:0;border-bottom-color:var(--orange-600,#e0620f)}'+
  SX_ON.split(',').map(function(s){return s.replace('.search-box','.search-box[data-sx]')+' input';}).join(',')+'{width:100%;opacity:1}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  var SX_SVG='<svg class="sx-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  function sxFill(box){
    if(box.hasAttribute('data-sx'))return;
    var inp=box.querySelector('input');if(!inp)return;
    [].slice.call(box.childNodes).forEach(function(n){
      if(n===inp||n.contains&&n.contains(inp))return;
      if(n.nodeType===3&&n.nodeValue.trim().replace('🔍','')==='')box.removeChild(n);
      else if(n.nodeType===1&&n.classList.contains('emj')&&/🔍/.test(n.textContent+(n.querySelector('img')?n.querySelector('img').alt:'')))box.removeChild(n);
    });
    box.insertAdjacentHTML('afterbegin',SX_SVG);
    box.setAttribute('data-sx','');
    var t=inp.getAttribute('placeholder');if(t&&!inp.getAttribute('aria-label'))inp.setAttribute('aria-label',t);
    box.addEventListener('click',function(e){if(e.target!==inp&&!e.target.closest('.ac-suggest'))inp.focus();});
  }

  function svg(n){return '<svg class="bs-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(P[n]||'')+'</svg>';}
  function fill(el){
    var n=el.getAttribute('data-ic');
    if(n&&P[n]&&!el.querySelector(':scope>svg.bs-i')) el.insertAdjacentHTML('afterbegin',svg(n));
    var t=el.getAttribute('data-tip')||(el.classList.contains('btn-ic')?el.getAttribute('title'):null);
    if(t){el.setAttribute('data-tip',t);if(el.hasAttribute('title'))el.removeAttribute('title');if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',t);}
  }
  function scan(root){
    if(!root||!root.querySelectorAll) return;
    if(root.matches&&root.matches('[data-ic],.btn-ic'))fill(root);
    root.querySelectorAll('[data-ic],.btn-ic').forEach(fill);
    if(root.matches&&root.matches('.search-box'))sxFill(root);
    root.querySelectorAll('.search-box').forEach(sxFill);
  }
  window.BtnStd={icon:svg,scan:scan,
    /* ปุ่มส้มแบบแยกเมนู: BtnStd.toggleMenu(this) บนปุ่ม ▾ */
    toggleMenu:function(b){var m=b.parentNode.querySelector('.bs-menu');if(m)m.classList.toggle('open');},
    closeMenus:function(){document.querySelectorAll('.bs-menu.open').forEach(function(m){m.classList.remove('open');});}};
  document.addEventListener('click',function(e){if(!e.target.closest||!e.target.closest('.btn-split'))BtnStd.closeMenus();});
  function init(){scan(document.body);
    new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1)scan(n);});});}).observe(document.body,{childList:true,subtree:true});}
  if(document.body)init();else document.addEventListener('DOMContentLoaded',init);
})();
