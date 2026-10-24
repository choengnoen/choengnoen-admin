/* ============================================================
   table-scroll-standard.js — มาตรฐานแถบเลื่อนขึ้น-ลงของตาราง (ไฟล์เดียวกันใช้ร่วมทุกหน้า)
   ------------------------------------------------------------
   แบบเดียวกับตาราง "ฐานข้อมูลบุคลากร" (choengnoen1-saraban.html):
     1) แถบเลื่อนบาง 8px สีเทา ไม่มีปุ่มลูกศรบน/ล่าง
     2) แถบเลื่อนเริ่ม "ใต้" หัวตาราง และจบ "เหนือ" แถวรวม (tfoot) ถ้าแถวรวมตรึงไว้ — ไม่เลยขึ้นไปทับแถบหัว/แถบล่าง
     3) ช่องเหนือ/ใต้แถบเลื่อนระบายสีเดียวกับหัวตาราง/แถวรวม ให้ดูต่อเนื่องเป็นแถบเดียวกัน

   ใช้อัตโนมัติกับทุกตาราง (รวมที่สร้างใหม่ในอนาคต) ที่:
     - มี <thead> ตรึงไว้ (th เป็น position:sticky — ค่าเริ่มต้นของทุกหน้า)
     - อยู่ในกรอบที่เลื่อนขึ้น-ลงได้ (กรอบที่ครอบ <table> โดยตรงมี max-height + overflow-y:auto)
   ความสูงหัว/ท้ายตารางวัดจริงทุกครั้งที่ตารางเปลี่ยน (MutationObserver + resize) จึงใช้ได้กับหัวตารางหลายแถว
   หมายเหตุ: Firefox ไม่รองรับการเว้นระยะแถบเลื่อน — จะเห็นแถบเลื่อนบางเต็มความสูงกรอบตามเดิม
   ============================================================ */
(function(){
  if (window.TableScrollStd) return;

  var CSS = [
    /* Chrome จะไม่ใช้ ::-webkit-scrollbar ถ้าตั้ง scrollbar-width/color ไว้ จึงต้องคืนเป็น auto (เฉพาะเบราว์เซอร์ที่รองรับ) */
    '@supports selector(::-webkit-scrollbar){.tss{scrollbar-width:auto !important;scrollbar-color:auto !important}}',
    '.tss::-webkit-scrollbar{width:8px;height:8px}',
    '.tss::-webkit-scrollbar-button{display:none;width:0;height:0}',
    '.tss::-webkit-scrollbar-track{background:transparent}',
    '.tss::-webkit-scrollbar-track:vertical{margin-top:var(--tss-head,0px);margin-bottom:var(--tss-foot,0px)}',
    '.tss::-webkit-scrollbar-thumb{background:#c3cad3;border-radius:8px}',
    '.tss::-webkit-scrollbar-thumb:hover{background:#9aa6b2}',
    '.tss::-webkit-scrollbar-corner{background:transparent}',
    '.tss{background-image:' +
      'linear-gradient(to bottom,var(--tss-hbg) calc(var(--tss-head) - var(--tss-hlw)),var(--tss-hl) calc(var(--tss-head) - var(--tss-hlw))),' +
      'linear-gradient(to bottom,var(--tss-fl) var(--tss-flw),var(--tss-fbg) var(--tss-flw)) !important;' +
      'background-size:100% var(--tss-head),100% var(--tss-foot) !important;' +
      'background-position:top,bottom !important;background-repeat:no-repeat !important;background-attachment:scroll !important}'
  ].join('\n');

  function injectCSS(){
    if (document.getElementById('tss-style')) return;
    var st = document.createElement('style');
    st.id = 'tss-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function setVar(el, name, val){
    if (el.style.getPropertyValue(name) !== val) el.style.setProperty(name, val);
  }

  function apply(table){
    var wrap = table.parentElement;
    if (!wrap || wrap === document.body) return;
    var cs = getComputedStyle(wrap);
    var scrollY = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && wrap.scrollHeight > wrap.clientHeight + 1;
    var th = table.tHead && table.tHead.querySelector('th');
    var thCs = th && getComputedStyle(th);
    if (!scrollY || !thCs || thCs.position !== 'sticky'){
      if (wrap.classList.contains('tss')) wrap.classList.remove('tss');
      return;
    }
    // ความสูงตอนหัวตารางตรึงอยู่บนสุดของกรอบ (ระยะ top ของ sticky + ความสูง thead) — ใช้ได้แม้มีเนื้อหาอื่นอยู่เหนือตาราง
    var headH = Math.round((parseFloat(thCs.top) || 0) + table.tHead.getBoundingClientRect().height);
    var td = table.tFoot && table.tFoot.querySelector('td,th');
    var tdCs = td && getComputedStyle(td);
    var footH = (tdCs && tdCs.position === 'sticky') ? table.tFoot.offsetHeight : 0;
    setVar(wrap, '--tss-head', headH + 'px');
    setVar(wrap, '--tss-hbg', thCs.backgroundColor);
    setVar(wrap, '--tss-hl', thCs.borderBottomColor);
    setVar(wrap, '--tss-hlw', (parseFloat(thCs.borderBottomWidth) || 0) + 'px');
    setVar(wrap, '--tss-foot', footH + 'px');
    setVar(wrap, '--tss-fbg', tdCs ? tdCs.backgroundColor : 'transparent');
    setVar(wrap, '--tss-fl', tdCs ? tdCs.borderTopColor : 'transparent');
    setVar(wrap, '--tss-flw', (tdCs ? (parseFloat(tdCs.borderTopWidth) || 0) : 0) + 'px');
    if (!wrap.classList.contains('tss')) wrap.classList.add('tss');
  }

  function scan(){
    var tables = document.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) if (tables[i].tHead) apply(tables[i]);
  }

  var queued = false;
  function queue(){
    if (queued) return;
    queued = true;
    // ใช้ setTimeout ไม่ใช้ requestAnimationFrame — rAF หยุดทำงานตอนแท็บถูกซ่อน ทำให้ค้างไม่ตรวจอีกเลย
    setTimeout(function(){ queued = false; scan(); }, 50);
  }

  function start(){
    injectCSS();
    scan();
    new MutationObserver(queue).observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class','style','hidden']});
    window.addEventListener('resize', queue);
    window.addEventListener('load', queue);
  }

  window.TableScrollStd = { refresh: scan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
