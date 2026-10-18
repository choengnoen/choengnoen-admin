/* ============================================================
   นำเข้าไฟล์ CSV จากระบบกรม (rmms.doh.go.th) → สร้างรายการ "ใบสั่งการรายวัน" ของระบบเดิม (choengnoen2-statistics.html)
   - ผู้ใช้เลือก Export_CSV (ผลงานรายกิจกรรม) ของเดือนเดียว → ระบบแตกเป็นใบสั่งการรายวัน บันทึกลง daily_work_orders
     พร้อมตัดคลังน้ำมัน/วัสดุให้ด้วยกลไกเดียวกับการบันทึกจากฟอร์ม (ใบเดียว = batch เดียว สำเร็จครบหรือไม่เปลี่ยนอะไรเลย)
   - กรมให้ยอดรวมทั้งช่วง: แบ่งเท่ากันทุกวันที่ปฏิบัติงาน (ปริมาณ/ค่าแรง/ค่าเช่า/น้ำมัน), วัสดุลงวันแรก — ผู้ตรวจเทียบกระดาษแล้วแก้ในฟอร์มเดิม
   - ถ้ามีใบสั่งการ วัน+รหัสงาน+สายทาง เดียวกันที่คีย์เองอยู่แล้ว → แทนที่ใบเดิม (ลบพร้อมรายการตัดคลังของใบนั้น)
     ใบที่มาจากการนำเข้า (note มี [กรม:เดือน:แผน]) ไม่ถูกแทนที่/ไม่สร้างซ้ำ — นำเข้าไฟล์เดิมซ้ำได้ปลอดภัย
   - ต้องใช้ของหน้า: jobCodeReference, controlledRoutes, dailyWorkOrders, ledgerLocks, getStaffX, getVehiclesX, getMaterialsX,
     getLeaveHistoryX, crewLabelOf, findJob, fyOfDate, loadDailyWorkOrdersForFy, dwoToApi, buildSubsys3AddOps,
     buildSubsys3DeleteOps, applySubsys3BatchResult, apiBatch, editDailyEntry, renderAll, fmtDateShort, requireAdmin
   ============================================================ */
