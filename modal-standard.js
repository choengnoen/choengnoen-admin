/* ============================================================
   modal-standard.js — มาตรฐานหน้าต่างโมดัล "ระบบงานบริหารหมวด" (ใช้ร่วมกันทั้ง 5 หน้า)
   ------------------------------------------------------------
   โมดัลทุกตัว (รวมที่สร้างใหม่ในอนาคต) จะได้หน้าตาเดียวกันอัตโนมัติ ถ้าเขียนโครงตามนี้:

     <div class="modal-overlay hidden" id="xxx-overlay">
       <div class="modal-box">
         <div class="modal-head"> …ชื่อเรื่อง… <button class="modal-close">✕</button></div>
         <div class="modal-body"> …เนื้อหา… </div>
         <div class="modal-foot">
           <button class="btn btn-danger">ลบ</button>          ← ปุ่มลบ: ไปชิดซ้ายเอง
           <button class="btn btn-ghost">ปิด</button>          ← ปุ่มปิด/ยกเลิก + ปุ่มหลัก: ชิดขวาเอง
           <button class="btn btn-primary">แก้ไข</button>      ← ปุ่มหลักอยู่ขวาสุดเสมอ
         </div>
       </div>
     </div>

   สิ่งที่ไฟล์นี้บังคับให้เหมือนกัน
     1) กล่องโค้งมน 20px + แถบส้มเรืองแสงวิ่งที่ขอบบน (สไตล์เดียวกับเส้นใต้หัวแท็บ)
     2) หัวกับท้ายตรึงอยู่กับที่ — เฉพาะ "เนื้อหา" (.modal-body) เลื่อนขึ้น-ลง แถบเลื่อนอยู่ระหว่างหัวกับท้าย ไม่ทับหัว/มุมโค้ง
     3) ปุ่มลบชิดซ้าย · ปุ่มปิด/ยกเลิก/แก้ไข/บันทึก ชิดขวา (ปุ่มหลักขวาสุด)
   ใช้ได้กับ .modal-head / .modal-body / *-foot / *-footer / .dwv-hd / .dwv-body ที่มีอยู่เดิมทุกแบบ
   และตามดูโมดัลที่ถูกสร้าง/เติมเนื้อหาทีหลังด้วย JS ให้เอง (MutationObserver)
   ============================================================ */
