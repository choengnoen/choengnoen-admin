/* ============================================================
   ติดตามสัญญาหลังรับพื้นที่คืน (เพิ่ม 26 พ.ย. 2569) — ใช้ร่วมกัน 2 หน้า
   - choengnoen0-main.html (แจ้งเตือน) และ choengnoen2-statistics.html (แท็บงานสัญญา)
   - เกณฑ์เตือนอยู่ที่ไฟล์นี้ที่เดียว แก้ที่นี่แล้วทั้ง 2 หน้าเปลี่ยนตาม
   ฟิลด์ที่บันทึกได้ (ผู้บริหารหรือเจ้าหน้าที่ที่เห็นงานสัญญา — rules: isContractFollowUpOnly):
     reflNotify12 / reflNotify24 = วันที่หนังสือหมวดแจ้งแขวง ขอวัดค่าสะท้อนแสง รอบ 12 / 24 เดือน
       (แก้ 26 พ.ย. 2569: หมวดไม่รู้วันที่เขตมาวัดจริง → ส่งหนังสือแจ้งแขวงแล้ว = จบรอบนั้น · refl12Done/refl24Done เดิมยังนับว่าจบรอบ)
     damageCheckDate = 'ok' → วันที่ตรวจ · 'repair' → วันที่หนังสือแจ้งแขวงให้ผู้รับจ้างซ่อม
     damageResult = 'ok' | 'repair' ('fixed' = ข้อมูลเดิม แสดงได้ แต่ไม่มีให้เลือกแล้ว เพราะหมวดไม่รู้วันซ่อมเสร็จ)
   ============================================================ */
