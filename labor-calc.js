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
  // มาปฏิบัติงานเต็มวัน + ลาที่ได้รับอนุมัติทุกประเภท นับเป็นวันทำงาน (ไม่รวม ข/ขาดงาน และ -/วันหยุด)
  const WORKDAY_CODES = new Set(['1', 'ป', 'ก', 'พ', 'ค', 'ร']);

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
  // รายชื่อในบัญชีแรงงาน: เฉพาะพนักงานที่ยังปฏิบัติงานอยู่และตำแหน่ง "คนงาน"
  function rosterFrom(staffRows) {
    return normalizeStaff(staffRows)
      .filter(s => s.status === 'ok' && s.role === 'คนงาน')
      .map(s => ({ name: s.name, role: s.role, duty: s.duty || null, dutyStart: s.dutyStart || null, rate: (s.rate === '' || s.rate == null) ? 0 : (Number(s.rate) || 0), bankAcc: s.bankAcc || '' }));
  }

  // รหัสลงเวลารายวันของแต่ละคนในรอบเดือน → { name: ['1','-','ป',...] }
  function attendanceOf(cycleKey, roster, leaves, publicHolidays) {
    const [y, m] = cycleKey.split('-').map(Number);
    const nDays = daysInCycle(cycleKey);
    const holidays = new Set(holidaysOf(cycleKey, publicHolidays).map(h => h.day));
    const lv = leaves || [];
    const map = {};
    (roster || []).forEach(emp => {
      const codes = [];
      for (let d = 1; d <= nDays; d++) {
        const dateISO = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dow = new Date(y, m - 1, d).getDay();
        if (holidays.has(d)) { codes.push('1'); continue; } // วันหยุดนักขัตฤกษ์ จ่ายค่าจ้างเสมือนมาปฏิบัติงาน
        if (dow === 0) { codes.push('-'); continue; } // อาทิตย์หยุดทุกตำแหน่ง
        if (dow === 6 && !worksSaturday(emp, dateISO)) { codes.push('-'); continue; } // เสาร์หยุด ยกเว้นผู้ปฏิบัติหน้าที่ยาม
        codes.push(leaveCodeForDay(lv, emp.name, dateISO) || '1'); // ไม่มีคำขอลา → ถือว่ามาปฏิบัติงาน
      }
      map[emp.name] = codes;
    });
    return map;
  }

  function workDays(codes) { return (codes || []).filter(c => WORKDAY_CODES.has(c)).length; }

  // ค่าจ้างรวมของรอบเดือน = Σ (วันทำงาน × ค่าจ้างรายวัน)
  function spendOf(cycleKey, roster, leaves, publicHolidays) {
    const att = attendanceOf(cycleKey, roster, leaves, publicHolidays);
    return (roster || []).reduce((sum, e) => sum + workDays(att[e.name]) * (e.rate || 0), 0);
  }

  window.LaborCalc = { THAI_HOLIDAYS, LEAVE_TYPE_CODE, WORKDAY_CODES, isGuard, worksSaturday, daysInCycle, holidaysOf, leaveCodeForDay, normalizeStaff, rosterFrom, attendanceOf, workDays, spendOf };
})();