(function(){
  if (window.ModalStd) return;

  var CSS = [
    '@keyframes mstdGlow{to{background-position:200% 0}}',

    /* พื้นหลังเบลอ: ไม่เลื่อนทั้งแผ่น + กล่องอยู่กลางจอ */
    'html .modal-overlay{align-items:center;overflow:hidden}',

    /* กล่องโมดัล: โค้งมน + ตัดขอบ + ไม่สูงเกินจอ */
    '.modal-overlay .modal-box.mstd-box{position:relative;border-radius:20px;overflow:hidden !important;',
    '  max-height:calc(100vh - 40px) !important;max-height:calc(100dvh - 40px) !important}',

    /* แถบส้มเรืองแสงที่ขอบบน — สูตรเดียวกับ .nav-item.active::after (เส้นใต้หัวแท็บ) */
    '.modal-overlay .modal-box.mstd-box::before{content:"";position:absolute;left:0;right:0;top:0;height:4px;z-index:8;pointer-events:none;',
    '  background:linear-gradient(90deg,#e0620f,#f07a1f,#ffa24d,#f07a1f,#e0620f);background-size:200% 100%;',
    '  animation:mstdGlow 2.4s linear infinite;box-shadow:0 0 8px rgba(240,122,31,.6)}',
    '@media(prefers-reduced-motion:reduce){.modal-overlay .modal-box.mstd-box::before{animation:none}}',

    /* โมดัลที่มีหัว+เนื้อหา: หัว/ท้ายตรึง เนื้อหาเลื่อน */
    '.modal-overlay .modal-box.mstd-split{display:flex !important;flex-direction:column !important}',
    '.mstd-split > *{flex:none}',
    '.mstd-split > .mstd-body{flex:1 1 auto !important;min-height:0 !important;overflow-y:auto !important;overflow-x:hidden !important;',
    '  scrollbar-width:thin;scrollbar-color:#c3cad3 transparent;overscroll-behavior:contain}',
    '.mstd-body::-webkit-scrollbar{width:8px}',
    '.mstd-body::-webkit-scrollbar-track{background:transparent;margin:4px 0}',
    '.mstd-body::-webkit-scrollbar-thumb{background:#c3cad3;border-radius:8px}',
    '.mstd-body::-webkit-scrollbar-thumb:hover{background:#9aa6b2}',

    /* โมดัลเล็ก (บันทึกสำเร็จ/ยืนยัน/แจ้งเตือน ที่ไม่มีหัว): เลื่อนทั้งกล่องถ้าสูงเกิน */
    '.modal-overlay .modal-box.mstd-plain{overflow-x:hidden !important;overflow-y:auto !important}',

    /* ปุ่มท้ายโมดัล: ลบ = ซ้ายสุด · ปุ่มหลัก = ขวาสุด (ยกเว้นแถบขั้นตอนของใบสั่งการที่มีปุ่มย้อนกลับ/ถัดไปของตัวเอง) */
    '.mstd-foot:not(.dw-wizard-footer){display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.mstd-foot:not(.dw-wizard-footer) > .mstd-del{order:-1;margin-right:auto}',
    '.mstd-foot:not(.dw-wizard-footer) > .btn-primary{order:5}',
    '.mstd-foot.mstd-hoisted{padding:14px 22px;border-top:1px solid var(--line,#e3e6ea);background:var(--paper-50,#f8f9fb);justify-content:flex-end}',
    '.mstd-foot:not(.dw-wizard-footer):not(.dwv-foot):not(.ma-foot):not(.modal-plain-footer){justify-content:flex-end}'
  ].join('\n');

  function injectCss(){
    if (document.getElementById('modal-standard-css')) return;
    var st = document.createElement('style');
    st.id = 'modal-standard-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function hasTok(el, re){
    var cl = el.classList;
    for (var i = 0; i < cl.length; i++) if (re.test(cl[i])) return true;
    return false;
  }
  var RE_HEAD = /^(modal-head|dwv-hd)$/;
  var RE_BODY = /^(modal-body|dwv-body)$/;
  var RE_FOOT = /(^|-)foot(er)?$/;

  function btnText(b){
    return (b.textContent || '').replace(/^[^A-Za-z0-9฀-๿]+/, '').trim();
  }
  function isDelete(b){
    /* นับเป็นปุ่มลบเมื่อข้อความขึ้นต้น "ลบ" / id มี delete|remove / class crew-delete-btn — ไม่ดูสีแดงอย่างเดียว เพราะปุ่ม "ตกลง/ยืนยัน" ในกล่องยืนยันก็สีแดง ต้องอยู่ขวา */
    if (b.classList.contains('crew-delete-btn')) return true;
    if (/delete|remove/i.test(b.id || '')) return true;
    return /^ลบ/.test(btnText(b));
  }

  function normFoot(foot){
    if (foot.classList.contains('dw-wizard-footer')) return;
    var btns = foot.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++){
      var b = btns[i];
      if (!isDelete(b)) continue;
      b.classList.add('mstd-del');
      if (b.parentNode !== foot) foot.insertBefore(b, foot.firstChild);   /* อยู่ในกล่องซ้อน → ย้ายขึ้นมาให้ชิดซ้ายจริง */
    }
  }

  /* แถวปุ่มที่ถูกเขียนฝังท้าย .modal-body (เช่น <div style="display:flex;justify-content:flex-end">[ลบ][บันทึก]</div>)
     → ยกออกมาเป็นท้ายโมดัลจริง จะได้ตรึงอยู่กับที่และเรียงปุ่มตามมาตรฐานเหมือนโมดัลอื่น */
  function findActionRow(body){
    var last = body.lastElementChild;
    while (last && last.classList.contains('mstd-sentinel')) last = last.previousElementSibling;
    if (!last || last.tagName !== 'DIV') return null;
    var st = last.getAttribute('style') || '';
    if (!/justify-content:\s*(flex-end|space-between)/.test(st)) return null;
    var kids = last.children;
    if (!kids.length) return null;
    for (var i = 0; i < kids.length; i++){
      if (kids[i].tagName === 'BUTTON') continue;
      if (kids[i].tagName === 'DIV' && kids[i].children.length && !kids[i].querySelector(':scope > :not(button)')) continue;
      return null;
    }
    return last;
  }
  function hoistActions(box, body){
    var old = box.querySelector(':scope > .mstd-hoisted');
    if (old){
      if (body.querySelector(':scope > .mstd-sentinel')) return old;   /* เนื้อหายังเป็นชุดเดิม ปุ่มที่ยกออกยังใช้ได้ */
      old.remove();                                                      /* เนื้อหาถูกวาดใหม่แล้ว → ปุ่มเก่าค้าง ลบทิ้ง */
    }
    var row = findActionRow(body);
    if (!row) return null;
    var foot = document.createElement('div');
    foot.className = 'modal-foot mstd-hoisted';
    while (row.firstChild) foot.appendChild(row.firstChild);
    row.remove();
    var s = document.createElement('i');
    s.className = 'mstd-sentinel';
    s.hidden = true;
    body.appendChild(s);
    body.parentNode.insertBefore(foot, body.nextSibling);
    return foot;
  }

  function normBox(box){
    var kids = Array.prototype.slice.call(box.children);
    var head = null, body = null, foot = null, k;
    for (k = 0; k < kids.length; k++){ if (hasTok(kids[k], RE_HEAD)) { head = kids[k]; break; } }
    for (k = 0; k < kids.length; k++){ if (hasTok(kids[k], RE_BODY)) { body = kids[k]; break; } }
    for (k = kids.length - 1; k >= 0; k--){
      var c = kids[k];
      if (c === head || c === body) continue;
      if (hasTok(c, RE_FOOT) || RE_FOOT.test(c.id || '')) { foot = c; break; }
    }
    /* มีหัวแต่ไม่มี .modal-body → ห่อเนื้อหาที่เหลือให้อัตโนมัติ (เนื้อหาโมดัลที่สร้างด้วย JS) */
    if (head && !body){
      var wrap = document.createElement('div');
      wrap.className = 'modal-body';
      wrap.style.padding = '20px 22px 22px';
      var mv = [];
      kids.forEach(function(c){ if (c !== head && c !== foot && !hasTok(c, /^modal-tabs$/)) mv.push(c); });
      if (mv.length){
        box.insertBefore(wrap, mv[0]);
        mv.forEach(function(c){ wrap.appendChild(c); });
        body = wrap;
      }
    }
    box.classList.add('mstd-box');
    if (head && body){
      box.classList.add('mstd-split');
      box.classList.remove('mstd-plain');
      head.classList.add('mstd-head');
      body.classList.add('mstd-body');
      if (!foot || foot.classList.contains('mstd-hoisted')) foot = hoistActions(box, body);
      if (foot){ foot.classList.add('mstd-foot'); normFoot(foot); }
    } else {
      box.classList.add('mstd-plain');
      box.classList.remove('mstd-split');
    }
  }

  var queued = false;
  function scan(){
    queued = false;
    var boxes = document.querySelectorAll('.modal-overlay .modal-box');
    for (var i = 0; i < boxes.length; i++){
      try { normBox(boxes[i]); } catch(e){}
    }
  }
  function schedule(){
    if (queued) return;
    queued = true;
    (window.requestAnimationFrame || setTimeout)(scan);
  }

  function start(){
    injectCss();
    scan();
    if (window.MutationObserver){
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }
  }

  window.ModalStd = { scan: scan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
