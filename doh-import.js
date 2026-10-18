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
  const S = { parsed:[], skipped:[], plan:null, importMk:'', mixed:false, busy:false, result:null };

  const H = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = x => { const v = parseFloat(String(x==null?'':x).replace(/,/g,'')); return isNaN(v)?0:v; };
  const r2 = x => Math.round((x+Number.EPSILON)*100)/100;
  const digits = s => String(s||'').replace(/\D/g,'');
  const normText = s => String(s||'').replace(/\s+/g,'').toLowerCase();
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
    const a = { file:fname, plan:'', qty:0, jobCode:'', jobName:'', route:'', control:'', kmStart:'', kmEnd:'', dates:[], labor:[], machines:[], mats:[], sum:{} };
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
      else if(mode==='lab' && k && k!=='รวม') a.labor.push(k);
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
    let hit = list.find(m=>normText(m.name)===n);
    if(hit) return { m:hit, approx:false };
    if(n.length>=4){ hit = list.find(m=>{ const k = normText(m.name); return k.length>=4 && (k.indexOf(n)>=0 || n.indexOf(k)>=0); }); if(hit) return { m:hit, approx:true }; }
    return null;
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
      const litersArr = vehBase.map(x=>splitEven(x.liters, days));
      dates.forEach((date, i)=>{
        const mk = date.slice(0,7);
        const token = '[กรม:'+mk+':'+a.plan+']';
        if(typeof ledgerLocks!=='undefined' && ledgerLocks[mk]){ out.skipLocked.push(dateTh(date)+' · '+label); return; }
        if(dailyWorkOrders.some(d=>d.date===date && String(d.note||'').indexOf(token)>=0)){ out.skipDone++; return; }
        const issues = [];
        if(missVeh.length) issues.push({ t:'attn', msg:'ไม่พบเครื่องจักรในทะเบียน (ไม่ได้ตัดน้ำมัน): '+missVeh.join(', ') });
        if(missMat.length && i===0) issues.push({ t:'attn', msg:'ไม่พบวัสดุในทะเบียนพัสดุ (ไม่ได้ตัดคลัง): '+missMat.join(', ') });
        const onLeave = staffNames.filter(n=>leaves.some(l=>l.name===n && l.from<=date && date<=l.to));
        if(onLeave.length) issues.push({ t:'attn', msg:'มีบันทึกการลาในวันนี้ แต่กรมลงว่าทำงาน: '+onLeave.join(', ') });
        if(approx.length && i===0) issues.push({ t:'info', msg:'จับคู่วัสดุโดยประมาณ: '+approx.join(' · ') });
        if(staffUnmatched.length) issues.push({ t:'info', msg:'ชื่อแรงงานที่ไม่พบในทะเบียนบุคลากร: '+staffUnmatched.join(', ') });
        if(!route) issues.push({ t:'info', msg:'สาย '+a.route+' ตอน '+a.control+' ไม่อยู่ในทางหลวงควบคุม (บันทึกเป็น "อื่นๆ")' });
        const attnTxt = issues.filter(x=>x.t==='attn').length ? ' ⚠ต้องตรวจ: '+[missVeh.length?'ไม่พบเครื่อง '+missVeh.join(','):'', (missMat.length&&i===0)?'ไม่พบวัสดุ '+missMat.join(','):''].filter(Boolean).join(' ; ') : '';
        const rec = {
          no:0, __backendId:null, date, code:a.jobCode, kmStart:a.kmStart, kmEnd:a.kmEnd, route:routeValue, loc,
          staff:staffNames.slice(), staffLabel:staffNames.map(n=>{ const c = crewLabelOf(n); return c?n+' ('+c+')':n; }).join(', '),
          vehicles:vehBase.map((x,j)=>({ label:x.v.label, liters:litersArr[j][i], fuelType:x.v.fuelType||'' })),
          vehicle:vehBase.map(x=>x.v.label).join(', '),
          parts: i===0 ? partsAll.map(p=>({ code:p.code, qty:p.qty })) : [],
          qty:qtyArr[i], qtyPending:false, unit:job.unit||'',
          material: i===0 ? (a.sum['ค่าวัสดุ']||0) : 0, labor:laborArr[i], rent:rentArr[i], fuel:fuelArr[i],
          note:('นำเข้าจากกรม '+mkLabel(mk)+' แผน '+a.plan+' (วันที่ '+(i+1)+'/'+days+') '+token+attnTxt).slice(0,400)
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
      .dohi-box{max-width:980px;width:96%;max-height:90vh;overflow:auto;}
      .dohi-note{background:#f5f6f4;border:1px solid #dfe2dd;border-radius:10px;padding:10px 14px;font-size:13px;color:#4d5a66;line-height:1.65;margin:0 0 12px;}
      .dohi-note.warn{background:#fdf1d9;color:#7a5000;border-color:#f2d28c;}
      .dohi-note.bad{background:#fbeae7;color:#c1402f;border-color:#f0b9b0;}
      .dohi-note.ok{background:#e5f4ec;color:#1c8a53;border-color:#b6dfc8;}
      .dohi-kpi{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px;}
      .dohi-kpi div{background:#fff;border:1px solid #dfe2dd;border-radius:10px;padding:6px 12px;font-size:12.5px;color:#4d5a66;}
      .dohi-kpi b{display:block;font-size:19px;color:#182430;}
      .dohi-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 12px;}
      .dohi-bar select{font-family:inherit;font-size:14px;padding:6px 10px;border:1px solid #dfe2dd;border-radius:8px;background:#fff;}
      .dohi-table{width:100%;border-collapse:collapse;font-size:13px;}
      .dohi-table th,.dohi-table td{padding:6px 8px;border-bottom:1px solid #dfe2dd;text-align:left;vertical-align:top;}
      .dohi-table th{color:#4d5a66;font-size:12.5px;background:#f5f6f4;}
      .dohi-list{margin:4px 0 0;padding-left:18px;}
    `;
    document.head.appendChild(st);
  }
  function overlay(){
    let ov = document.getElementById('doh-imp-overlay');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'doh-imp-overlay'; ov.className = 'modal-overlay no-print hidden';
      ov.innerHTML = '<div class="modal-box dohi-box"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><h3 style="margin:0;">📥 นำเข้าข้อมูลจากกรม (rmms) เป็นใบสั่งการรายวัน</h3>'
        + '<button class="modal-close" onclick="DohImp.close()">✕</button></div><div id="doh-imp-body"></div></div>';
      document.body.appendChild(ov);
    }
    return ov;
  }
  function close(){ if(S.busy && !confirm('กำลังนำเข้าอยู่ ปิดหน้าต่างไม่หยุดการนำเข้า ต้องการปิดจริงหรือไม่?')) return; const ov = document.getElementById('doh-imp-overlay'); if(ov) ov.classList.add('hidden'); }
  function openImport(){
    if(typeof requireAdmin==='function' && !requireAdmin()) return;
    ensureCss();
    if(!S.busy){ S.parsed = []; S.skipped = []; S.plan = null; S.result = null; }
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
    if(progress){ body.innerHTML = '<div class="dohi-note">'+H(progress)+'</div>'; return; }
    if(S.result){ body.innerHTML = renderResult(); return; }
    const intro = '<div class="dohi-note"><b>วิธีใช้:</b> เลือกไฟล์ <b>Export_CSV ทุกไฟล์ของเดือนเดียวกัน</b> จากระบบกรม (เลือกพร้อมกันหลายไฟล์) ระบบอ่านในเครื่องคุณเท่านั้น แล้วสร้างเป็น<b>รายการใบสั่งการรายวัน</b>ในหน้านี้ พร้อมตัดคลังน้ำมัน/วัสดุให้อัตโนมัติ — จากนั้นเปิดแต่ละใบเทียบกับกระดาษและแก้ในฟอร์มเดิมได้<br>'
      + '<b>กติกา:</b> ยอดรวมทั้งช่วงของกรมแบ่งเท่ากันทุกวันที่ปฏิบัติงาน (วัสดุลงวันแรก) · ใบที่คีย์เองไว้แล้ว (วัน/รหัสงาน/สายทางเดียวกัน) จะถูก<b>แทนที่</b> · นำเข้าไฟล์เดิมซ้ำได้ ระบบข้ามใบที่เคยนำเข้าแล้ว</div>';
    if(!S.parsed.length){
      body.innerHTML = intro + (msg?'<div class="dohi-note bad">'+H(msg)+'</div>':'') + '<div class="dohi-bar">'+pickHtml()+'</div>'; return;
    }
    const p = S.plan;
    const kpi = p ? '<div class="dohi-kpi"><div><b>'+S.parsed.length+'</b>ไฟล์กิจกรรมที่อ่าน</div><div><b>'+p.items.length+'</b>ใบสั่งการที่จะสร้าง</div>'
      + '<div><b>'+p.replaceCount+'</b>ใบเดิมที่จะถูกแทนที่</div>'
      + '<div><b style="color:#c1402f">'+p.items.filter(x=>x.issues.some(i=>i.t==='attn')).length+'</b>ใบที่ควรตรวจหลังนำเข้า</div>'
      + '<div><b>'+p.skipDone+'</b>ข้าม (เคยนำเข้าแล้ว)</div></div>' : '';
    const skipBlocks = p ? [['ข้าม: ไฟล์กรมไม่ระบุวันที่ปฏิบัติงาน (ต้องคีย์เอง)', p.skipNoDate],['ข้าม: ไม่พบรหัสงานในข้อมูลอ้างอิง', p.skipNoJob],['ข้าม: เดือนถูกล็อกบัญชีพัสดุแล้ว', p.skipLocked]]
      .filter(x=>x[1].length).map(x=>'<div class="dohi-note warn"><b>'+x[0]+' ('+x[1].length+')</b><ul class="dohi-list">'+x[1].slice(0,12).map(s=>'<li>'+H(s)+'</li>').join('')+(x[1].length>12?'<li>… อีก '+(x[1].length-12)+'</li>':'')+'</ul></div>').join('') : '';
    body.innerHTML = intro
      + (msg?'<div class="dohi-note bad">'+H(msg)+'</div>':'')
      + (S.skipped.length?'<div class="dohi-note warn">ข้าม '+S.skipped.length+' ไฟล์ที่ไม่ใช่ผลงานรายกิจกรรม: '+H(S.skipped.join(', '))+'</div>':'')
      + (S.mixed?'<div class="dohi-note warn">ไฟล์มีวันที่ปฏิบัติงานหลายเดือนปนกัน — ควรเลือกไฟล์ทีละเดือน</div>':'')
      + '<div class="dohi-bar">'+pickHtml()+'<span>เดือนของไฟล์ <select onchange="DohImp.setMonth(this.value)">'+monthOptions(S.importMk)+'</select></span></div>'
      + kpi + skipBlocks
      + '<div class="dohi-bar"><button class="btn btn-primary" '+(p&&p.items.length?'':'disabled')+' onclick="DohImp.run()">นำเข้า '+(p?p.items.length:0)+' ใบสั่งการ</button>'
      + '<button class="btn btn-ghost" onclick="DohImp.close()">ยกเลิก</button></div>';
  }
  function renderResult(){
    const r = S.result;
    const attn = r.attn.length ? '<div class="dohi-note warn"><b>ใบที่ควรตรวจ/แก้ ('+r.attn.length+')</b> — กดแก้ไขเพื่อเปิดฟอร์มใบสั่งการเดิม'
      + '<div style="overflow:auto"><table class="dohi-table"><thead><tr><th>วันที่</th><th>รหัสงาน</th><th>สิ่งที่ต้องตรวจ</th><th></th></tr></thead><tbody>'
      + r.attn.map(a=>'<tr><td>'+H(dateTh(a.date))+'</td><td>'+H(a.code)+'</td><td>'+a.msgs.map(m=>H(m)).join('<br>')+'</td><td><button class="btn btn-ghost btn-sm" onclick="DohImp.editOrder(\''+H(a.id)+'\')">✎ แก้ไข</button></td></tr>').join('')
      + '</tbody></table></div></div>' : '';
    const fail = r.failed.length ? '<div class="dohi-note bad"><b>นำเข้าไม่สำเร็จ ('+r.failed.length+' ใบ — ไม่มีข้อมูลของใบเหล่านี้ถูกบันทึก)</b><ul class="dohi-list">'+r.failed.slice(0,15).map(f=>'<li>'+H(f)+'</li>').join('')+'</ul>นำเข้าไฟล์เดิมซ้ำเพื่อลองใหม่ได้ ระบบข้ามใบที่สำเร็จแล้ว</div>' : '';
    return '<div class="dohi-note ok"><b>นำเข้าเสร็จแล้ว:</b> สร้างใบสั่งการ '+r.created+' ใบ'+(r.replaced?' · แทนที่ใบเดิม '+r.replaced+' ใบ':'')+' (ตัดคลังน้ำมัน/วัสดุตามใบแล้ว) — เปิดดูได้ที่รายการใบสั่งการรายวัน ค้นหาด้วยคำว่า "นำเข้าจากกรม"</div>'
      + fail + attn
      + '<div class="dohi-bar"><button class="btn btn-primary" onclick="DohImp.close()">ปิด</button><button class="btn btn-ghost" onclick="DohImp.again()">นำเข้าไฟล์เพิ่ม</button></div>';
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
    await rebuild();
  }
  async function rebuild(){
    render(null, 'กำลังอ่านข้อมูลอ้างอิงและจับคู่...');
    try{ S.plan = await buildPlan(); }catch(e){ S.plan = null; render('จับคู่ข้อมูลไม่สำเร็จ: '+(e&&e.message?e.message:e)); return; }
    render();
  }
  function setMonth(v){ S.importMk = v; rebuild(); }
  function again(){ S.parsed = []; S.skipped = []; S.plan = null; S.result = null; render(); }

  /* ---------- บันทึก ---------- */
  function stockOps(rec, orderId){
    const fuelTx = rec.vehicles.filter(r=>r.liters>0).map(r=>({ date:rec.date, fuelType:r.fuelType, kind:'issue', liters:r.liters, vehicle:r.label, note:'เบิกตามใบสั่งการรายวัน', sourceDailyId:orderId }));
    const materialTx = rec.parts.map(p=>({ date:rec.date, itemCode:p.code, kind:'issue', qty:p.qty, note:'เบิกตามใบสั่งการรายวัน', sourceDailyId:orderId }));
    return buildSubsys3AddOps(fuelTx, materialTx);
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
        const ops = [{ action:'add', table:'daily_work_orders', data:dwoToApi(rec) }].concat(stockOps(rec, orderId), delOps);
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
    S.busy = false; S.result = res; S.plan = null;
    renderAll();
    render();
  }
  function editOrder(id){
    const rec = dailyWorkOrders.find(d=>d.__backendId===id); if(!rec){ alert('ไม่พบใบสั่งการนี้ (อาจถูกแก้ไขหรือลบไปแล้ว)'); return; }
    document.getElementById('doh-imp-overlay').classList.add('hidden');
    editDailyEntry(rec.no);
  }

  window.DohImp = { openImport, close, onFiles, setMonth, run, again, editOrder };
})();