(function(){
  'use strict';
  const MS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const RESULTS = { ok:'ไม่พบความเสียหาย', repair:'พบความเสียหาย แจ้งแขวงแล้ว', fixed:'ผู้รับจ้างซ่อมเสร็จแล้ว' };
  const CHOICES = ['ok','repair']; // ตัวเลือกในหน้าต่างบันทึก
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
  // วันที่เต็มรูปแบบมาตรฐาน "9 พ.ย. 2569" (ใช้ในหน้าต่างบันทึก)
  function fdl(iso){ iso = iso10(iso); if(!iso) return '—'; const [y,m,d] = iso.split('-').map(Number); return d+' '+MS[m-1]+' '+(y+543); }
  // บวกเดือนแบบปฏิทิน (เหมือน ctAddMonths ในระบบที่ 2)
  function addM(iso, n){ const [y,m,d] = iso.split('-').map(Number); const last = new Date(y, m-1+n+1, 0).getDate(); const r = new Date(y, m-1+n, Math.min(d,last)); return r.getFullYear()+'-'+pad(r.getMonth()+1)+'-'+pad(r.getDate()); }
  function daysTo(iso, t){ return Math.round((new Date(iso+'T00:00:00') - new Date((t||todayIso())+'T00:00:00'))/86400000); }
  const isTrue = v => v===true || v==='true';
  const dayTxt = d => d<0 ? 'เลยมา '+(-d)+' วัน' : d===0 ? 'วันนี้' : 'อีก '+d+' วัน';

  /* วัดค่าสะท้อนแสง: รอบแรกที่ยังไม่แจ้งแขวง → {round, date, d, level, text, sub}
     รอบที่จบแล้ว = มีวันที่หนังสือแจ้งแขวง (หรือวันที่วัดแล้วจากข้อมูลเดิม)
     level: 'red' | 'amber' | null (ยังไม่ต้องเตือน) · null ทั้งก้อน = สัญญานี้ไม่ต้องวัด/ยังไม่ส่งงาน */
  const reflRoundDone = (c, m) => iso10(c['reflNotify'+m]) || iso10(c['refl'+m+'Done']);
  function refl(c, t){
    t = t || todayIso();
    const deliv = iso10(c.deliveryDate);
    if(!isTrue(c.reflectNeeded) || !deliv || c.status==='ยกเลิกสัญญา') return null;
    const m = [12,24].find(x=>!reflRoundDone(c, x));
    if(!m) return {done:true, level:null, text:'แจ้งแขวงขอวัดค่าสะท้อนแสงครบแล้ว', sub:'', d:null};
    const date = addM(deliv, m), d = daysTo(date, t);
    const base = {round:m, date, d};
    if(d < 0) return Object.assign(base, {level:'red', text:'เลยกำหนด ยังไม่แจ้งแขวงขอวัดค่าสะท้อนแสง',
      sub:`รอบ ${m} เดือน · ครบ ${fd(date)} · ${dayTxt(d)}`});
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
    // ตรวจในช่วง 3 เดือนสุดท้ายแล้ว (ไม่พบ หรือพบแล้วส่งหนังสือแจ้งแขวง) = จบงานของหมวด — หมวดไม่รู้วันซ่อมเสร็จ จึงไม่ติดตามต่อ
    if(chk && chk >= winStart && RESULTS[res]) return {level:null, done:true,
      text: res==='repair' ? 'แจ้งแขวงให้ผู้รับจ้างซ่อมแล้ว' : 'ตรวจแล้ว พร้อมคืนค้ำประกัน',
      sub:`${res==='repair' ? 'หนังสือแจ้งแขวง '+fd(chk) : RESULTS[res]+' ('+fd(chk)+')'} · คืนค้ำ ${fd(w)} · ${dayTxt(d)}`, d};
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
    st.textContent = `.ctf-ttl{display:flex;flex-direction:column;gap:5px;min-width:0;}
      .ctf-no{align-self:flex-start;font-size:12.5px;font-weight:600;letter-spacing:.2px;padding:2px 10px;border-radius:999px;background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.22);}
      .ctf-info{position:sticky;top:0;z-index:2;background:var(--surface,#fff);padding:2px 0 12px;margin-bottom:14px;border-bottom:1px solid #e6e9ed;}
      .ctf-name{font-size:15.5px;font-weight:700;line-height:1.45;color:var(--ink-900,#182430);}
      .ctf-parent{display:flex;align-items:flex-start;gap:6px;margin-top:3px;font-size:12.5px;line-height:1.5;color:var(--ink-400,#8792a0);cursor:pointer;}
      .ctf-parent span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .ctf-parent.open span{white-space:normal;} .ctf-parent i{font-style:normal;font-size:10px;line-height:19px;transition:transform .15s;} .ctf-parent.open i{transform:rotate(180deg);}
      .ctf-by{margin-top:5px;font-size:12.5px;color:var(--ink-600,#4d5a66);} .ctf-by b{font-weight:600;color:var(--ink-900,#182430);}
      .ctf-sec{border:1px solid #e3e7eb;border-radius:12px;padding:12px 14px;margin-bottom:12px;}
      .ctf-sec h4{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 10px;font-size:14px;color:var(--ink-900,#182430);}
      .ctf-item + .ctf-item{margin-top:12px;padding-top:12px;border-top:1px dashed #e3e7eb;}
      .ctf-lbl{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:13.5px;font-weight:600;color:var(--ink-700,#33414e);}
      .ctf-item input,.ctf-item select{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #d5dbe1;border-radius:9px;font:inherit;font-size:14px;background:#fff;}
      .ctf-meta{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-top:5px;font-size:12.5px;color:var(--ink-400,#8792a0);}
      .ctf-meta .ok{color:var(--success,#1c8a53);font-weight:600;} .ctf-meta .warn{color:#b26a00;}
      .ctf-meta:has(> .ctf-th:empty:only-child){display:none;}
      .ctf-th{font-weight:600;color:var(--navy-800,#123a5e);white-space:nowrap;}
      .ctf-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:12px;} .ctf-grid .ctf-item + .ctf-item{margin-top:0;padding-top:0;border-top:0;}
      .ctf-bd{flex:none;font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:999px;white-space:nowrap;background:#eef1f4;color:#5b6773;}
      .ctf-bd.green{background:#e3f4ea;color:#17784a;} .ctf-bd.blue{background:#e4eefa;color:#1f5f9e;} .ctf-bd.amber{background:#fdf0dc;color:#a35f00;} .ctf-bd.red{background:#fbe5e2;color:#b2372a;}
      .ctf-modal .modal-foot{border-top:1px solid #e6e9ed;background:var(--surface,#fff);}
      .ctf-err{color:var(--danger,#c1402f);font-size:13px;margin-top:4px;min-height:1em;}
      @media (max-width:560px){ .ctf-grid{grid-template-columns:1fr;} .ctf-grid .ctf-item + .ctf-item{margin-top:12px;} }`;
    document.head.appendChild(st);
  }
  /* c = แถวสัญญา (ฟิลด์ชื่อเดียวกับใน Firestore) · onSaved(fields) เรียกหลังบันทึกสำเร็จ */
  function open(c, onSaved){
    if(!canEdit()){ alert('ไม่มีสิทธิ์บันทึกการติดตามสัญญา'); return; }
    addStyle();
    const t = todayIso(), deliv = iso10(c.deliveryDate), reflOn = isTrue(c.reflectNeeded) && !!deliv;
    const w = iso10(c.warrantyEnd);
    // ป้ายสถานะรอบวัดค่าสะท้อนแสง (เปลี่ยนตามช่องวันที่แจ้งแขวงที่กรอก)
    const reflBadge = (m, notify) => {
      if(notify) return ['green','แจ้งแขวงแล้ว'];
      if(iso10(c['refl'+m+'Done'])) return ['green','วัดแล้ว'];
      const d = daysTo(addM(deliv, m), t);
      if(d < 0) return ['red','เลยกำหนด'];
      if(d <= REFL_URGENT_DAYS) return ['red','ต้องแจ้งแขวง'];
      if(d <= REFL_PREP_DAYS) return ['amber','เตรียมแจ้งแขวง'];
      return ['','รอถึงกำหนด'];
    };
    const reflRow = m => {
      const done = iso10(c['refl'+m+'Done']), due = addM(deliv, m), [cl, tx] = reflBadge(m, iso10(c['reflNotify'+m]));
      return `<div class="ctf-item"><div class="ctf-lbl"><label for="ctf-n${m}">รอบ ${m} เดือน</label><span class="ctf-bd ${cl}" data-bd="${m}">${tx}</span></div>
        <input type="date" id="ctf-n${m}" max="${t}" value="${esc(iso10(c['reflNotify'+m]))}">
        <div class="ctf-meta"><span>ครบกำหนดวัด ${fdl(due)}${done?` · <span class="ok">วัดแล้ว ${fdl(done)}</span>`:''}</span><span class="ctf-th" data-th="ctf-n${m}"></span></div></div>`;
    };
    // ป้ายสถานะตรวจความเสียหาย
    const dmgBadge = () => {
      const r = c.damageResult || '';
      const s = damage(c, t);
      if(s && s.done) return ['green', r==='repair' ? 'แจ้งแขวงแล้ว' : 'ตรวจแล้ว'];
      if(s && s.level) return [s.level, s.level==='blue' ? 'ใกล้ถึงรอบตรวจ' : 'ถึงเวลาตรวจ'];
      if(iso10(c.damageCheckDate) && RESULTS[r]) return ['green', r==='repair' ? 'แจ้งแขวงแล้ว' : 'ตรวจแล้ว'];
      return ['','ยังไม่ถึงรอบ'];
    };
    // ผลตรวจที่เลือกได้ (ข้อมูลเดิม "ซ่อมเสร็จแล้ว" ยังแสดงไว้ ไม่ให้หายตอนบันทึก)
    const dmgOpts = CHOICES.concat(c.damageResult==='fixed' ? ['fixed'] : []);
    const dcLabel = r => r==='repair' ? 'วันที่หนังสือแจ้งแขวง' : 'วันที่ตรวจ';
    // ชื่อสัญญา: แยก "ชื่องาน" (ส่วนท้ายที่ขึ้นต้นด้วย "งาน") ออกจากชื่อโครงการ/กิจกรรมด้านหน้า
    const full = String(c.name||'').replace(/\s+/g,' ').trim();
    let main = full, parent = '';
    const cut = full.search(/ งาน[^ ]*(?!.* งาน)/);
    if(cut > 10){ main = full.slice(cut+1); parent = full.slice(0, cut).replace(/^(งาน)?จ้างเหมา(ทำการ)?\s*/, '').replace(/ (?=กิจกรรม)/g, ' › '); }
    const info = `<div class="ctf-info"><div class="ctf-name" title="${esc(full)}">${esc(main || '(ไม่ระบุชื่องาน)')}</div>`
      + (parent ? `<div class="ctf-parent" title="${esc(parent)}"><span>${esc(parent)}</span><i>▼</i></div>` : '')
      + ((c.contractor || deliv) ? `<div class="ctf-by">${c.contractor?`ผู้รับจ้าง <b>${esc(c.contractor)}</b>`:''}${c.contractor&&deliv?' · ':''}${deliv?`ส่งงาน <b>${fdl(deliv)}</b>`:''}</div>` : '')
      + '</div>';
    const [dcl, dtx] = dmgBadge();
    const body = info
      + (reflOn ? `<div class="ctf-sec"><h4>วันที่หนังสือแจ้งแขวง (ขอวัดค่าสะท้อนแสง)</h4>${reflRow(12)}${reflRow(24)}</div>` : '')
      + (w ? `<div class="ctf-sec"><h4><span>ตรวจความเสียหาย</span><span class="ctf-bd ${dcl}">${dtx}</span></h4>
          <div class="ctf-grid">
            <div class="ctf-item"><div class="ctf-lbl"><label for="ctf-dr">ผลตรวจ</label></div><select id="ctf-dr"><option value="">— เลือก —</option>${dmgOpts.map(k=>`<option value="${k}"${c.damageResult===k?' selected':''}>${RESULTS[k]}</option>`).join('')}</select></div>
            <div class="ctf-item"><div class="ctf-lbl"><label for="ctf-dc" id="ctf-dc-lb">${dcLabel(c.damageResult)}</label></div><input type="date" id="ctf-dc" max="${t}" value="${esc(iso10(c.damageCheckDate))}">
              <div class="ctf-meta"><span class="ctf-th" data-th="ctf-dc"></span></div></div>
          </div>
          <div class="ctf-meta"><span>คืนค้ำประกัน ${fdl(w)} · ${dayTxt(daysTo(w, t))}</span></div></div>` : '')
      + (!reflOn && !w ? '<div>สัญญานี้ยังไม่มีวันส่งงาน / วันคืนค้ำประกัน จึงยังไม่มีรายการให้ติดตาม</div>' : '')
      + '<div class="ctf-err" id="ctf-err"></div>';
    const ov = document.createElement('div');
    ov.className = 'modal-overlay ctf-modal';
    ov.innerHTML = `<div class="modal-box modal-m"><div class="modal-head"><div class="ctf-ttl"><h3>บันทึกการติดตามสัญญา</h3><span class="ctf-no">${esc(c.contractNo||'ไม่ระบุเลขสัญญา')}</span></div><button type="button" class="modal-close" aria-label="ปิด">✕</button></div>
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
          if(v && v > t){ err.textContent = 'วันที่หนังสือแจ้งแขวงต้องไม่เกินวันนี้'; return; }
          if(v && v < deliv){ err.textContent = 'วันที่หนังสือแจ้งแขวงต้องไม่ก่อนวันที่ส่งงาน'; return; }
          f['reflNotify'+m] = v || '';
        }
      }
      if(w){
        const dc = val('ctf-dc'), dr = val('ctf-dr');
        if(dc && dc > t){ err.textContent = dcLabel(dr) + 'ต้องไม่เกินวันนี้'; return; }
        if(dc && !dr){ err.textContent = 'กรุณาเลือกผลตรวจ'; return; }
        if(dr && !dc){ err.textContent = 'กรุณาระบุ' + dcLabel(dr); return; }
        f.damageCheckDate = dc || ''; f.damageResult = dr || '';
      }
      saveBtn.disabled = true; const orig = saveBtn.textContent; saveBtn.textContent = 'กำลังบันทึก...';
      try{ await FBL.saveContractFollowUp(c.id, f); }
      catch(e){ err.textContent = 'บันทึกไม่สำเร็จ: ' + (e && e.message || e); saveBtn.disabled = false; saveBtn.textContent = orig; return; }
      close();
      if(typeof onSaved === 'function') onSaved(f);
    };
    // แสดงวันที่ที่เลือกเป็น พ.ศ. ใต้ช่อง (ช่อง date ของเบราว์เซอร์แสดงเป็น ค.ศ.) + ปรับป้ายสถานะรอบวัดตามค่าที่กรอก
    ov.querySelectorAll('input[type="date"]').forEach(inp=>{
      const lb = ov.querySelector(`[data-th="${inp.id}"]`), m = (inp.id.match(/^ctf-n(\d+)$/)||[])[1];
      const sync = ()=>{
        const v = iso10(inp.value);
        if(lb) lb.textContent = v ? '= ' + fdl(v) : '';
        if(m){
          const bd = ov.querySelector(`[data-bd="${m}"]`), [cl, tx] = reflBadge(+m, v);
          if(bd){ bd.className = 'ctf-bd ' + cl; bd.textContent = tx; }
        }
      };
      inp.addEventListener('input', sync); inp.addEventListener('change', sync); sync();
    });
    // ผลตรวจ "พบความเสียหาย" → ช่องวันที่เป็นวันที่หนังสือแจ้งแขวง
    const drSel = ov.querySelector('#ctf-dr'), dcLb = ov.querySelector('#ctf-dc-lb');
    if(drSel && dcLb) drSel.addEventListener('change', ()=>{ dcLb.textContent = dcLabel(drSel.value); });
    const par = ov.querySelector('.ctf-parent');
    if(par) par.onclick = ()=>par.classList.toggle('open');
    document.body.appendChild(ov);
    // ตรึงชื่องานไว้ชิดขอบบนของส่วนเนื้อหา (ชดเชยระยะ padding ของ modal-body เพื่อไม่ให้เนื้อหาโผล่เหนือชื่อตอนเลื่อน)
    const mb = ov.querySelector('.modal-body'), inf = ov.querySelector('.ctf-info');
    if(mb && inf){ const p = parseFloat(getComputedStyle(mb).paddingTop) || 0; inf.style.top = (-p) + 'px'; inf.style.marginTop = (-p) + 'px'; inf.style.paddingTop = (p + 2) + 'px'; }
  }

  /* ชื่อตอนควบคุมจากฐานข้อมูลกลาง (CNMaster — ทั้งแขวงก่อน แล้วจึงสายทางของหมวด) (เพิ่ม 26 พ.ย. 2569)
     route = เลขทางหลวง · controlNo = เลขตอน (ว่างได้) · km = กม. (กิโลเมตร ใช้หาตอนเมื่อสัญญาเดิมไม่ได้เก็บเลขตอน)
     คืนค่า {controlNo, name} — หาไม่ได้ = name ว่าง (หน้าเว็บแสดงเลขตอนแทน) */
  function section(route, controlNo, km){
    const M = window.CNMaster, out = {controlNo:String(controlNo||''), name:''};
    if(!M) return out;
    let list = [];
    try{ list = [].concat(M.districtRoutes ? M.districtRoutes() : [], M.routes ? M.routes() : []); }catch(e){ return out; }
    const rt = String(route==null?'':route);
    let hit = out.controlNo ? list.find(r=>String(r.highway)===rt && String(r.controlNo||'')===out.controlNo) : null;
    if(!hit && km!=null && !isNaN(km)){
      const m = Number(km)*1000;
      hit = list.find(r=>String(r.highway)===rt && (r.kmRanges||[]).some(p=>m >= p[0]-2 && m <= p[1]+2));
    }
    if(hit){ out.name = String(hit.section||''); if(!out.controlNo) out.controlNo = String(hit.controlNo||''); }
    return out;
  }
  // กม. แบบ "กม.12+345" (รับค่าเป็นกิโลเมตร)
  function km(v){ v = Math.round((Number(v)||0)*1000)/1000; const w = Math.floor(v+1e-9); return 'กม.'+w+'+'+pad(Math.round((v-w)*1000)).padStart(3,'0'); }

  window.CTFollow = { refl, damage, open, canEdit, RESULTS, fd, todayIso, section, km, reflRoundDone };
})();