(function(){
  'use strict';
  const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const TOKEN_RE = /\[กรม:/;
  const S = { parsed:[], skipped:[], plan:null, importMk:'', mixed:false, busy:false, result:null, ec1w:true, mode:'import', cmp:[], sel:{}, cmpMsg:'' };

  const H = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = x => { const v = parseFloat(String(x==null?'':x).replace(/,/g,'')); return isNaN(v)?0:v; };
  const r2 = x => Math.round((x+Number.EPSILON)*100)/100;
  const digits = s => String(s||'').replace(/\D/g,'');
  /* ชื่อวัสดุเทียบกันได้แม้เขียนต่างกัน: ตัดช่องว่าง/เครื่องหมายนิ้ว/คำว่า ขนาด-นิ้ว, x=×, แก้ตัวอักษรไทยที่พิมพ์สลับลำดับ (น้ำ) */
  const normText = s => String(s||'').toLowerCase()
    .replace(/ขนาด|นิ้ว/g,'')
    .replace(/ํา/g,'ำ').replace(/[่-๋]/g,'')   /* ตัดไม้เอก-จัตวาทิ้ง (ต้องทำหลังตัดคำว่า นิ้ว): ออโต้ลูป = ออโตลูป, น้ำ/นำ้ เท่ากัน */
    .replace(/["'“”‘’″′]/g,'').replace(/[×✕]/g,'x').replace(/\s+/g,'');
  const ALIAS_KEY = 'dohMatAlias';
  const aliasLoad = () => { try{ return JSON.parse(localStorage.getItem(ALIAS_KEY)||'{}')||{}; }catch(e){ return {}; } };
  const aliasSave = o => { try{ localStorage.setItem(ALIAS_KEY, JSON.stringify(o)); }catch(e){} };
  const mkLabel = mk => { const p = String(mk).split('-').map(Number); return TH_MONTHS[p[1]-1]+' '+(p[0]+543); };
  const iso = d => { const p = String(d||'').trim().split('-'); return p.length===3 ? (+p[2]-543)+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0') : ''; };
  const dateTh = d => (typeof fmtDateShort==='function') ? fmtDateShort(d) : d;
  const normPerson = s => String(s||'').replace(/^\s*(นางสาว|น\.ส\.|นาง|นาย|ว่าที่ร้อยตรี|ด\.ช\.|ด\.ญ\.)\s*/,'').replace(/\s+/g,'');
  const normKm = k => { k = String(k||'').trim(); return k.charAt(0)==='+' ? '0'+k : k; };
  const vehicleReg = label => { const m = String(label||'').match(/\(([^)]+)\)/); return m ? m[1] : ''; };

  /* ---------- อ่าน CSV ---------- */
  function parseCsv(text){
    if(text.charCodeAt(0)===0xFEFF) text = text.slice(1);
    const rows=[]; let row=[], cell='', q=false;
    for(let i=0;i<text.length;i++){
      const c = text[i];
      if(q){ if(c==='"'){ if(text[i+1]==='"'){ cell+='"'; i++; } else q=false; } else cell+=c; }
      else if(c==='"') q=true;
      else if(c===','){ row.push(cell); cell=''; }
      else if(c==='\n'||c==='\r'){ if(c==='\r'&&text[i+1]==='\n') i++; row.push(cell); rows.push(row); row=[]; cell=''; }
      else cell+=c;
    }
    if(cell!==''||row.length){ row.push(cell); rows.push(row); }
    return rows;
  }
  function parseActivity(rows, fname){
    if(!rows.length || String(rows[0][0]||'').trim()!=='รหัสหน่วยงาน') return null;
    const a = { file:fname, plan:'', qty:0, jobCode:'', jobName:'', route:'', control:'', kmStart:'', kmEnd:'', dates:[], labor:[], laborHrs:[], extra:0, machines:[], mats:[], sum:{} };
    let mode='';
    for(const r of rows){
      const k = String(r[0]||'').trim();
      if(r[2]==='บาท' && k){ a.sum[k] = num(r[1]); continue; }
      if(k==='แผนปฏิบัติการ'){ a.plan = String(r[1]||'').trim(); a.qty = num(r[3]); }
      else if(k==='รหัสงาน'){ a.jobCode = String(r[1]||'').trim(); a.jobName = r[2]||''; }
      else if(k==='หมายเลขสายทาง'){ a.route = String(r[1]||'').trim(); a.control = String(r[3]||'').trim(); }
      else if(k==='กม.เริ่มต้น'){ a.kmStart = normKm(r[1]); a.kmEnd = normKm(r[3]); }
      else if(k==='วันที่ปฏิบัติงาน') a.dates = String(r[1]||'').split(',').map(s=>s.trim()).filter(Boolean);
      else if(k==='แรงงาน') mode='lab';
      else if(k==='รายการวัสดุ') mode='mat';
      else if(k==='หมายเลขเครื่องจักร') mode='mach';
      else if(k==='ค่าใช้สอย') mode='';
      else if(mode==='lab' && k && k!=='รวม'){ a.labor.push(k); a.laborHrs.push(num(r[2])); a.extra += num(r[4]) + num(r[5]) + num(r[6]); }   /* ชั่วโมงล่วงเวลา/ค่าตอบแทน/เบี้ยเลี้ยงรายคน */
      else if(mode==='mat' && k) a.mats.push({ name:k, unit:String(r[2]||'').trim(), price:num(r[3]), qty:num(r[4]) });
      else if(mode==='mach' && /^[\d-]{6,}$/.test(k)) a.machines.push({ no:k, hours:num(r[2]), liters:num(r[5]) });
      else if(!k && mode && (r[3]==='รวม' || r[1]==='รวม')) mode='';
    }
    return a;
  }
  async function readFile(f){
    const buf = await f.arrayBuffer();
    let t = new TextDecoder('utf-8').decode(buf);
    if(t.indexOf('รหัส')<0){ try{ t = new TextDecoder('windows-874').decode(buf); }catch(e){} }
    return t;
  }

  /* ---------- จับคู่กับข้อมูลในระบบ ---------- */
  function findRouteDoh(routeNo, control){
    const list = (typeof controlledRoutes!=='undefined') ? controlledRoutes : [];
    return list.find(r=>String(r.routeNo)===routeNo && String(r.controlNo||'')===control) || list.find(r=>String(r.routeNo)===routeNo) || null;
  }
  function matchStaff(name){
    const n = normPerson(name);
    const hit = getStaffX().find(s=>normPerson(s.name)===n);
    return hit ? hit.name : null;
  }
  function matchVehicle(no){
    const d = digits(no);
    return getVehiclesX().find(v=>digits(vehicleReg(v.label))===d || (v.regNumber && digits(v.regNumber)===d)) || null;
  }
  function matchMaterial(name){
    const list = getMaterialsX(); const n = normText(name);
    const code = aliasLoad()[n];                       /* ผู้ใช้เคยเลือกจับคู่เองไว้ */
    if(code){ const a = list.find(m=>m.code===code); if(a) return { m:a, approx:false }; }
    let hit = list.find(m=>normText(m.name)===n);
    if(hit) return { m:hit, approx:false };
    if(n.length>=4){ hit = list.find(m=>{ const k = normText(m.name); return k.length>=4 && (k.indexOf(n)>=0 || n.indexOf(k)>=0); }); if(hit) return { m:hit, approx:true }; }
    /* ชื่อกรมสั้นกว่า/คนละลำดับ: ทุกคำในชื่อกรมต้องอยู่ในชื่อทะเบียน และต้องเจอรายการเดียวเท่านั้น (ถ้าซ้ำหลายรายการ ไม่เดา) */
    const toks = String(name||'').split(/[\s()（）,]+/).map(normText).filter(t=>t.length>=2);
    if(toks.length>=2){
      const c = list.filter(m=>{ const k = normText(m.name); return toks.every(t=>k.indexOf(t)>=0); });
      if(c.length===1) return { m:c[0], approx:true };
    }
    return null;
  }
  /* วัสดุในไฟล์กรมที่ยังไม่มีในทะเบียนพัสดุ (ไม่ซ้ำชื่อ) */
  function missingMats(){
    const seen = {}, out = [];
    S.parsed.forEach(a=>a.mats.forEach(m=>{ const k = normText(m.name); if(!k || seen[k] || matchMaterial(m.name)) return; seen[k] = 1; out.push({ name:String(m.name).trim(), unit:m.unit, price:m.price }); }));
    return out;
  }
  /* ป้ายชื่อวัสดุในทะเบียนสำหรับช่องค้นหา (ชื่อซ้ำ → ต่อท้ายรหัสให้เลือกได้ไม่สับสน) */
  function matLabels(){
    const arr = getMaterialsX().slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'th')).map(m=>({ m, label:String(m.name)+(m.unit?' ('+m.unit+')':'') }));
    const cnt = {}; arr.forEach(o=>{ cnt[o.label] = (cnt[o.label]||0)+1; });
    arr.forEach(o=>{ if(cnt[o.label]>1) o.label += ' ['+o.m.code+']'; });
    return arr;
  }
  function missNote(){
    const ms = missingMats(); if(!ms.length) return '';
    const rows = ms.map((m,i)=>'<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px"><span style="flex:1 1 100%">• <b>'+H(m.name)+'</b>'+(m.unit?' ('+H(m.unit)+')':'')+' ตรงกับรายการที่มีอยู่:</span>'
      + '<input id="dohPick'+i+'" class="dohi-pick-in" autocomplete="off" placeholder="พิมพ์ชื่อวัสดุเพื่อค้นหาในทะเบียน…" oninput="DohImp.pickInput('+i+')" onfocus="DohImp.pickInput('+i+')" onkeydown="DohImp.pickKey(event,'+i+')" onblur="setTimeout(DohImp.pickClose,180)">'
      + '<button class="btn btn-sm" onclick="DohImp.pickExisting('+i+')">ใช้รายการนี้</button></div>').join('');
    return '<div class="dohi-note warn"><b>วัสดุที่ระบบยังจับคู่กับทะเบียนพัสดุไม่ได้ ('+ms.length+')</b>'
      + '<div style="font-size:.85em;margin-top:4px">ถ้ามีในทะเบียนอยู่แล้ว ให้เลือก "ใช้รายการนี้" (ระบบจำการจับคู่ไว้ ครั้งหน้าไม่ถามอีก) — กดเพิ่มใหม่ต่อเมื่อไม่มีในทะเบียนจริง ๆ</div>'
      + rows
      + '<div style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="DohImp.addMissing()">➕ ไม่มีในทะเบียนจริง — เพิ่มรายการใหม่ แล้วตัดคลังให้เลย</button></div></div>';
  }
  /* หลังจับคู่/เพิ่มวัสดุ: สร้างแผนใหม่ แล้วเตรียมตัดคลังต่อ */
  async function afterMatsChanged(pre){
    await rebuild();
    const parts = [];
    S.cmp.forEach((c,i)=>c.actions.forEach(a=>{ if(a.type==='parts') parts.push(i+':parts'); }));
    S.sel = {}; parts.forEach(k=>{ S.sel[k] = true; });
    S.result = null; S.mode = 'compare';
    if(parts.length){ await runCompare(true); S.cmpMsg = pre+' · '+S.cmpMsg; }
    else { S.mode = S.cmp.some(c=>c.exN>0) ? 'compare' : 'import'; S.cmpMsg = pre+(S.mode==='import'?' — กดนำเข้าได้เลย ระบบจะตัดคลังตามใบ':''); }
    render();
  }
  /* ช่องค้นหาวัสดุแบบเดียวกับหน้าแก้ไขใบเบิก: พิมพ์กรอง → รายการลอยใต้ช่อง (ขาว ไฮไลต์ส้ม) → คลิกแล้วกด "ใช้รายการนี้" */
  const PK = { i:-1, hi:0, res:[] };
  function pickBox(){
    let b = document.getElementById('dohi-pick-list');
    if(!b){ b = document.createElement('div'); b.id = 'dohi-pick-list'; b.className = 'dohi-combo-list'; b.style.display = 'none'; document.body.appendChild(b); }
    return b;
  }
  function pickPlace(){
    const b = pickBox(), inp = document.getElementById('dohPick'+PK.i); if(!inp || b.style.display==='none') return;
    const r = inp.getBoundingClientRect(), vh = window.innerHeight, gap = 6;
    const below = vh - r.bottom - gap - 8, above = r.top - gap - 8, up = below < 200 && above > below;
    b.style.left = r.left+'px'; b.style.width = r.width+'px'; b.style.maxHeight = Math.max(120, Math.min(320, up?above:below))+'px';
    if(up){ b.style.top = 'auto'; b.style.bottom = (vh - r.top + gap)+'px'; } else { b.style.bottom = 'auto'; b.style.top = (r.bottom + gap)+'px'; }
  }
  function pickRender(){
    const b = pickBox();
    b.innerHTML = PK.res.length ? PK.res.map((o,k)=>'<div class="dohi-opt'+(k===PK.hi?' hi':'')+'" onmousedown="DohImp.pickChoose('+k+')">'+H(o.label)+'</div>').join('')
      : '<div class="dohi-opt" style="cursor:default;color:#8a94a0">ไม่พบในทะเบียน</div>';
    b.style.display = 'block'; pickPlace();
  }
  function pickClose(){ const b = document.getElementById('dohi-pick-list'); if(b) b.style.display = 'none'; }
  function pickInput(i){
    const inp = document.getElementById('dohPick'+i); if(!inp) return;
    PK.i = i; PK.hi = 0; const q = normText(inp.value);
    if(!q){ pickClose(); return; }
    PK.res = matLabels().filter(o=>normText(o.label).indexOf(q)>=0).slice(0,60);
    pickRender();
  }
  function pickChoose(k){
    const o = PK.res[k], inp = document.getElementById('dohPick'+PK.i); if(!o || !inp) return;
    inp.value = o.label; pickClose();
  }
  function pickKey(e, i){
    const b = document.getElementById('dohi-pick-list'), open = b && b.style.display!=='none';
    if(e.key==='ArrowDown' && open){ PK.hi = Math.min(PK.res.length-1, PK.hi+1); pickRender(); e.preventDefault(); }
    else if(e.key==='ArrowUp' && open){ PK.hi = Math.max(0, PK.hi-1); pickRender(); e.preventDefault(); }
    else if(e.key==='Enter'){ if(open && PK.res[PK.hi]) pickChoose(PK.hi); else pickExisting(i); e.preventDefault(); }
    else if(e.key==='Escape'){ pickClose(); }
  }
  window.addEventListener('resize', pickPlace);
  document.addEventListener('scroll', pickPlace, true);
  async function pickExisting(i){
    if(S.busy) return;
    const ms = missingMats(), m = ms[i]; if(!m) return;
    const inp = document.getElementById('dohPick'+i); const v = inp ? inp.value.trim() : '';
    const hit = matLabels().find(o=>o.label===v);
    if(!hit){ alert(v ? 'ไม่พบชื่อนี้ในทะเบียน — พิมพ์ค้นหาแล้วเลือกจากรายการที่ขึ้นมา' : 'กรุณาพิมพ์ค้นหาและเลือกรายการในทะเบียนก่อน'); return; }
    const mat = hit.m, code = mat.code;
    const al = aliasLoad(); al[normText(m.name)] = code; aliasSave(al);
    await afterMatsChanged('จับคู่ "'+m.name+'" กับ "'+mat.name+'" แล้ว');
  }
  async function addMissing(){
    if(S.busy) return;
    const ms = missingMats(); if(!ms.length) return;
    if(!(window.FBL && FBL.canWriteTable && FBL.canWriteTable('materials'))){ alert('บัญชีนี้ไม่มีสิทธิ์เพิ่มรายการในทะเบียนพัสดุ'); return; }
    if(!confirm('จะเพิ่มวัสดุเหล่านี้เข้าทะเบียนพัสดุ (ประเภท "ในบัญชี" ยอดยกมา 0 ใช้หน่วยและราคาตามไฟล์กรม) แล้วตัดคลังให้ใบที่เกี่ยวข้อง:\n\n'+ms.map(m=>'• '+m.name+' ('+(m.unit||'หน่วย')+')').join('\n')+'\n\nต้องการดำเนินการต่อหรือไม่?')) return;
    S.busy = true;
    const used = new Set(); getMaterialsX().forEach(x=>{ const t = String(x.code||'').match(/^M(\d+)$/); if(t) used.add(parseInt(t[1],10)); });
    let added = 0; const failed = [];
    for(const m of ms){
      let n = 1; while(used.has(n)) n++; used.add(n);
      const rec = { code:'M'+String(n).padStart(2,'0'), name:m.name, unit:m.unit||'หน่วย', accountType:'ในบัญชี', stock:0, reorder:0, unitPrice:(m.price>0?m.price:undefined) };
      try{
        await apiPost('add', 'materials', { code:rec.code, itemName:rec.name, category:rec.accountType, unit:rec.unit, openingStock:0, reorderPoint:0, unitPrice:rec.unitPrice, status:'ใช้งาน' });
        getMaterialsX().push(rec); added++;
      }catch(e){ failed.push(m.name+' — '+(e&&e.message?e.message:e)); }
    }
    S.busy = false;
    await afterMatsChanged('เพิ่มวัสดุเข้าทะเบียน '+added+' รายการ'+(failed.length?' (ไม่สำเร็จ '+failed.length+': '+failed.join(' ; ')+')':''));
  }
  /* เอาเฉพาะข้อความเตือนเรื่องวัสดุไม่พบออกจากหมายเหตุ เก็บเตือนเรื่องอื่นไว้ */
  function stripMatFlag(note){
    const FL = '⚠ต้องตรวจ:'; note = String(note||''); const at = note.indexOf(FL); if(at<0) return note;
    const keep = note.slice(at+FL.length).split(' ; ').map(s=>s.trim()).filter(s=>s && s.indexOf('ไม่พบวัสดุในทะเบียน')!==0);
    return (note.slice(0,at).replace(/\s+$/,'') + (keep.length ? ' '+FL+' '+keep.join(' ; ') : '')).slice(0,700);
  }
  function splitEven(total, n){
    const base = r2(total/n), arr = new Array(n).fill(base);
    arr[n-1] = r2(total - base*(n-1));
    return arr;
  }

  /* ---------- แตกเป็นใบสั่งการรายวัน (ยังไม่บันทึก) ---------- */
  async function buildPlan(){
    const out = { items:[], skipNoDate:[], skipNoJob:[], skipLocked:[], skipDone:0, plans:S.parsed.length };
    const leaves = getLeaveHistoryX();
    const fys = Array.from(new Set(S.parsed.flatMap(a=>a.dates.map(iso).filter(Boolean).map(d=>fyOfDate(d))).concat([fyOfDate(S.importMk+'-01')])));
    await loadDailyWorkOrdersForFy(fys);
    S.parsed.forEach(a=>{
      const dates = Array.from(new Set(a.dates.map(iso).filter(Boolean))).sort();
      const label = 'แผน '+a.plan+' '+a.jobName+' (สาย '+a.route+')';
      if(!dates.length){ out.skipNoDate.push(label); return; }
      const job = findJob(a.jobCode);
      if(!job){ out.skipNoJob.push(a.jobCode+' '+a.jobName); return; }
      const route = findRouteDoh(a.route, a.control);
      const routeValue = route ? route.routeNo : '__other__';
      const kmText = a.kmStart ? (a.kmEnd ? 'กม.'+a.kmStart+' - '+a.kmEnd : 'กม.'+a.kmStart) : '';
      const loc = ((route ? 'ทล.'+route.routeNo+' ('+route.section+') ' : '') + kmText).trim();
      const days = dates.length;
      const staffNames = a.labor.map(n=>matchStaff(n) || n);
      const staffUnmatched = a.labor.filter(n=>!matchStaff(n));
      // เครื่องจักร / วัสดุ ที่จับคู่ได้
      const missVeh = [], missMat = [], approx = [];
      const vehBase = a.machines.map(m=>{ const v = matchVehicle(m.no); if(!v){ missVeh.push(m.no); return null; } return { v, liters:m.liters }; }).filter(Boolean);
      const partsAll = [];
      a.mats.forEach(m=>{
        const hit = matchMaterial(m.name);
        if(!hit){ missMat.push(m.name); return; }
        if(hit.approx) approx.push(m.name+' ≈ '+hit.m.name);
        const ex = partsAll.find(p=>p.code===hit.m.code);
        if(ex) ex.qty = r2(ex.qty + m.qty); else partsAll.push({ code:hit.m.code, qty:m.qty });
      });
      const qtyArr = splitEven(a.qty, days), laborArr = splitEven(a.sum['ค่าแรงงาน']||0, days);
      const rentArr = splitEven(a.sum['ค่าเช่าเครื่องจักร']||0, days), fuelArr = splitEven(a.sum['ค่าน้ำมันเชื้อเพลิง']||0, days);
      /* รถที่เบิกเป็นครั้ง (ค่าเริ่มต้น = ดีเซล): ไม่แบ่งลิตรเท่ากันทุกวัน (จะเป็นตัวเลขเฉลี่ยที่ไม่ตรงการเบิกจริง) — ลงวันแรกวันเดียว
         แล้วให้ผู้ตรวจย้าย/แก้เป็นวันที่เบิกจริงที่หน้า พ.1-03 · เครื่องที่เบิกสม่ำเสมอ (เบนซิน/เครื่องตัดหญ้า) ยังแบ่งเท่ากันเหมือนเดิม */
      const isIssueMode = v=>{ const m = v && v.fuelMode; return (m==='issue'||m==='daily') ? m==='issue' : (v && v.fuelType==='ดีเซล'); };
      const litersArr = vehBase.map(x=> isIssueMode(x.v) ? splitEven(x.liters, 1).concat(new Array(Math.max(0,days-1)).fill(0)) : splitEven(x.liters, days));
      dates.forEach((date, i)=>{
        const mk = date.slice(0,7);
        const token = '[กรม:'+mk+':'+a.plan+']';
        if(typeof ledgerLocks!=='undefined' && ledgerLocks[mk]){ out.skipLocked.push(dateTh(date)+' · '+label); return; }
        if(dailyWorkOrders.some(d=>d.date===date && String(d.note||'').indexOf(token)>=0)){ out.skipDone++; return; }
        const issues = [];
        /* s = ข้อความสั้นที่เก็บลงหมายเหตุของใบ (ใช้แสดงในหน้าต่าง "ตรวจสอบ" ภายหลัง) */
        if(missVeh.length) issues.push({ t:'attn', s:'ไม่พบเครื่องจักรในทะเบียน(ไม่ตัดน้ำมัน) '+missVeh.join(','), msg:'ไม่พบเครื่องจักรในทะเบียน (ไม่ได้ตัดน้ำมัน): '+missVeh.join(', ') });
        if(missMat.length && i===0) issues.push({ t:'attn', s:'ไม่พบวัสดุในทะเบียน(ไม่ตัดคลัง) '+missMat.join(','), msg:'ไม่พบวัสดุในทะเบียนพัสดุ (ไม่ได้ตัดคลัง): '+missMat.join(', ') });
        /* ไฟล์กรมบอกแค่ชั่วโมงรวมต่อคน (วันละ 7 ชม.) ไม่บอกว่าทำวันไหน → ถือว่าชนวันลาก็ต่อเมื่อวันทำงานของคนนั้นมากกว่าวันที่ไม่ได้ลาในแผนนี้ */
        const onLeave = staffNames.filter((n,k)=>{
          const lvOn = d=>leaves.some(l=>l.name===n && l.from<=d && d<=l.to);
          if(!lvOn(date)) return false;
          const workDays = Math.round((a.laborHrs[k]||0)/7);
          return workDays > dates.filter(d=>!lvOn(d)).length;
        });
        if(onLeave.length) issues.push({ t:'attn', s:'มีบันทึกลาวันนี้แต่กรมลงว่าทำงาน '+onLeave.join(','), msg:'มีบันทึกการลาในวันนี้ แต่กรมลงว่าทำงาน: '+onLeave.join(', ') });
        if(i===0 && (a.extra>0 || (a.sum['ค่าตอบแทน']||0)>0 || (a.sum['ค่าใช้สอย']||0)>0)) issues.push({ t:'attn', s:'กรมมีค่าตอบแทน/ค่าใช้สอย/ล่วงเวลา ไม่ได้นำเข้า ให้ตรวจกับระบบกรม', msg:'กรมมีค่าตอบแทน '+(a.sum['ค่าตอบแทน']||0)+' / ค่าใช้สอย '+(a.sum['ค่าใช้สอย']||0)+' / ล่วงเวลา-เบี้ยเลี้ยงรายคน — ใบสั่งการไม่มีช่องเหล่านี้ จึงไม่ได้นำเข้า (ตรวจกับแผนนี้ในระบบกรม)' });
        if(approx.length && i===0) issues.push({ t:'info', msg:'จับคู่วัสดุโดยประมาณ: '+approx.join(' · ') });
        if(staffUnmatched.length) issues.push({ t:'info', msg:'ชื่อแรงงานที่ไม่พบในทะเบียนบุคลากร: '+staffUnmatched.join(', ') });
        if(!route) issues.push({ t:'info', msg:'สาย '+a.route+' ตอน '+a.control+' ไม่อยู่ในทางหลวงควบคุม (บันทึกเป็น "อื่นๆ")' });
        const attnTxt = issues.filter(x=>x.t==='attn').length ? ' ⚠ต้องตรวจ: '+issues.filter(x=>x.t==='attn').map(x=>x.s).join(' ; ') : '';
        const rec = {
          no:0, __backendId:null, date, code:a.jobCode, kmStart:a.kmStart, kmEnd:a.kmEnd, route:routeValue, loc,
          staff:staffNames.slice(), staffLabel:staffNames.map(n=>{ const c = crewLabelOf(n); return c?n+' ('+c+')':n; }).join(', '),
          vehicles:vehBase.map((x,j)=>({ label:x.v.label, liters:litersArr[j][i], fuelType:x.v.fuelType||'' })),
          vehicle:vehBase.map(x=>x.v.label).join(', '),
          parts: i===0 ? partsAll.map(p=>({ code:p.code, qty:p.qty })) : [],
          qty:qtyArr[i], qtyPending:false, unit:job.unit||'',
          material: i===0 ? (a.sum['ค่าวัสดุ']||0) : 0, labor:laborArr[i], rent:rentArr[i], fuel:fuelArr[i],
          note:('นำเข้าจากกรม '+mkLabel(mk)+' แผน '+a.plan+' (วันที่ '+(i+1)+'/'+days+') '+token+attnTxt).slice(0,700)
        };
        out.items.push({ rec, issues, label, planNo:a.plan });
      });
    });
    // จำนวนใบเดิมที่จะถูกแทนที่ (ใบที่คีย์เอง วัน/รหัสงาน/สายทางเดียวกัน ไม่รวมใบที่มาจากการนำเข้า)
    const seen = new Set();
    out.items.forEach(it=>{
      dailyWorkOrders.filter(d=>d.date===it.rec.date && d.code===it.rec.code && String(d.route||'')===String(it.rec.route||'') && !TOKEN_RE.test(String(d.note||''))).forEach(d=>seen.add(d.__backendId));
    });
    out.replaceCount = seen.size;
    return out;
  }

  /* ---------- หน้าต่าง ---------- */
  function ensureCss(){
    if(document.getElementById('doh-imp-css')) return;
    const st = document.createElement('style'); st.id = 'doh-imp-css';
    st.textContent = `
      .dohi-box{width:96%;padding:0;}
      .dohi-head{background:var(--modal-head-bg,radial-gradient(1100px 420px at 15% -30%,#4b5563 0%,#111827 70%));border-bottom:none;padding:18px 20px;border-radius:0;display:flex;align-items:center;gap:12px;}
      .dohi-head h3{color:#fff;font-family:'Kanit',sans-serif;font-size:15.5px;margin:0;}
      .dohi-head-icon{width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
      .dohi-head-icon svg{width:19px;height:19px;}
      .dohi-sub{color:#a9bbcc;font-size:11.5px;margin-top:2px;}
      .dohi-head .modal-close{color:#a9bbcc;margin-left:auto;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:none;border:none;cursor:pointer;}
      .dohi-head .modal-close:hover{background:rgba(255,255,255,.14);color:#fff;}
      .dohi-box .modal-body{padding:20px 22px 8px;}
      .dohi-foot{display:flex;align-items:center;gap:8px;justify-content:flex-end;padding:14px 22px;border-top:1px solid #e3e6ea;background:#fff;}
      .dohi-foot:empty{display:none;}
      .dohi-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 0 16px;}
      .dohi-steps>div{border:1px solid #dfe2dd;border-radius:12px;padding:12px 14px;background:#fff;}
      .dohi-steps i{display:inline-flex;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#f07a1f,#e0620f);color:#fff;font-style:normal;font-size:12px;font-weight:700;align-items:center;justify-content:center;margin-right:8px;}
      .dohi-steps b{font-family:'Kanit',sans-serif;font-size:14px;color:#0a2540;}
      .dohi-steps span{display:block;margin-top:6px;font-size:12.5px;line-height:1.55;color:#4d5a66;}
      .dohi-rules{margin:0 0 16px;padding:12px 16px 12px 32px;background:#f5f6f4;border-radius:12px;font-size:12.5px;line-height:1.7;color:#4d5a66;}
      .dohi-rules b{color:#182430;}
      .dohi-pick{border:2px dashed #dfe2dd;border-radius:14px;padding:22px;text-align:center;margin:0 0 12px;}
      .dohi-pick small{display:block;margin-top:8px;color:#8792a0;font-size:12px;}
      @media(max-width:700px){.dohi-steps{grid-template-columns:1fr;}}
      .dohi-pick-in{flex:1 1 220px;min-width:0;box-sizing:border-box;font-family:inherit;font-size:14px;padding:7px 10px;border:1px solid #d9dde3;border-radius:8px;background:#fff;color:#1d2733;}
      .dohi-combo-list{position:fixed;z-index:2147483000;border:1px solid #d9dde3;border-radius:10px;overflow-y:auto;overscroll-behavior:contain;background:#fff;box-shadow:0 8px 24px rgba(10,37,64,.14);}
      .dohi-opt{padding:8px 12px;cursor:pointer;border-bottom:1px solid #f1f2f5;font-size:14px;color:#1d2733;}
      .dohi-opt:hover,.dohi-opt.hi{background:#fff4ea;}
      .dohi-note{background:#f5f6f4;border:1px solid #dfe2dd;border-radius:10px;padding:10px 14px;font-size:13px;color:#4d5a66;line-height:1.65;margin:0 0 12px;}
      .dohi-note.warn{background:#fdf1d9;color:#7a5000;border-color:#f2d28c;}
      .dohi-note.bad{background:#fbeae7;color:#c1402f;border-color:#f0b9b0;}
      .dohi-note.ok{background:#e5f4ec;color:#1c8a53;border-color:#b6dfc8;}
      .dohi-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:0 0 14px;}
      .dohi-kpi div{background:#fff;border:1px solid #e3e6ea;border-radius:12px;padding:10px 14px 10px 16px;font-size:12.5px;color:#4d5a66;position:relative;overflow:hidden;box-shadow:0 1px 2px rgba(10,37,64,.04);}
      .dohi-kpi div::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:#c9d0d8;}
      .dohi-kpi div:has(b[style*="1c8a53"])::before{background:#1c8a53;}
      .dohi-kpi div:has(b[style*="c1402f"])::before{background:#c1402f;}
      .dohi-kpi b{display:block;font-family:'Kanit',sans-serif;font-size:24px;line-height:1.2;color:#182430;}
      .dohi-seg{display:inline-flex;gap:4px;padding:4px;margin:0 0 14px;background:#eef0ed;border-radius:12px;max-width:100%;flex-wrap:wrap;}
      .dohi-seg button{border:none;background:transparent;padding:8px 16px;border-radius:9px;font-family:inherit;font-size:13.5px;font-weight:600;color:#4d5a66;cursor:pointer;transition:background .15s,color .15s,box-shadow .15s;}
      .dohi-seg button:hover{background:rgba(255,255,255,.7);}
      .dohi-seg button.on{background:#fff;color:#c9560b;box-shadow:0 1px 4px rgba(10,37,64,.16);}
      .dohi-tool{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 14px;margin:0 0 14px;background:#fafaf8;border:1px solid #e3e6ea;border-radius:14px;}
      .dohi-tool .dohi-mon{display:flex;align-items:center;gap:8px;margin-left:auto;font-size:13px;color:#4d5a66;}
      .dohi-tool .dohi-mon select{min-width:150px;}
      .dohi-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 12px;}
      .dohi-bar select{font-family:inherit;font-size:14px;padding:6px 10px;border:1px solid #dfe2dd;border-radius:8px;background:#fff;}
      .dohi-table{width:100%;border-collapse:collapse;font-size:13px;}
      .dohi-table th,.dohi-table td{padding:6px 8px;border-bottom:1px solid #dfe2dd;text-align:left;vertical-align:top;}
      .dohi-table th{color:#4d5a66;font-size:12.5px;background:#f5f6f4;}
      .dohi-list{margin:4px 0 0;padding-left:18px;}
      .dohi-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#c1402f;color:#fff;font-size:11px;font-weight:700;line-height:18px;text-align:center;box-sizing:border-box;}
    `;
    document.head.appendChild(st);
  }
  function overlay(){
    let ov = document.getElementById('doh-imp-overlay');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'doh-imp-overlay'; ov.className = 'modal-overlay no-print hidden';
      ov.innerHTML = '<div class="modal-box modal-l dohi-box"><div class="modal-head dohi-head">'
        + '<div class="dohi-head-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></div>'
        + '<div><h3>นำเข้าข้อมูลจากกรม (rmms)</h3><div class="dohi-sub">สร้างเป็นใบสั่งการรายวัน พร้อมตัดคลังน้ำมัน/วัสดุให้อัตโนมัติ</div></div>'
        + '<button class="modal-close" onclick="DohImp.close()" aria-label="ปิด">✕</button></div>'
        + '<div class="modal-body" id="doh-imp-body"></div><div class="modal-foot dohi-foot" id="doh-imp-foot"></div></div>';
      document.body.appendChild(ov);
    }
    return ov;
  }
  function close(){ if(S.busy && !confirm('กำลังนำเข้าอยู่ ปิดหน้าต่างไม่หยุดการนำเข้า ต้องการปิดจริงหรือไม่?')) return; const ov = document.getElementById('doh-imp-overlay'); if(ov) ov.classList.add('hidden'); }
  function openImport(){
    if(typeof requireAdmin==='function' && !requireAdmin()) return;
    ensureCss();
    if(!S.busy){ S.parsed = []; S.skipped = []; S.plan = null; S.result = null; S.cmp = []; S.sel = {}; S.cmpMsg = ''; S.mode = 'import'; }
    overlay().classList.remove('hidden');
    render();
  }
  const pickHtml = () => '<label class="btn btn-primary" style="cursor:pointer;">📂 เลือกไฟล์ CSV จากกรม<input type="file" accept=".csv,text/csv" multiple style="display:none" onchange="DohImp.onFiles(this)"></label>';
  function monthOptions(sel){
    const keys = []; const now = new Date();
    for(let i=0;i<14;i++){ const d = new Date(now.getFullYear(), now.getMonth()-i, 1); keys.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')); }
    if(sel && keys.indexOf(sel)<0) keys.unshift(sel);
    return keys.map(k=>'<option value="'+k+'" '+(k===sel?'selected':'')+'>'+mkLabel(k)+'</option>').join('');
  }
  function render(msg, progress){
    const body = document.getElementById('doh-imp-body'); if(!body) return;
    const foot = document.getElementById('doh-imp-foot');
    const setFoot = h => { if(foot) foot.innerHTML = h || ''; };
    if(progress){ body.innerHTML = '<div class="dohi-note">'+H(progress)+'</div>'; setFoot(''); return; }
    if(S.result){ body.innerHTML = renderResult(); setFoot('<button class="btn btn-ghost" onclick="DohImp.again()">นำเข้าไฟล์เพิ่ม</button><button class="btn btn-primary" onclick="DohImp.close()">ปิด</button>'); return; }
    const intro = '<div class="dohi-steps">'
      + '<div><i>1</i><b>เลือกไฟล์</b><span>Export_CSV <b>ทุกไฟล์ของเดือนเดียวกัน</b> จากระบบกรม เลือกพร้อมกันหลายไฟล์ได้</span></div>'
      + '<div><i>2</i><b>ตรวจสรุป</b><span>ระบบอ่านไฟล์ในเครื่องคุณเท่านั้น แล้วแสดงจำนวนใบที่จะสร้างให้ตรวจก่อน</span></div>'
      + '<div><i>3</i><b>นำเข้า</b><span>สร้างเป็นใบสั่งการรายวัน เปิดเทียบกับกระดาษและแก้ในฟอร์มเดิมได้</span></div></div>'
      + '<ul class="dohi-rules"><li>ยอดรวมทั้งช่วงของกรมแบ่งเท่ากันทุกวันที่ปฏิบัติงาน (วัสดุลงวันแรก)</li>'
      + '<li>ใบที่คีย์เองไว้แล้ว (วัน/รหัสงาน/สายทางเดียวกัน) จะถูก<b>แทนที่</b></li>'
      + '<li>นำเข้าไฟล์เดิมซ้ำได้ ระบบข้ามใบที่เคยนำเข้าแล้ว</li></ul>';
    if(!S.parsed.length){
      body.innerHTML = (msg?'<div class="dohi-note bad">'+H(msg)+'</div>':'') + intro + '<div class="dohi-pick">'+pickHtml()+'<small>รองรับไฟล์ .csv</small></div>';
      setFoot('<button class="btn btn-ghost" onclick="DohImp.close()">ปิด</button>'); return;
    }
    const p = S.plan;
    const modeBar = '<div class="dohi-seg"><button class="'+(S.mode==='compare'?'on':'')+'" onclick="DohImp.setMode(\'compare\')">🔍 เทียบกับข้อมูลในระบบ <small style="font-weight:400;opacity:.75">(ไม่แก้ใบเดิม)</small></button>'
      + '<button class="'+(S.mode==='import'?'on':'')+'" onclick="DohImp.setMode(\'import\')">📥 นำเข้าสร้างใบสั่งการ</button></div>';
    const toolBar = '<div class="dohi-tool">'+pickHtml()+'<label class="dohi-mon">เดือนของไฟล์ <select onchange="DohImp.setMonth(this.value)">'+monthOptions(S.importMk)+'</select></label></div>';
    if(S.mode==='compare'){
      const nAct = Object.keys(S.sel).filter(k=>S.sel[k]).length;
      body.innerHTML = (S.cmpMsg?'<div class="dohi-note ok">'+H(S.cmpMsg)+'</div>':'')
        + (S.skipped.length?'<div class="dohi-note warn">ข้าม '+S.skipped.length+' ไฟล์ที่ไม่ใช่ผลงานรายกิจกรรม: '+H(S.skipped.join(', '))+'</div>':'')
        + modeBar + toolBar
        + missNote() + renderCompare();
      setFoot('<button class="btn btn-ghost" onclick="DohImp.close()">ปิด</button><button class="btn btn-ghost" onclick="DohImp.copyCompare()">📋 คัดลอกผลเทียบ</button><button class="btn btn-primary" '+(nAct?'':'disabled')+' onclick="DohImp.runCompare()">ดำเนินการที่เลือก ('+nAct+')</button>');
      return;
    }
    const kpi = p ? '<div class="dohi-kpi"><div><b>'+S.parsed.length+'</b>ไฟล์กิจกรรมที่อ่าน</div><div><b>'+p.items.length+'</b>ใบสั่งการที่จะสร้าง</div>'
      + '<div><b>'+p.replaceCount+'</b>ใบเดิมที่จะถูกแทนที่</div>'
      + '<div><b style="color:#c1402f">'+p.items.filter(x=>x.issues.some(i=>i.t==='attn')).length+'</b>ใบที่ควรตรวจหลังนำเข้า</div>'
      + '<div><b>'+p.skipDone+'</b>ข้าม (เคยนำเข้าแล้ว)</div></div>' : '';
    const skipBlocks = p ? [['ข้าม: ไฟล์กรมไม่ระบุวันที่ปฏิบัติงาน (ต้องคีย์เอง)', p.skipNoDate],['ข้าม: ไม่พบรหัสงานในข้อมูลอ้างอิง', p.skipNoJob],['ข้าม: เดือนถูกล็อกบัญชีพัสดุแล้ว', p.skipLocked]]
      .filter(x=>x[1].length).map(x=>'<div class="dohi-note warn"><b>'+x[0]+' ('+x[1].length+')</b><ul class="dohi-list">'+x[1].slice(0,12).map(s=>'<li>'+H(s)+'</li>').join('')+(x[1].length>12?'<li>… อีก '+(x[1].length-12)+'</li>':'')+'</ul></div>').join('') : '';
    body.innerHTML = (msg?'<div class="dohi-note bad">'+H(msg)+'</div>':'')
      + (S.cmpMsg?'<div class="dohi-note ok">'+H(S.cmpMsg)+'</div>':'')
      + (S.skipped.length?'<div class="dohi-note warn">ข้าม '+S.skipped.length+' ไฟล์ที่ไม่ใช่ผลงานรายกิจกรรม: '+H(S.skipped.join(', '))+'</div>':'')
      + (S.mixed?'<div class="dohi-note warn">ไฟล์มีวันที่ปฏิบัติงานหลายเดือนปนกัน — ควรเลือกไฟล์ทีละเดือน</div>':'')
      + modeBar + toolBar
      + kpi + missNote() + skipBlocks
      + (p ? '<div class="dohi-bar"><label style="display:inline-flex;gap:6px;align-items:center;font-size:13.5px;"><input type="checkbox" '+(S.ec1w?'checked':'')+' onchange="DohImp.setEc1w(this.checked)"> บันทึกชั่วโมงเครื่องจักรลง EC 1-W ด้วย ('+buildEc1w().length+' แถว เครื่อง×วัน — ลงช่อง W ชั่วโมงปฏิบัติงาน; ทับเฉพาะช่อง W เดิมของแถวนั้น)</label></div>' : '')
      ;
    setFoot('<button class="btn btn-ghost" onclick="DohImp.close()">ยกเลิก</button><button class="btn btn-primary" '+(p&&p.items.length?'':'disabled')+' onclick="DohImp.run()">นำเข้า '+(p?p.items.length:0)+' ใบสั่งการ</button>');
  }
  function renderResult(){
    const r = S.result;
    const attn = r.attn.length ? '<div class="dohi-note warn"><b>ใบที่ควรตรวจ/แก้ ('+r.attn.length+')</b> — กดแก้ไขเพื่อเปิดฟอร์มใบสั่งการเดิม'
      + '<div style="overflow:auto"><table class="dohi-table"><thead><tr><th>วันที่</th><th>รหัสงาน</th><th>สิ่งที่ต้องตรวจ</th><th></th></tr></thead><tbody>'
      + r.attn.map(a=>'<tr><td>'+H(dateTh(a.date))+'</td><td>'+H(a.code)+'</td><td>'+a.msgs.map(m=>H(m)).join('<br>')+'</td><td><button class="btn btn-ghost btn-sm" onclick="DohImp.editOrder(\''+H(a.id)+'\')">✎ แก้ไข</button></td></tr>').join('')
      + '</tbody></table></div></div>' : '';
    const fail = r.failed.length ? '<div class="dohi-note bad"><b>นำเข้าไม่สำเร็จ ('+r.failed.length+' ใบ — ไม่มีข้อมูลของใบเหล่านี้ถูกบันทึก)</b><ul class="dohi-list">'+r.failed.slice(0,15).map(f=>'<li>'+H(f)+'</li>').join('')+'</ul>นำเข้าไฟล์เดิมซ้ำเพื่อลองใหม่ได้ ระบบข้ามใบที่สำเร็จแล้ว</div>' : '';
    return '<div class="dohi-note ok"><b>นำเข้าเสร็จแล้ว:</b> สร้างใบสั่งการ '+r.created+' ใบ'+(r.replaced?' · แทนที่ใบเดิม '+r.replaced+' ใบ':'')+' (ตัดคลังน้ำมัน/วัสดุตามใบแล้ว) — เปิดดูได้ที่รายการใบสั่งการรายวัน (หมายเหตุของใบจะขึ้นว่า "นำเข้าจากกรม")</div>'
      + (r.ec1w ? '<div class="dohi-note '+(r.ec1w.note?'warn':'ok')+'"><b>EC 1-W:</b> บันทึกชั่วโมงเครื่องจักร (ช่อง W) '+r.ec1w.n+' แถว'+(r.ec1w.note?'<br>'+H(r.ec1w.note):'')+'</div>' : '')
      + fail + missNote() + attn;
  }
  async function onFiles(input){
    const files = Array.from(input.files||[]); if(!files.length || S.busy) return;
    S.parsed = []; S.skipped = []; S.plan = null;
    for(const f of files){
      try{ const a = parseActivity(parseCsv(await readFile(f)), f.name); if(a) S.parsed.push(a); else S.skipped.push(f.name); }
      catch(e){ S.skipped.push(f.name); }
    }
    if(!S.parsed.length){ render('ไม่พบไฟล์ผลงานรายกิจกรรมในที่เลือก (ต้องเป็นไฟล์ที่บรรทัดแรกขึ้นต้นด้วย "รหัสหน่วยงาน")'); return; }
    const cnt = {};
    S.parsed.forEach(a=>a.dates.forEach(d=>{ const x = iso(d); if(x){ const m = x.slice(0,7); cnt[m] = (cnt[m]||0)+1; } }));
    const ks = Object.keys(cnt).sort((x,y)=>cnt[y]-cnt[x]);
    S.mixed = ks.length>1;
    S.importMk = ks[0] || new Date().toISOString().slice(0,7);
    S.cmpMsg = '';
    await rebuild();
    /* ถ้าในระบบมีใบของเดือน/รหัสงานเหล่านี้อยู่แล้ว → เข้าโหมดเทียบ (ไม่ลบ/แทนที่ใบเดิม) */
    S.mode = S.cmp.some(c=>c.exN>0) ? 'compare' : 'import';
    render();
  }
  async function rebuild(){
    render(null, 'กำลังอ่านข้อมูลอ้างอิงและจับคู่...');
    try{ S.plan = await buildPlan(); S.cmp = buildCompare(); S.fuel = buildFuelCompare(); }catch(e){ S.plan = null; S.cmp = []; S.fuel = []; render('จับคู่ข้อมูลไม่สำเร็จ: '+(e&&e.message?e.message:e)); return; }
    S.sel = {};
    S.cmp.forEach((c,i)=>c.actions.forEach(a=>{ S.sel[i+':'+a.type] = true; }));
    render();
  }
  function setMode(m){ S.mode = m; S.cmpMsg = ''; render(); }
  function togAct(k, v){ S.sel[k] = !!v; render(); }

  /* ---------- โหมดเทียบกับข้อมูลในระบบ (ไม่ลบ/ไม่แทนที่ใบเดิม) ---------- */
  function buildCompare(){
    const leaves = getLeaveHistoryX();
    const planItems = (S.plan && S.plan.items) || [];
    return S.parsed.map(a=>{
      const dates = Array.from(new Set(a.dates.map(iso).filter(Boolean))).sort();
      const label = 'แผน '+a.plan+' '+a.jobName+' (สาย '+a.route+')';
      const c = { label, plan:a.plan, diffs:[], oks:[], actions:[], exN:0, skip:'' };
      if(!dates.length){ c.skip = 'กรมไม่ระบุวันที่ปฏิบัติงาน'; return c; }
      const job = findJob(a.jobCode);
      if(!job){ c.skip = 'ไม่พบรหัสงาน '+a.jobCode+' ในข้อมูลอ้างอิง'; return c; }
      const route = findRouteDoh(a.route, a.control), rv = route ? route.routeNo : '__other__';
      const mks = new Set(dates.map(d=>d.slice(0,7)));
      const ex = dailyWorkOrders.filter(d=>d.code===a.jobCode && mks.has(String(d.date).slice(0,7)) && (String(d.route||'')===String(rv) || new RegExp('ทล\\.\\s*'+a.route+'(?!\\d)').test(String(d.loc||'')))).sort((x,y)=>x.date<y.date?-1:1);
      c.exN = ex.length; c.ex = ex;
      const cmpNum = (name, sys, dept, tol)=>{ if(Math.abs(sys-dept) > (tol||0.01)) c.diffs.push(name+': ระบบ '+r2(sys)+' / กรม '+r2(dept)); else c.oks.push(name); };
      const exDates = Array.from(new Set(ex.map(d=>d.date)));
      const missing = dates.filter(d=>exDates.indexOf(d)<0), extra = exDates.filter(d=>dates.indexOf(d)<0);
      if(missing.length) c.diffs.push('กรมลงวันที่ '+missing.map(dateTh).join(', ')+' แต่ระบบไม่มีใบ');
      if(extra.length) c.diffs.push('ระบบมีใบวันที่ '+extra.map(dateTh).join(', ')+' แต่กรมไม่ได้ลง');
      if(!missing.length && !extra.length) c.oks.push('วันที่ปฏิบัติงาน');
      const missItems = planItems.filter(it=>it.planNo===a.plan && it.label===label && missing.indexOf(it.rec.date)>=0);
      if(missItems.length) c.actions.push({ type:'days', text:'สร้างใบสั่งการวันที่ขาด '+missItems.length+' ใบ (จากยอดของกรม)', items:missItems });
      if(ex.length){
        const sum = k => ex.reduce((s,d)=>s+(d[k]||0),0);
        cmpNum('ปริมาณงาน', sum('qty'), a.qty);
        cmpNum('ค่าแรงงาน', sum('labor'), a.sum['ค่าแรงงาน']||0);
        cmpNum('ค่าเช่าเครื่องจักร', sum('rent'), a.sum['ค่าเช่าเครื่องจักร']||0);
        cmpNum('ค่าน้ำมัน', sum('fuel'), a.sum['ค่าน้ำมันเชื้อเพลิง']||0);
        cmpNum('ค่าวัสดุ', sum('material'), a.sum['ค่าวัสดุ']||0);
        // วัสดุ
        const newParts = [];
        a.mats.forEach(m=>{
          const hit = matchMaterial(m.name);
          if(!hit){ c.diffs.push('วัสดุ "'+m.name+'" ไม่อยู่ในทะเบียนพัสดุ — ให้เพิ่มเข้าทะเบียนก่อน'); return; }
          const sq = ex.reduce((s,d)=>s+(d.parts||[]).filter(p=>p.code===hit.m.code).reduce((t,p)=>t+(p.qty||0),0),0);
          if(sq===0 && m.qty>0){ c.diffs.push('วัสดุ '+m.name+' กรมลง '+m.qty+' '+m.unit+' แต่ใบของระบบไม่มี'); newParts.push({ code:hit.m.code, qty:m.qty }); }
          else cmpNum('วัสดุ '+m.name, sq, m.qty, 0.001);
        });
        if(newParts.length) c.actions.push({ type:'parts', text:'เติมวัสดุที่ไม่มีในใบ '+newParts.length+' รายการ ลงใบวันแรก ('+dateTh(ex[0].date)+') และตัดคลังตาม', parts:newParts, target:ex[0] });
        // เครื่องจักร/น้ำมัน: เทียบรวมต่อเครื่องทั้งเดือนที่ส่วนบนของหน้า (กรมแบ่งน้ำมันไปลงทีละแผน เทียบทีละแผนไม่ได้)
        a.machines.forEach(m=>{ if(!matchVehicle(m.no)) c.diffs.push('เครื่องจักร '+m.no+' ไม่พบในทะเบียน'); });
        // คนทำงาน
        const sysStaff = Array.from(new Set(ex.reduce((arr,d)=>arr.concat(d.staff||[]),[])));
        const lackStaff = a.labor.filter(n=>!sysStaff.some(s=>normPerson(s)===normPerson(n)));
        if(lackStaff.length) c.diffs.push('คนที่กรมลงแต่ใบของระบบไม่มี: '+lackStaff.join(', ')); else c.oks.push('รายชื่อคนทำงาน');
        const moreStaff = sysStaff.filter(s=>!a.labor.some(n=>normPerson(s)===normPerson(n)));
        if(moreStaff.length) c.diffs.push('คนที่อยู่ในใบของระบบแต่กรมไม่ได้ลง: '+moreStaff.join(', '));
        // ลางาน
        ex.forEach(d=>{ const lv = (d.staff||[]).filter(n=>leaves.some(l=>l.name===n && l.from<=d.date && d.date<=l.to)); if(lv.length) c.diffs.push('วันที่ '+dateTh(d.date)+' มีบันทึกลาแต่ลงว่าทำงาน: '+lv.join(', ')); });
      }
      return c;
    });
  }
  /* น้ำมันรวมต่อเครื่อง ทั้งเดือน (ทุกแผน/ทุกรหัสงาน) — เทียบกับยอดที่ใบสั่งการของระบบเบิกไว้ (ซึ่งตรงกับใบเบิกที่ลงนาม) */
  function buildFuelCompare(){
    const months = new Set(); const dept = {}, sys = {}, unk = [];
    S.parsed.forEach(a=>{
      const dates = Array.from(new Set(a.dates.map(iso).filter(Boolean)));
      dates.forEach(d=>months.add(d.slice(0,7)));
      a.machines.forEach(m=>{
        const v = matchVehicle(m.no);
        if(!v){ if(unk.indexOf(m.no)<0) unk.push(m.no); return; }
        dept[v.label] = r2((dept[v.label]||0) + m.liters);
      });
    });
    dailyWorkOrders.filter(d=>months.has(String(d.date).slice(0,7))).forEach(d=>{
      (d.vehicles||[]).forEach(x=>{ sys[x.label] = r2((sys[x.label]||0) + (x.liters||0)); });
    });
    const labels = Array.from(new Set(Object.keys(dept).concat(Object.keys(sys)))).sort();
    return { rows: labels.map(l=>({ label:l, sys:sys[l]||0, dept:dept[l]||0, diff:r2((sys[l]||0)-(dept[l]||0)) })), unk };
  }
  function togFuel(i){ S.fuelOpen = (S.fuelOpen===i) ? -1 : i; render(); }
  /* รายวันของเครื่องหนึ่งคัน: ฝั่งระบบ (ใบสั่งการที่คีย์) และฝั่งกรม (ยอดต่อแผน + วันที่ปฏิบัติงานของแผน) */
  function fuelDetail(label){
    const months = new Set(); S.parsed.forEach(a=>a.dates.map(iso).filter(Boolean).forEach(d=>months.add(d.slice(0,7))));
    const sysRows = [];
    dailyWorkOrders.filter(d=>months.has(String(d.date).slice(0,7))).sort((x,y)=>x.date<y.date?-1:x.date>y.date?1:0).forEach(d=>{
      (d.vehicles||[]).forEach(x=>{ if(x.label===label){ const j = findJob(d.code); sysRows.push({ date:d.date, job:d.code+' '+((j&&j.name)||''), loc:d.loc||'', liters:x.liters||0 }); } });
    });
    const deptRows = [];
    S.parsed.forEach(a=>{
      const dates = Array.from(new Set(a.dates.map(iso).filter(Boolean))).sort();
      let lit = 0, hit = false;
      a.machines.forEach(m=>{ const v = matchVehicle(m.no); if(v && v.label===label){ lit += m.liters; hit = true; } });
      if(hit) deptRows.push({ plan:'แผน '+a.plan+' '+a.jobName+' (สาย '+a.route+')', liters:r2(lit), dates:dates.map(dateTh).join(', ') });
    });
    const sysTot = r2(sysRows.reduce((s,x)=>s+x.liters,0)), deptTot = r2(deptRows.reduce((s,x)=>s+x.liters,0));
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
      + '<div><b>ระบบเรา (ใบสั่งการที่คีย์)</b><table class="dohi-table"><thead><tr><th>วันที่</th><th>งาน / สายทาง</th><th style="text-align:right">ลิตร</th></tr></thead><tbody>'
      + (sysRows.length ? sysRows.map(x=>'<tr><td style="white-space:nowrap">'+H(dateTh(x.date))+'</td><td>'+H(x.job)+(x.loc?'<br><small>'+H(x.loc)+'</small>':'')+'</td><td style="text-align:right">'+x.liters+'</td></tr>').join('') : '<tr><td colspan="3">ไม่มี</td></tr>')
      + '<tr><td colspan="2"><b>รวม</b></td><td style="text-align:right"><b>'+sysTot+'</b></td></tr></tbody></table></div>'
      + '<div><b>กรม (ยอดต่อแผน)</b><table class="dohi-table"><thead><tr><th>แผน / วันที่ปฏิบัติงาน</th><th style="text-align:right">ลิตร</th></tr></thead><tbody>'
      + (deptRows.length ? deptRows.map(x=>'<tr><td>'+H(x.plan)+'<br><small>'+H(x.dates)+'</small></td><td style="text-align:right">'+x.liters+'</td></tr>').join('') : '<tr><td colspan="2">ไม่มี</td></tr>')
      + '<tr><td><b>รวม</b></td><td style="text-align:right"><b>'+deptTot+'</b></td></tr></tbody></table></div></div>';
  }
  function renderFuel(){
    const f = S.fuel; if(!f || !f.rows) return '';
    const bad = f.rows.filter(r=>Math.abs(r.diff)>0.05).length;
    return '<div class="dohi-note" style="background:#fff"><b>น้ำมันรวมต่อเครื่อง ทั้งเดือน (ทุกแผน)</b> — '
      + (bad ? '<span style="color:#c1402f">ต่างกัน '+bad+' เครื่อง</span>' : '<span style="color:#1c8a53">✓ ตรงกันทุกเครื่อง</span>')
      + '<div style="overflow:auto"><table class="dohi-table"><thead><tr><th>เครื่องจักร</th><th style="text-align:right">ระบบเรา (ลิตร)</th><th style="text-align:right">กรม (ลิตร)</th><th style="text-align:right">ต่าง</th></tr></thead><tbody>'
      + f.rows.map((r,i)=>{ const b = Math.abs(r.diff)>0.05, open = S.fuelOpen===i;
          return '<tr onclick="DohImp.togFuel('+i+')" style="cursor:pointer;'+(b?'background:#fdf1d9':'')+'" title="กดดูรายวัน"><td>'+(open?'▾ ':'▸ ')+H(r.label)+'</td><td style="text-align:right">'+r.sys+'</td><td style="text-align:right">'+r.dept+'</td><td style="text-align:right;'+(b?'color:#c1402f;font-weight:700':'')+'">'+(r.diff>0?'+':'')+r.diff+'</td></tr>'
            + (open ? '<tr><td colspan="4" style="background:#fff">'+fuelDetail(r.label)+'</td></tr>' : ''); }).join('')
      + '</tbody></table></div><div style="margin-top:6px;font-size:12.5px;color:#8792a0">กดแถวเครื่องจักรเพื่อดูรายวัน เทียบกับใบเบิกที่ลงนาม</div>'
      + (f.unk.length?'<div style="margin-top:6px">เครื่องจักรที่ไม่พบในทะเบียน: '+H(f.unk.join(', '))+'</div>':'')
      + '</div>';
  }
  function renderCompare(){
    if(!S.cmp.length) return '';
    const bad = S.cmp.filter(c=>c.diffs.length||c.skip).length;
    const head = '<div class="dohi-kpi"><div><b>'+S.cmp.length+'</b>แผนในไฟล์กรม</div><div><b style="color:#1c8a53">'+(S.cmp.length-bad)+'</b>ตรงกับระบบ</div><div><b style="color:#c1402f">'+bad+'</b>มีจุดต่าง</div></div>';
    return head + renderFuel() + S.cmp.map((c,i)=>{
      const state = c.skip ? '<span style="color:#7a5000">ข้าม</span>' : (!c.exN && c.actions.length ? '<span style="color:#c1402f">ระบบยังไม่มีใบ</span>' : (c.diffs.length ? '<span style="color:#c1402f">มีจุดต่าง '+c.diffs.length+'</span>' : '<span style="color:#1c8a53">✓ ตรงกัน</span>'));
      return '<div class="dohi-note" style="background:#fff"><b>'+H(c.label)+'</b> — '+state+' <small>(ใบในระบบ '+c.exN+' ใบ)</small>'
        + (c.skip?'<div>'+H(c.skip)+'</div>':'')
        + (c.diffs.length?'<ul class="dohi-list">'+c.diffs.map(x=>'<li>'+H(x)+'</li>').join('')+'</ul>':'')
        + c.actions.map(a=>'<label style="display:flex;gap:6px;align-items:center;margin-top:6px;font-size:13px;"><input type="checkbox" '+(S.sel[i+':'+a.type]?'checked':'')+' onchange="DohImp.togAct(\''+i+':'+a.type+'\',this.checked)"> '+H(a.text)+'</label>').join('')
        + '</div>';
    }).join('');
  }
  function compareText(){
    const lines = ['ผลเทียบข้อมูลใบสั่งการ ระบบเรา กับไฟล์กรม (rmms) ประจำ'+mkLabel(S.importMk),''];
    let n = 0;
    /* คัดลอกเฉพาะเรื่องที่เจ้าหน้าที่ต้องตรวจกับเอกสาร — ไม่รวมตัวเลขที่กรมแบ่งตามแผน (ปริมาณงาน/ค่าแรง/ค่าเช่า/น้ำมัน/ค่าวัสดุ)
       และวัสดุที่ไม่อยู่ในทะเบียนพัสดุ (เป็นงานของคนดูแลทะเบียน) */
    const skipRe = /^(ปริมาณงาน|ค่าแรงงาน|ค่าเช่าเครื่องจักร|ค่าน้ำมัน|ค่าวัสดุ)|ไม่อยู่ในทะเบียนพัสดุ/;
    const badFuel = (S.fuel && S.fuel.rows) ? S.fuel.rows.filter(r=>Math.abs(r.diff)>0.05) : [];
    if(badFuel.length){
      lines.push('น้ำมันรวมต่อเครื่อง ทั้งเดือน ที่ไม่ตรงกัน (ลิตร) ระบบเรา / กรม:');
      badFuel.forEach(r=>lines.push('   - '+r.label+': '+r.sys+' / '+r.dept+'  ← ต่าง '+(r.diff>0?'+':'')+r.diff));
      lines.push(''); n++;
    }
    S.cmp.forEach(c=>{
      const ds = c.diffs.filter(x=>!skipRe.test(x));
      if(!ds.length && !c.skip) return;
      n++; lines.push(c.label+(c.skip?' — ข้าม: '+c.skip:''));
      ds.forEach(x=>lines.push('   - '+x));
    });
    if(!n) lines.push('ตรงกันทุกแผน ไม่มีจุดที่ต้องตรวจ'); else lines.push('','กรุณาตรวจเทียบกับเอกสารจริง แล้วแจ้งผลกลับ');
    return lines.join('\n');
  }
  async function copyCompare(){
    const t = compareText(); let ok = false;
    try{ await navigator.clipboard.writeText(t); ok = true; }
    catch(e){ const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText='position:fixed;opacity:0;'; document.body.appendChild(ta); ta.select(); try{ ok = document.execCommand('copy'); }catch(e2){} ta.remove(); }
    S.cmpMsg = ok ? '✓ คัดลอกผลเทียบแล้ว นำไปวางในไลน์/ข้อความได้เลย' : ''; render(); if(!ok) alert('คัดลอกไม่สำเร็จ');
  }
  async function runCompare(silent){
    if(S.busy) return;
    const todo = [];
    S.cmp.forEach((c,i)=>c.actions.forEach(a=>{ if(S.sel[i+':'+a.type]) todo.push({ c, a }); }));
    if(!todo.length) return;
    if(silent!==true && !confirm('จะดำเนินการ '+todo.length+' รายการที่เลือก (สร้างใบที่ขาด / เติมวัสดุที่ไม่มีในใบ พร้อมตัดคลัง)\nใบเดิมไม่ถูกลบหรือแก้ส่วนอื่น\n\nต้องการดำเนินการต่อหรือไม่?')) return;
    S.busy = true;
    let made = 0, filled = 0; const failed = [];
    for(const t of todo){
      try{
        if(t.a.type==='days'){
          for(const it of t.a.items){
            const rec = it.rec; const orderId = FBL.newId('daily_work_orders'); rec.__backendId = orderId;
            const ops = [{ action:'add', table:'daily_work_orders', data:dwoToApi(rec) }].concat(stockOps(rec, orderId));
            const results = await apiBatch(ops); applySubsys3BatchResult(ops, results);
            dailyWorkOrders.push(rec); made++;
          }
        } else {
          const old = t.a.target;
          if(!dailyWorkOrders.some(d=>d.__backendId===old.__backendId)) throw new Error('ไม่พบใบเดิม');
          const merged = Object.assign({}, old, { parts:(old.parts||[]).concat(t.a.parts), note:stripMatFlag(old.note) });
          const newId = FBL.newId('daily_work_orders'); merged.__backendId = newId;
          const delOps = [{ action:'delete', table:'daily_work_orders', id:old.__backendId }]; (await buildSubsys3DeleteOps(old.__backendId, true)).forEach(o=>delOps.push(o));
          const prevRef = await previousRefs([old]);
          const ops = [{ action:'add', table:'daily_work_orders', data:dwoToApi(merged) }].concat(stockOps(merged, newId, prevRef), delOps);
          const results = await apiBatch(ops); applySubsys3BatchResult(ops, results);
          const k = dailyWorkOrders.findIndex(x=>x.__backendId===old.__backendId); if(k>-1) dailyWorkOrders.splice(k,1);
          dailyWorkOrders.push(merged); filled += t.a.parts.length;
        }
      }catch(e){ failed.push(t.c.label+' — '+(e&&e.message?e.message:e)); }
    }
    dailyWorkOrders.forEach((r,i)=>{ r.no = i+1; });
    S.busy = false; renderAll();
    await rebuild();
    S.cmpMsg = 'ดำเนินการแล้ว: สร้างใบที่ขาด '+made+' ใบ · เติมวัสดุ '+filled+' รายการ'+(failed.length?' · ไม่สำเร็จ '+failed.length+' ('+failed.join(' ; ')+')':'');
    render();
  }
  function setMonth(v){ S.importMk = v; rebuild(); }
  function again(){ S.parsed = []; S.skipped = []; S.plan = null; S.result = null; render(); }

  /* ---------- บันทึก ---------- */
  /* prevRef = เลขที่ใบเดิมของใบที่ถูกแทนที่ (วัน+เครื่อง/วัสดุเดียวกัน) เก็บไว้ใส่กลับ จะได้ไม่ต้องคีย์เลขที่ใบใหม่ */
  function stockOps(rec, orderId, prevRef){
    prevRef = prevRef || { fuel:{}, mat:{} };
    const fuelTx = rec.vehicles.filter(r=>r.liters>0).map(r=>({ date:rec.date, fuelType:r.fuelType, kind:'issue', liters:r.liters, vehicle:r.label, note:'เบิกตามใบสั่งการรายวัน', sourceDailyId:orderId, ref:prevRef.fuel[r.label+'|'+rec.date] }));
    const materialTx = rec.parts.map(p=>({ date:rec.date, itemCode:p.code, kind:'issue', qty:p.qty, note:'เบิกตามใบสั่งการรายวัน', sourceDailyId:orderId, ref:prevRef.mat[p.code+'|'+rec.date] }));
    return buildSubsys3AddOps(fuelTx, materialTx);
  }
  async function previousRefs(targets){
    const out = { fuel:{}, mat:{} };
    for(const t of targets){
      const found = await FBL.findDailyOrderTx(t.__backendId);
      found.fuel.forEach(x=>{ if(x.ref) out.fuel[x.vehicleId+'|'+x.date] = x.ref; });
      found.material.forEach(x=>{ if(x.refNo) out.mat[x.materialId+'|'+x.date] = x.refNo; });
    }
    return out;
  }
  /* EC 1-W: ชั่วโมงเครื่องจักรของกรม (รวมทั้งช่วง) แบ่งเท่ากันทุกวัน บันทึกเป็นชั่วโมงปฏิบัติงาน "W" ของเครื่อง/วันนั้น
     (รวมทุกแผนที่ใช้เครื่องเดียวกันวันเดียวกัน) — ใส่ทับเฉพาะช่อง W ไม่แตะช่องอื่นของแถวเดิม */
  function buildEc1w(){
    const map = {};
    S.parsed.forEach(a=>{
      const dates = Array.from(new Set(a.dates.map(iso).filter(Boolean))).sort();
      if(!dates.length) return;
      a.machines.forEach(m=>{
        const v = matchVehicle(m.no); if(!v || !(m.hours>0)) return;
        const arr = splitEven(m.hours, dates.length);
        dates.forEach((d,i)=>{
          if(typeof ledgerLocks!=='undefined' && ledgerLocks[d.slice(0,7)]) return;
          const k = v.label+'|'+d; const o = map[k] || (map[k] = { vehicleId:v.label, date:d, hrW:0 });
          o.hrW = r2(o.hrW + arr[i]);
        });
      });
    });
    return Object.values(map);
  }
  async function writeEc1w(rows){
    if(!rows.length) return { n:0 };
    if(!(FBL.canWriteTable && FBL.canWriteTable('machinery_logs'))) return { n:0, note:'บัญชีนี้ไม่มีสิทธิ์แก้ไข EC 1-W (ระบบที่ 3) — ข้ามขั้นตอนบันทึกชั่วโมงเครื่องจักร' };
    const dates = rows.map(r=>r.date).sort();
    let existing = [];
    try{ existing = await FBL.apiQueryRange('machinery_logs', 'date', dates[0], dates[dates.length-1]+''); }
    catch(e){ return { n:0, note:'อ่านข้อมูล EC 1-W เดิมไม่ได้ — ข้ามขั้นตอนบันทึกชั่วโมงเครื่องจักร ('+(e&&e.message?e.message:e)+')' }; }
    const byKey = {}; existing.forEach(l=>{ byKey[l.vehicleId+'|'+l.date] = l; });
    const ops = rows.map(r=>{
      const ex = byKey[r.vehicleId+'|'+r.date];
      return ex ? { action:'update', table:'machinery_logs', data:{ id:ex.id, hrW:r.hrW } }
                : { action:'add', table:'machinery_logs', data:{ vehicleId:r.vehicleId, date:r.date, hrW:r.hrW, dayOff:false } };
    });
    let n = 0;
    try{ for(let i=0;i<ops.length;i+=120){ await apiBatch(ops.slice(i,i+120)); n += Math.min(120, ops.length-i); } }
    catch(e){ return { n, note:'บันทึก EC 1-W ได้ '+n+' จาก '+ops.length+' แถว แล้วหยุด: '+(e&&e.message?e.message:e) }; }
    return { n };
  }
  async function run(){
    if(S.busy || !S.plan || !S.plan.items.length) return;
    const p = S.plan;
    if(p.replaceCount && !confirm('มีใบสั่งการเดิมที่คีย์เองไว้ '+p.replaceCount+' ใบ (วัน/รหัสงาน/สายทางเดียวกัน) จะถูกลบและแทนที่ด้วยข้อมูลจากกรม พร้อมรายการตัดคลังของใบเดิม\n\nต้องการนำเข้าต่อหรือไม่?')) return;
    S.busy = true;
    const created = new Set();
    const res = { created:0, replaced:0, failed:[], attn:[] };
    for(let i=0;i<p.items.length;i++){
      const it = p.items[i], rec = it.rec;
      render(null, 'กำลังนำเข้า '+(i+1)+' / '+p.items.length+' ... ('+dateTh(rec.date)+' '+it.label+')');
      try{
        const orderId = FBL.newId('daily_work_orders');
        rec.__backendId = orderId;
        // ใบเดิมที่คีย์เอง (ไม่ใช่ที่นำเข้ามา และไม่ใช่ที่เพิ่งสร้างในรอบนี้) ที่ซ้ำ วัน/รหัสงาน/สายทาง
        const targets = dailyWorkOrders.filter(d=>d.date===rec.date && d.code===rec.code && String(d.route||'')===String(rec.route||'') && !created.has(d.__backendId) && !TOKEN_RE.test(String(d.note||'')));
        const delOps = [];
        for(const t of targets){ delOps.push({ action:'delete', table:'daily_work_orders', id:t.__backendId }); (await buildSubsys3DeleteOps(t.__backendId, true)).forEach(o=>delOps.push(o)); }
        const prevRef = targets.length ? await previousRefs(targets) : undefined;
        const ops = [{ action:'add', table:'daily_work_orders', data:dwoToApi(rec) }].concat(stockOps(rec, orderId, prevRef), delOps);
        const results = await apiBatch(ops);
        applySubsys3BatchResult(ops, results);
        targets.forEach(t=>{ const k = dailyWorkOrders.findIndex(x=>x.__backendId===t.__backendId); if(k>-1) dailyWorkOrders.splice(k,1); });
        dailyWorkOrders.push(rec);
        created.add(orderId); res.created++; res.replaced += targets.length;
        const msgs = it.issues.filter(x=>x.t==='attn').map(x=>x.msg);
        if(msgs.length) res.attn.push({ id:orderId, date:rec.date, code:rec.code, msgs });
      }catch(e){
        res.failed.push(dateTh(rec.date)+' · '+it.label+' — '+(e&&e.message?e.message:e));
      }
    }
    dailyWorkOrders.forEach((r,i)=>{ r.no = i+1; });
    if(S.ec1w){
      render(null, 'กำลังบันทึกชั่วโมงเครื่องจักร (EC 1-W)...');
      try{ res.ec1w = await writeEc1w(buildEc1w()); }catch(e){ res.ec1w = { n:0, note:'บันทึก EC 1-W ไม่สำเร็จ: '+(e&&e.message?e.message:e) }; }
    }
    S.busy = false; S.result = res; S.plan = null;
    renderAll();
    render();
  }
  function editOrder(id, fromCheck){
    const rec = dailyWorkOrders.find(d=>d.__backendId===id); if(!rec){ alert('ไม่พบใบสั่งการนี้ (อาจถูกแก้ไขหรือลบไปแล้ว)'); return; }
    if(fromCheck) closeCheck(); else document.getElementById('doh-imp-overlay').classList.add('hidden');
    editDailyEntry(rec.no);
  }

  /* ---------- หน้าต่าง "ตรวจสอบ": รายการใบที่นำเข้าจากกรมแล้วมีจุดต้องตรวจ (อ่านจากหมายเหตุของใบ) ---------- */
  const FLAG = '⚠ต้องตรวจ: ';
  const CK = { mk:'' };
  /* ผู้ที่มีบันทึกลาในวันนั้น แต่ถูกลงว่าทำงานในใบ — ตรวจสดจากข้อมูลการลาปัจจุบัน (ครอบคลุมใบที่นำเข้าไว้ก่อนด้วย) */
  function leaveConflicts(d){
    let leaves = []; try{ leaves = getLeaveHistoryX(); }catch(e){}
    const names = Array.isArray(d.staff) ? d.staff : [];
    return names.filter(n=>leaves.some(l=>l.name===n && l.from<=d.date && d.date<=l.to));
  }
  /* ข้อความ "ไม่พบวัสดุ …" ในหมายเหตุ: ตรวจสดกับทะเบียนพัสดุ+การจับคู่ที่จำไว้ — วัสดุที่จับคู่/เพิ่มเข้าทะเบียนแล้วไม่ถือเป็นจุดต้องตรวจอีก
     (ชื่อวัสดุคั่นด้วย "," แต่ชื่ออาจมีจุลภาคในตัวเลข เช่น "แบบที่ 7,8,9" → ท่อนที่ขึ้นต้นด้วยตัวเลขต่อกลับเข้าท่อนก่อนหน้า) */
  function stillMissingMats(txt){
    const parts = [];
    String(txt).split(',').forEach(s=>{ if(parts.length && /^\s*\d/.test(s)) parts[parts.length-1] += ','+s; else parts.push(s); });
    return parts.map(s=>s.trim()).filter(Boolean).filter(nm=>{ try{ return !matchMaterial(nm); }catch(e){ return true; } });
  }
  function ckProbs(d){
    const n = String(d.note||''), at = n.indexOf(FLAG);
    const probs = [];
    (at<0 ? [] : n.slice(at+FLAG.length).split(' ; ')).map(s=>s.trim()).filter(Boolean).forEach(p=>{
      const m = p.match(/^ไม่พบวัสดุ(?:ในทะเบียน\(ไม่ตัดคลัง\))?\s+([\s\S]+)$/);
      if(!m){ probs.push(p); return; }
      const left = stillMissingMats(m[1]);
      if(left.length) probs.push('ไม่พบวัสดุ '+left.join(', '));
    });
    /* ใบที่นำเข้าจากกรม: ธงเปล่า (เวอร์ชันเก่า) เดิมเกิดจากเทียบวันลากับรายชื่อทั้งแผนที่ใส่ทุกวัน จึงไม่ถือเป็นจุดต้องตรวจ · เรื่องลาของใบนำเข้าใช้ข้อความที่ระบบเขียนตอนนำเข้าเท่านั้น */
    if(TOKEN_RE.test(n)) return probs;
    const lv = leaveConflicts(d);
    if(lv.length && !probs.some(p=>p.indexOf('บันทึกลา')>=0)) probs.push('มีบันทึกลาวันนี้แต่ลงว่าทำงาน: '+lv.join(', '));
    return probs;
  }
  function flagged(){
    return (typeof dailyWorkOrders!=='undefined' ? dailyWorkOrders : []).filter(d=>TOKEN_RE.test(String(d.note||'')) && ckProbs(d).length);
  }
  function ckItems(mk){
    return flagged().filter(d=>String(d.date).slice(0,7)===mk).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.code<b.code?-1:1)).map(d=>{
      const j = findJob(d.code);
      return { id:d.__backendId, no:d.no, date:d.date, code:d.code, name:(j&&j.name)||'', loc:d.loc||'', probs:ckProbs(d) };
    });
  }
  function ckDefaultMonth(){
    const sel = (typeof dwSel!=='undefined' && dwSel) ? String(dwSel).slice(0,7) : '';
    return sel || new Date().toISOString().slice(0,7);
  }
  function ckText(mk){
    const items = ckItems(mk);
    if(!items.length) return 'ข้อมูลนำเข้าจากกรม '+mkLabel(mk)+' — ไม่มีรายการที่ต้องตรวจ';
    const lines = ['รายการที่ต้องตรวจสอบ — ข้อมูลนำเข้าจากกรม (rmms) ประจำ'+mkLabel(mk)+' รวม '+items.length+' ใบ',''];
    items.forEach((x,i)=>{
      lines.push((i+1)+'. วันที่ '+dateTh(x.date)+' · รหัสงาน '+x.code+(x.name?' '+x.name:'')+(x.loc?' · '+x.loc:''));
      x.probs.forEach(p=>lines.push('   - '+p));
    });
    lines.push('','กรุณาตรวจเทียบกับเอกสารจริง แล้วแจ้งผลกลับ');
    return lines.join('\n');
  }
  function ckOverlay(){
    let ov = document.getElementById('doh-ck-overlay');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'doh-ck-overlay'; ov.className = 'modal-overlay no-print hidden';
      ov.innerHTML = '<div class="modal-box modal-l dohi-box"><div class="modal-head dohi-head">'
        + '<div class="dohi-head-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8.5 11l2 2 3.5-4"/></svg></div>'
        + '<div><h3>จุดที่ต้องตรวจสอบ</h3><div class="dohi-sub">ใบสั่งการที่นำเข้าจากกรมแล้วมีข้อมูลไม่ครบ — คัดลอกส่งเจ้าหน้าที่ตรวจได้</div></div>'
        + '<button class="modal-close" onclick="DohImp.closeCheck()" aria-label="ปิด">✕</button></div>'
        + '<div class="modal-body" id="doh-ck-body"></div><div class="modal-foot dohi-foot" id="doh-ck-foot"></div></div>';
      document.body.appendChild(ov);
    }
    return ov;
  }
  function ckRender(){
    const body = document.getElementById('doh-ck-body'), foot = document.getElementById('doh-ck-foot'); if(!body) return;
    const mks = new Set(flagged().map(d=>String(d.date).slice(0,7))); mks.add(CK.mk);
    const opts = Array.from(mks).sort().reverse().map(k=>'<option value="'+k+'" '+(k===CK.mk?'selected':'')+'>'+mkLabel(k)+'</option>').join('');
    const items = ckItems(CK.mk);
    const list = items.length
      ? '<div style="overflow:auto"><table class="dohi-table"><thead><tr><th>วันที่</th><th>รหัสงาน / สายทาง</th><th>สิ่งที่ต้องตรวจ</th><th></th></tr></thead><tbody>'
        + items.map(x=>'<tr><td style="white-space:nowrap">'+H(dateTh(x.date))+'</td><td>'+H(x.code)+(x.name?' '+H(x.name):'')+(x.loc?'<br><small>'+H(x.loc)+'</small>':'')+'</td><td>'+x.probs.map(p=>H(p)).join('<br>')+'</td><td><button class="btn btn-ghost btn-sm" onclick="DohImp.editOrder(\''+H(x.id)+'\',true)">✎ แก้ไข</button></td></tr>').join('')
        + '</tbody></table></div>'
      : '<div class="dohi-note ok">เดือนนี้ไม่มีใบที่ต้องตรวจ</div>';
    body.innerHTML = '<div class="dohi-bar"><span>เดือน <select onchange="DohImp.setCheckMonth(this.value)">'+opts+'</select></span><span><b>'+items.length+'</b> ใบที่ต้องตรวจ</span></div>'
      + list
      + '<div class="dohi-note" style="margin-top:12px">ตรวจ/แก้ใบแล้ว ให้ลบข้อความ "⚠ต้องตรวจ: ..." ออกจากช่องหมายเหตุของใบนั้น รายการจะหายไปจากหน้านี้ · เรื่องลางาน ระบบเทียบกับบันทึกการลาสด ๆ จะหายเมื่อเอาชื่อผู้ลาออกจากใบ หรือแก้วันลา</div>';
    if(foot) foot.innerHTML = '<span id="doh-ck-msg" style="margin-right:auto;font-size:13px;color:#1c8a53"></span><button class="btn btn-ghost" onclick="DohImp.closeCheck()">ปิด</button><button class="btn btn-primary" '+(items.length?'':'disabled')+' onclick="DohImp.copyCheck()">📋 คัดลอกรายการ</button>';
  }
  function openCheck(){
    ensureCss();
    CK.mk = ckDefaultMonth();
    ckOverlay().classList.remove('hidden');
    ckRender();
  }
  function closeCheck(){ const ov = document.getElementById('doh-ck-overlay'); if(ov) ov.classList.add('hidden'); }
  function setCheckMonth(v){ CK.mk = v; ckRender(); }
  async function copyCheck(){
    const t = ckText(CK.mk), msg = document.getElementById('doh-ck-msg');
    let ok = false;
    try{ await navigator.clipboard.writeText(t); ok = true; }
    catch(e){
      const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0;'; document.body.appendChild(ta); ta.select();
      try{ ok = document.execCommand('copy'); }catch(e2){} ta.remove();
    }
    if(msg){ msg.textContent = ok ? '✓ คัดลอกแล้ว นำไปวางในไลน์/ข้อความได้เลย' : 'คัดลอกไม่สำเร็จ'; msg.style.color = ok ? '#1c8a53' : '#c1402f'; }
  }
  /* ตัวเลขบนไอคอน = จำนวนใบที่ต้องตรวจของเดือนที่กำลังดูอยู่ (ตามวันที่เลือกในแถบสัปดาห์) */
  function updateBadge(){
    const btn = document.getElementById('doh-ck-btn'); if(!btn) return;
    let n = 0; try{ n = ckItems(ckDefaultMonth()).length; }catch(e){}
    let b = btn.querySelector('.dohi-badge');
    if(!n){ if(b) b.remove(); return; }
    if(!b){ b = document.createElement('span'); b.className = 'dohi-badge'; btn.appendChild(b); }
    b.textContent = n > 99 ? '99+' : n;
  }
  setInterval(updateBadge, 2000);

  function setEc1w(v){ S.ec1w = !!v; }
  window.DohImp = { openImport, close, onFiles, setMonth, run, again, editOrder, setEc1w, openCheck, closeCheck, setCheckMonth, copyCheck, setMode, togAct, copyCompare, runCompare, togFuel, addMissing, pickExisting, pickInput, pickKey, pickChoose, pickClose };
})();
