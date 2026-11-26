/* ============================================================
   ติดตามสัญญาหลังรับพื้นที่คืน (เพิ่ม 26 พ.ย. 2569) — ใช้ร่วมกัน 2 หน้า
   - choengnoen0-main.html (แจ้งเตือน) และ choengnoen2-statistics.html (แท็บงานสัญญา)
   - เกณฑ์เตือนอยู่ที่ไฟล์นี้ที่เดียว แก้ที่นี่แล้วทั้ง 2 หน้าเปลี่ยนตาม
   ฟิลด์ที่บันทึกได้ (ผู้บริหารหรือเจ้าหน้าที่ที่เห็นงานสัญญา — rules: isContractFollowUpOnly):
     reflNotify12 / reflNotify24 = วันที่หมวดทำหนังสือแจ้งแขวง ขอวัดค่าสะท้อนแสง รอบ 12 / 24 เดือน
     damageCheckDate = วันที่ตรวจความเสียหายล่าสุด · damageResult = 'ok' | 'repair' | 'fixed'
   ============================================================ */
(function(){
  'use strict';
  const MS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const RESULTS = { ok:'ไม่พบความเสียหาย', repair:'พบความเสียหาย แจ้งผู้รับจ้างซ่อมแล้ว', fixed:'ผู้รับจ้างซ่อมเสร็จแล้ว' };
  // เกณฑ์ (วัน / เดือน)
  const REFL_PREP_DAYS = 60;   // เหลือ ≤ 60 วัน และยังไม่แจ้งแขวง → ส้ม "เตรียมทำหนังสือแจ้งแขวง"
  const REFL_URGENT_DAYS = 45; // เหลือ ≤ 45 วัน และยังไม่แจ้งแขวง → แดง "ต้องส่งหนังสือแจ้งแขวงแล้ว"
  const PERIODIC_MONTHS = 6;   // ตรวจความเสียหายระหว่างค้ำประกันทุก 6 เดือน
  const PERIODIC_LEAD_DAYS = 14;

  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const iso10 = v => { const s = String(v||'').slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; };
  const pad = n => String(n).padStart(2,'0');
  function todayIso(){ const d = new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function fd(iso){ iso = iso10(iso); if(!iso) return '—'; const [y,m,d] = iso.split('-').map(Number); return d+' '+MS[m-1]+' '+String(y+543).slice(2); }
  // บวกเดือนแบบปฏิทิน (เหมือน ctAddMonths ในระบบที่ 2)
  function addM(iso, n){ const [y,m,d] = iso.split('-').map(Number); const last = new Date(y, m-1+n+1, 0).getDate(); const r = new Date(y, m-1+n, Math.min(d,last)); return r.getFullYear()+'-'+pad(r.getMonth()+1)+'-'+pad(r.getDate()); }
  function daysTo(iso, t){ return Math.round((new Date(iso+'T00:00:00') - new Date((t||todayIso())+'T00:00:00'))/86400000); }
  const isTrue = v => v===true || v==='true';
  const dayTxt = d => d<0 ? 'เลยมา '+(-d)+' วัน' : d===0 ? 'วันนี้' : 'อีก '+d+' วัน';

  /* วัดค่าสะท้อนแสง: รอบแรกที่ยังไม่วัด → {round, date, d, notified, level, text, sub}
     level: 'red' | 'amber' | 'blue' | null (ยังไม่ต้องเตือน) · null ทั้งก้อน = สัญญานี้ไม่ต้องวัด/ยังไม่ส่งงาน */
  function refl(c, t){
    t = t || todayIso();
    const deliv = iso10(c.deliveryDate);
    if(!isTrue(c.reflectNeeded) || !deliv || c.status==='ยกเลิกสัญญา') return null;
    const m = [12,24].find(x=>!iso10(c['refl'+x+'Done']));
    if(!m) return {done:true, level:null, text:'วัดค่าสะท้อนแสงครบแล้ว', sub:'', d:null};
    const date = addM(deliv, m), d = daysTo(date, t), notified = iso10(c['reflNotify'+m]);
    const base = {round:m, date, d, notified};
    if(d < 0) return Object.assign(base, {level:'red', text:'เลยกำหนดวัดค่าสะท้อนแสง',
      sub:`รอบ ${m} เดือน · ครบ ${fd(date)} · ${dayTxt(d)} · ` + (notified ? `แจ้งแขวงแล้ว ${fd(notified)}` : 'ยังไม่แจ้งแขวง')});
    if(notified) return Object.assign(base, {level:'blue', text:'รอเขตชลบุรีมาวัดค่าสะท้อนแสง',
      sub:`รอบ ${m} เดือน · ครบ ${fd(date)} · ${dayTxt(d)} · แจ้งแขวง ${fd(notified)} (ผ่านมา ${Math.max(0,-daysTo(notified,t))} วัน)`});
    const sub = `ขอวัดค่าสะท้อนแสง รอบ ${m} เดือน · ครบ ${fd(date)} · ${d===0?'วันนี้':'เหลือ '+d+' วัน'}`;
    if(d <= REFL_URGENT_DAYS) return Object.assign(base, {level:'red', text:'ต้องส่งหนังสือแจ้งแขวงแล้ว', sub});
    if(d <= REFL_PREP_DAYS) return Object.assign(base, {level:'amber', text:'เตรียมทำหนังสือแจ้งแขวง', sub});
    return Object.assign(base, {level:null, text:'วัดค่าสะท้อนแสง', sub:`รอบ ${m} เดือน · ${fd(date)} · ${dayTxt(d)}`});
  }

  /* ตรวจความเสียหายระหว่างค้ำประกัน / ก่อนคืนค้ำ → {level, text, sub, d, done}
     null = ไม่อยู่ในระยะค้ำประกัน (ยังไม่ส่งงาน / พ้นวันคืนค้ำแล้ว / ยกเลิก) */
  function damage(c, t){
    t = t || todayIso();
    const w = iso10(c.warrantyEnd), base = iso10(c.acceptDate) || iso10(c.deliveryDate);
    if(!w || !base || c.status==='ยกเลิกสัญญา' || t > w || t < base) return null;
    const d = daysTo(w, t), winStart = addM(w, -3);
    const chk = iso10(c.damageCheckDate), res = c.damageResult || '';
    const reflHint = isTrue(c.reflectNeeded) ? ' · ใช้ผลวัดค่าสะท้อนแสงประกอบ' : '';
    if(chk && res==='repair') return {level: d<=30 ? 'amber' : 'blue', text:'รอผู้รับจ้างซ่อม',
      sub:`ตรวจพบ ${fd(chk)} แจ้งซ่อมแล้ว · คืนค้ำ ${fd(w)} · ${d===0?'วันนี้':'เหลือ '+d+' วัน'}`, d};
    if(chk && chk >= winStart && (res==='ok' || res==='fixed')) return {level:null, done:true, text:'ตรวจแล้ว พร้อมคืนค้ำประกัน',
      sub:`${RESULTS[res]} (${fd(chk)}) · คืนค้ำ ${fd(w)} · ${dayTxt(d)}`, d};
    const sub = `คืนค้ำ ${fd(w)} · ${d===0?'วันนี้':'เหลือ '+d+' วัน'}${chk?' · ตรวจล่าสุด '+fd(chk):''}${reflHint}`;
    if(t >= addM(w, -1)) return {level:'red', text:'ต้องตรวจความเสียหาย / แจ้งซ่อมด่วน', sub, d};
    if(t >= addM(w, -2)) return {level:'amber', text:'ตรวจความเสียหายก่อนคืนค้ำประกัน', sub, d};
    if(t >= winStart) return {level:'blue', text:'วางแผนตรวจความเสียหายก่อนคืนค้ำ', sub, d};
    // ก่อนเข้าช่วง 3 เดือนสุดท้าย: ตรวจตามรอบทุก 6 เดือน นับจากวันตรวจล่าสุด (ยังไม่เคยตรวจ = นับจากวันส่งงาน/ตรวจรับ)
    const last = chk && chk > base ? chk : base, due = addM(last, PERIODIC_MONTHS);
    if(due < winStart){
      const dd = daysTo(due, t);
      if(dd < 0) return {level:'amber', text:'เลยรอบตรวจความเสียหาย 6 เดือน', sub:`ครบรอบ ${fd(due)} · ${dayTxt(dd)} · คืนค้ำ ${fd(w)}`, d:dd};
      if(dd <= PERIODIC_LEAD_DAYS) return {level:'blue', text:'ตรวจความเสียหายตามรอบ 6 เดือน', sub:`ครบรอบ ${fd(due)} · ${dayTxt(dd)} · คืนค้ำ ${fd(w)}`, d:dd};
    }
    return {level:null, text:'คืนค้ำประกัน', sub:`${fd(w)} · ${dayTxt(d)}${chk?' · ตรวจล่าสุด '+fd(chk)+' ('+(RESULTS[res]||'')+')':''}`, d};
  }

  /* ---------- หน้าต่างบันทึกการติดตาม ---------- */
  function canEdit(){ return !!(window.FBL && FBL.canFollowUpContract && FBL.canFollowUpContract()); }
  let styled = false;
  function addStyle(){
    if(styled) return; styled = true;
    const st = document.createElement('style');
    st.textContent = `.ctf-sec{margin-bottom:16px;} .ctf-sec h4{margin:0 0 8px;font-size:14px;color:var(--ink-900,#182430);}
      .ctf-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;} .ctf-row > label{min-width:120px;font-size:13px;color:var(--ink-600,#4d5a66);}
      .ctf-row input,.ctf-row select{flex:1;min-width:160px;padding:8px 10px;border:1px solid #d5dbe1;border-radius:8px;font:inherit;font-size:14px;}
      .ctf-due{font-size:12px;color:var(--ink-400,#8792a0);width:100%;margin:-4px 0 4px 130px;}
      .ctf-head{font-size:13px;color:var(--ink-600,#4d5a66);margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #e6e9ed;}
      .ctf-head b{color:var(--ink-900,#182430);} .ctf-th{min-width:78px;font-size:13px;font-weight:600;color:var(--navy-800,#123a5e);} .ctf-err{color:var(--danger,#c1402f);font-size:13px;margin-top:6px;min-height:1em;}
      @media (max-width:520px){ .ctf-due{margin-left:0;} }`;
    document.head.appendChild(st);
  }
  /* c = แถวสัญญา (ฟิลด์ชื่อเดียวกับใน Firestore) · onSaved(fields) เรียกหลังบันทึกสำเร็จ */
  function open(c, onSaved){
    if(!canEdit()){ alert('ไม่มีสิทธิ์บันทึกการติดตามสัญญา'); return; }
    addStyle();
    const t = todayIso(), deliv = iso10(c.deliveryDate), reflOn = isTrue(c.reflectNeeded) && !!deliv;
    const w = iso10(c.warrantyEnd);
    const reflRow = m => {
      const done = iso10(c['refl'+m+'Done']), due = addM(deliv, m);
      return `<div class="ctf-row"><label for="ctf-n${m}">รอบ ${m} เดือน</label><input type="date" id="ctf-n${m}" max="${t}" value="${esc(iso10(c['reflNotify'+m]))}"></div>
        <div class="ctf-due">ครบกำหนดวัด ${fd(due)}${done?' · <b style="color:var(--success,#1c8a53)">วัดแล้ว '+fd(done)+'</b>':''}</div>`;
    };
    const body = `<div class="ctf-head"><b>${esc(c.contractNo||'(ไม่ระบุเลขสัญญา)')}</b> ${esc(c.name||'')}</div>`
      + (reflOn ? `<div class="ctf-sec"><h4>วันที่แจ้งแขวง (ขอวัดค่าสะท้อนแสง)</h4>${reflRow(12)}${reflRow(24)}</div>` : '')
      + (w ? `<div class="ctf-sec"><h4>ตรวจความเสียหาย</h4>
          <div class="ctf-row"><label for="ctf-dc">วันที่ตรวจ</label><input type="date" id="ctf-dc" max="${t}" value="${esc(iso10(c.damageCheckDate))}"></div>
          <div class="ctf-row"><label for="ctf-dr">ผลตรวจ</label><select id="ctf-dr"><option value="">— เลือก —</option>${Object.keys(RESULTS).map(k=>`<option value="${k}"${c.damageResult===k?' selected':''}>${RESULTS[k]}</option>`).join('')}</select></div>
          <div class="ctf-due">คืนค้ำประกัน ${fd(w)}</div></div>` : '')
      + (!reflOn && !w ? '<div>สัญญานี้ยังไม่มีวันส่งงาน / วันคืนค้ำประกัน จึงยังไม่มีรายการให้ติดตาม</div>' : '')
      + '<div class="ctf-err" id="ctf-err"></div>';
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.innerHTML = `<div class="modal-box modal-s"><div class="modal-head"><h3>บันทึกการติดตามสัญญา</h3><button type="button" class="modal-close" aria-label="ปิด">✕</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot" style="display:flex;justify-content:flex-end;gap:8px;"><button type="button" class="btn btn-ghost" data-x="cancel">ยกเลิก</button>${reflOn||w?'<button type="button" class="btn btn-primary" data-ic="save" data-x="save">บันทึก</button>':''}</div></div>`;
    const close = ()=>ov.remove();
    ov.querySelector('.modal-close').onclick = close;
    ov.querySelector('[data-x="cancel"]').onclick = close;
    ov.addEventListener('click', e=>{ if(e.target===ov) close(); });
    const saveBtn = ov.querySelector('[data-x="save"]');
    if(saveBtn) saveBtn.onclick = async ()=>{
      const err = ov.querySelector('#ctf-err'); err.textContent = '';
      const val = id => { const el = ov.querySelector('#'+id); return el ? el.value.trim() : null; };
      const f = {};
      if(reflOn){
        for(const m of [12,24]){
          const v = val('ctf-n'+m);
          if(v && v > t){ err.textContent = 'วันที่แจ้งแขวงต้องไม่เกินวันนี้'; return; }
          if(v && v < deliv){ err.textContent = 'วันที่แจ้งแขวงต้องไม่ก่อนวันที่ส่งงาน'; return; }
          f['reflNotify'+m] = v || '';
        }
      }
      if(w){
        const dc = val('ctf-dc'), dr = val('ctf-dr');
        if(dc && dc > t){ err.textContent = 'วันที่ตรวจต้องไม่เกินวันนี้'; return; }
        if(dc && !dr){ err.textContent = 'กรุณาเลือกผลตรวจ'; return; }
        if(dr && !dc){ err.textContent = 'กรุณาระบุวันที่ตรวจ'; return; }
        f.damageCheckDate = dc || ''; f.damageResult = dr || '';
      }
      saveBtn.disabled = true; const orig = saveBtn.textContent; saveBtn.textContent = 'กำลังบันทึก...';
      try{ await FBL.saveContractFollowUp(c.id, f); }
      catch(e){ err.textContent = 'บันทึกไม่สำเร็จ: ' + (e && e.message || e); saveBtn.disabled = false; saveBtn.textContent = orig; return; }
      close();
      if(typeof onSaved === 'function') onSaved(f);
    };
    // แสดงวันที่แบบไทยข้างช่องวันที่ (ช่อง date ของเบราว์เซอร์อาจแสดงเป็น ค.ศ./เดือน/วัน)
    ov.querySelectorAll('input[type="date"]').forEach(inp=>{
      const lb = document.createElement('span'); lb.className = 'ctf-th';
      const sync = ()=>{ lb.textContent = inp.value ? fd(inp.value) : 'ยังไม่ระบุ'; };
      inp.addEventListener('input', sync); inp.addEventListener('change', sync); sync();
      inp.insertAdjacentElement('afterend', lb);
    });
    document.body.appendChild(ov);
  }

  window.CTFollow = { refl, damage, open, canEdit, RESULTS, fd, todayIso };
})();
