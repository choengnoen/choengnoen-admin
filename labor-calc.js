/* ===== สูตรคำนวณบัญชีแรงงานรายวัน (ง.3-12) — ใช้ร่วมกันระหว่างระบบที่ 4 (การเงิน) กับระบบหลัก (ภาพรวมงบประมาณ)
   แก้กฎการนับวันทำงาน/วันหยุดที่ไฟล์นี้ที่เดียว ทั้งบัญชีแรงงานและยอด "งบซ่อมบำรุง" ในหน้าภาพรวมจะตรงกันเสมอ
   ทุกฟังก์ชันรับข้อมูลเข้ามาเป็นพารามิเตอร์ (ไม่อ่านตัวแปรของหน้าใดหน้าหนึ่ง) */
(function () {
  'use strict';
  if (window.LaborCalc) return;

  // วันหยุดนักขัตฤกษ์ต่อรอบบิล (YYYY-MM) — จ่ายค่าจ้างเสมือนมาปฏิบัติงานตามหมายเหตุที่ระบุ
  // วันหยุดใหม่ให้เพิ่มที่ระบบที่ 1 → การลา → วันหยุดนักขัตฤกษ์ (ตาราง public_holidays) แทนการแก้โค้ดตรงนี้
  const THAI_HOLIDAYS = {
    '2026-04': [
      { day: 6, name: 'วันจักรี' },
      { day: 13, name: 'วันสงกรานต์ (วันผู้สูงอายุ)' },
      { day: 14, name: 'วันสงกรานต์ (วันครอบครัว)' },
      { day: 15, name: 'วันสงกรานต์ (วันเถลิงศก)' },
    ],
    '2026-05': [
      { day: 1, name: 'วันแรงงานแห่งชาติ' },
      { day: 4, name: 'วันฉัตรมงคล' },
      { day: 9, name: 'วันพืชมงคล' },
    ],
    '2026-07': [
      { day: 28, name: 'วันเฉลิมพระชนมพรรษา ร.10' },
      { day: 29, name: 'วันอาสาฬหบูชา' },
      { day: 30, name: 'วันเข้าพรรษา' },
    ],
  };
  // แผนที่ประเภทการลา (ระบบที่ 1) → รหัสลงเวลาที่ใช้ในตาราง ง.3-12
  const LEAVE_TYPE_CODE = { 'ป่วย': 'ป', 'กิจ': 'ก', 'พักผ่อน': 'พ', 'คลอดบุตร': 'ค', 'ไปราชการ': 'ร', 'ขาดงาน': 'ข' };
  // มาปฏิบัติงานเต็มวัน + ลาที่ได้รับอนุมัติทุกประเภท นับเป็นวันทำงาน (ไม่รวม ข/ขาดงาน, ปx/ลาป่วยเกินสิทธิ์ และ -/วันหยุด)
  const WORKDAY_CODES = new Set(['1', 'ป', 'ก', 'พ', 'ค', 'ร']);
  /* ลาป่วยได้รับค่าจ้างไม่เกิน 15 วันทำการต่อปีงบประมาณ (1 ต.ค. – 30 ก.ย.)
     วันลาป่วยที่เกินสิทธิ์ใช้รหัส 'ปx' — แสดงในแบบฟอร์มเป็น "ป" แต่ไม่นับเป็นวันทำงาน/ไม่จ่ายค่าจ้าง */
  const SICK_PAID_LIMIT = 15;
  const UNPAID_SICK_CODE = 'ปx';

  /* หน้าที่ยาม = จ้างรวมวันเสาร์ (วันอาทิตย์หยุด) ตั้งแต่วันเริ่มปฏิบัติหน้าที่ยาม (dutyStart ว่าง = ทุกวัน) */
  function isGuard(emp) { return String(emp && emp.duty || '').includes('ยาม'); }
  function worksSaturday(emp, iso) { return isGuard(emp) && (!emp.dutyStart || iso >= emp.dutyStart); }

  function daysInCycle(key) { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); }

  // รวมวันหยุดในโค้ดด้านบนกับแถวจากตาราง public_holidays ({date:'YYYY-MM-DD', name})
  function holidaysOf(cycleKey, publicHolidays) {
    const list = (THAI_HOLIDAYS[cycleKey] || []).slice();
    (publicHolidays || []).forEach(h => {
      const iso = String(h.date || '');
      if (iso.slice(0, 7) !== cycleKey) return;
      const day = parseInt(iso.slice(8, 10), 10);
      if (day && !list.some(x => x.day === day)) list.push({ day, name: h.name || 'วันหยุดนักขัตฤกษ์' });
    });
    return list.sort((a, b) => a.day - b.day);
  }

  // คำขอลาที่ยื่นเข้าระบบ = ลาจริงทั้งหมด ยกเว้น cancelled (ใบลาจริงต้องลงนามบนกระดาษอยู่แล้ว)
  function leaveCodeForDay(leaves, name, dateISO) {
    const hit = leaves.find(r => r.name === name && r.status !== 'cancelled' && dateISO >= r.from && dateISO <= r.to);
    return hit ? (LEAVE_TYPE_CODE[hit.type] || null) : null;
  }

  // นายสุรศักดิ์ สุขคุ้ม ตำแหน่งจริงคือ "คนงาน" (หน้าที่พิเศษ "ยาม") — ข้อมูลเก่าที่ยังเป็นตำแหน่ง "ยาม" ให้แก้ก่อนกรอง
  function normalizeStaff(staffRows) {
    return (staffRows || []).map(s => (s.name === 'นายสุรศักดิ์  สุขคุ้ม' && s.role === 'ยาม') ? Object.assign({}, s, { role: 'คนงาน', duty: s.duty || 'ยาม' }) : s);
  }
  /* วันสุดท้ายที่ปฏิบัติงาน: ผู้เกษียณอายุ = retiredDate, ผู้ลาออก = วันก่อน resignedDate (วันที่ลาออกมีผล)
     ผู้ลาออก/เกษียณที่ไม่ได้ระบุวันที่ = null (ไม่ทราบช่วงเวลา) */
  function lastDayOf(s) {
    if (s.status === 'retired') return s.retiredDate || null;
    if (s.status === 'resigned' && s.resignedDate) {
      const d = new Date(s.resignedDate + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return null;
  }
  /* ประวัติอัตราค่าจ้าง (rateHistory) = [{from:'YYYY-MM-DD' หรือ '' (อัตราแรกเริ่ม), rate, note}] ตั้งค่าที่ระบบที่ 1 → ข้อมูลบุคลากร
     ไม่มีประวัติ = ใช้ rate ค่าเดียวตลอด */
  function rateHistoryOf(s) {
    let h = s && s.rateHistory;
    if (typeof h === 'string') { try { h = JSON.parse(h); } catch (e) { h = null; } }
    if (!Array.isArray(h)) return [];
    return h.filter(r => r && r.rate !== '' && r.rate != null && isFinite(Number(r.rate)))
      .map(r => ({ from: r.from || '', rate: Number(r.rate), note: r.note || '' }))
      .sort((a, b) => a.from.localeCompare(b.from));
  }
  // อัตราค่าจ้างที่ใช้ในวันที่ iso
  function rateOn(emp, iso) {
    const h = rateHistoryOf(emp);
    if (!h.length) return Number(emp && emp.rate) || 0;
    let hit = h[0];
    h.forEach(r => { if (r.from <= iso) hit = r; });
    return hit.rate;
  }
  // การปรับอัตราที่มีผลระหว่างเดือน (หลังวันที่ 1 ถึงสิ้นเดือน) — ใช้เขียนหมายเหตุท้ายแบบ ง.3-26
  function rateChangesIn(emp, cycleKey) {
    const from = cycleKey + '-01', to = cycleKey + '-' + String(daysInCycle(cycleKey)).padStart(2, '0');
    return rateHistoryOf(emp).filter(r => r.from > from && r.from <= to);
  }

  // ช่วงเวลาที่ปฏิบัติงานจริง: ตั้งแต่ startDate (ว่าง = ไม่จำกัด) ถึงวันสุดท้ายที่ปฏิบัติงาน
  function servedIn(s, from, to) {
    if (s.startDate && s.startDate > to) return false;
    if (s.status === 'ok') return true;
    const last = lastDayOf(s);
    return !!last && last >= from;
  }
  // รายชื่อในบัญชีแรงงาน: ตำแหน่ง "คนงาน" ที่ปฏิบัติงานอยู่ในรอบเดือน cycleKey (YYYY-MM)
  // ไม่ระบุ cycleKey = เฉพาะผู้ที่ยังปฏิบัติงานอยู่ปัจจุบัน
  function rosterFrom(staffRows, cycleKey) {
    const from = cycleKey ? cycleKey + '-01' : '';
    const to = cycleKey ? cycleKey + '-' + String(daysInCycle(cycleKey)).padStart(2, '0') : '';
    return normalizeStaff(staffRows)
      .filter(s => s.role === 'คนงาน' && (cycleKey ? servedIn(s, from, to) : s.status === 'ok'))
      .map(s => ({ name: s.name, role: s.role, duty: s.duty || null, dutyStart: s.dutyStart || null, rate: (s.rate === '' || s.rate == null) ? 0 : (Number(s.rate) || 0), bankAcc: s.bankAcc || '',
        startDate: s.startDate || null, endDate: s.status === 'ok' ? null : lastDayOf(s), rateHistory: rateHistoryOf(s) }));
  }

  // รหัสลงเวลาของวันหนึ่ง (ยังไม่คิดโควตาลาป่วย)
  function rawDayCode(emp, y, m, d, holidays, leaves) {
    const dateISO = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dow = new Date(y, m - 1, d).getDay();
    if ((emp.startDate && dateISO < emp.startDate) || (emp.endDate && dateISO > emp.endDate)) return '-'; // นอกช่วงที่ปฏิบัติงานจริง ไม่จ่ายค่าจ้าง
    if (holidays.has(d)) return '1'; // วันหยุดนักขัตฤกษ์ จ่ายค่าจ้างเสมือนมาปฏิบัติงาน
    if (dow === 0) return '-'; // อาทิตย์หยุดทุกตำแหน่ง
    if (dow === 6 && !worksSaturday(emp, dateISO)) return '-'; // เสาร์หยุด ยกเว้นผู้ปฏิบัติหน้าที่ยาม
    return leaveCodeForDay(leaves, emp.name, dateISO) || '1'; // ไม่มีคำขอลา → ถือว่ามาปฏิบัติงาน
  }
  // รอบเดือนก่อนหน้า cycleKey ในปีงบประมาณเดียวกัน (ต.ค. ถึงเดือนก่อน cycleKey)
  function earlierCyclesInFy(cycleKey) {
    const [y, m] = cycleKey.split('-').map(Number);
    const list = [];
    let cy = m >= 10 ? y : y - 1, cm = 10;
    while (cy * 100 + cm < y * 100 + m) {
      list.push(`${cy}-${String(cm).padStart(2, '0')}`);
      cm++; if (cm === 13) { cm = 1; cy++; }
    }
    return list;
  }

  // รหัสลงเวลารายวันของแต่ละคนในรอบเดือน → { name: ['1','-','ป','ปx',...] }
  function attendanceOf(cycleKey, roster, leaves, publicHolidays) {
    const [y, m] = cycleKey.split('-').map(Number);
    const nDays = daysInCycle(cycleKey);
    const holidays = new Set(holidaysOf(cycleKey, publicHolidays).map(h => h.day));
    const lv = leaves || [];
    const earlier = earlierCyclesInFy(cycleKey).map(k => {
      const [ky, km] = k.split('-').map(Number);
      return { ky, km, n: daysInCycle(k), hol: new Set(holidaysOf(k, publicHolidays).map(h => h.day)) };
    });
    const map = {};
    (roster || []).forEach(emp => {
      // วันลาป่วยที่ใช้ไปแล้วในปีงบประมาณนี้ก่อนเดือนนี้
      let sickUsed = 0;
      if (lv.some(r => r.name === emp.name && r.type === 'ป่วย')) {
        earlier.forEach(e => { for (let d = 1; d <= e.n; d++) if (rawDayCode(emp, e.ky, e.km, d, e.hol, lv) === 'ป') sickUsed++; });
      }
      const codes = [];
      for (let d = 1; d <= nDays; d++) {
        let c = rawDayCode(emp, y, m, d, holidays, lv);
        if (c === 'ป' && ++sickUsed > SICK_PAID_LIMIT) c = UNPAID_SICK_CODE; // ลาป่วยเกินสิทธิ์ ไม่จ่ายค่าจ้าง
        codes.push(c);
      }
      map[emp.name] = codes;
    });
    return map;
  }

  function workDays(codes) { return (codes || []).filter(c => WORKDAY_CODES.has(c)).length; }

  // ค่าจ้างของคนหนึ่งในรอบเดือน = Σ อัตราค่าจ้างของแต่ละวันทำงาน (รองรับการปรับอัตราระหว่างเดือน) ปัดเป็นสตางค์
  function amountOf(emp, codes, cycleKey) {
    let sum = 0;
    (codes || []).forEach((c, i) => { if (WORKDAY_CODES.has(c)) sum += rateOn(emp, cycleKey + '-' + String(i + 1).padStart(2, '0')); });
    return Math.round(sum * 100) / 100;
  }

  // ค่าจ้างรวมของรอบเดือน = Σ ค่าจ้างของแต่ละคน
  function spendOf(cycleKey, roster, leaves, publicHolidays) {
    const att = attendanceOf(cycleKey, roster, leaves, publicHolidays);
    return (roster || []).reduce((sum, e) => sum + amountOf(e, att[e.name], cycleKey), 0);
  }

  window.LaborCalc = { THAI_HOLIDAYS, LEAVE_TYPE_CODE, WORKDAY_CODES, SICK_PAID_LIMIT, UNPAID_SICK_CODE, isGuard, worksSaturday, daysInCycle, holidaysOf, leaveCodeForDay, normalizeStaff, rosterFrom, attendanceOf, workDays, spendOf, rateHistoryOf, rateOn, rateChangesIn, amountOf };
})();
