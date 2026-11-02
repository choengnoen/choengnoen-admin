/* print-standard.js — มาตรฐานการพิมพ์ระบบบริหารหมวด (ไฟล์กลาง โหลดทุกหน้า)
 * กฎ: ทุกการพิมพ์เป็น A4 ไร้ขอบเท่านั้น ไม่มีเครดิตใด ๆ แทรก (ขอบ 0 = เบราว์เซอร์ไม่พิมพ์วันที่/URL/ชื่อหน้า/เลขหน้าลงกระดาษ)
 * แนวกระดาษ: ปกติแนวตั้ง ; ฟอร์มแนวนอนใส่ class="print-a4-landscape" ที่กล่อง .print-only (หรือใช้ @page ชื่อเฉพาะที่ size:A4 landscape;margin:0)
 * ห้ามพิมพ์ผ่าน iframe เพราะ Chrome ไม่ใช้ @page ของ iframe ทำให้มีขอบและหัว/ท้ายกระดาษติดมา
 * ฟอร์มแบบข้อความ (.official-form) เว้นระยะจากขอบกระดาษด้วย padding ของตัวฟอร์มเอง และคงระยะเดิมในทุกหน้าที่ขึ้นหน้าใหม่ */
(function(){
  var css =
    '@page a4landscape{size:A4 landscape;margin:0}' +
    '@media print{' +
      '@page{size:A4 portrait;margin:0}' +
      'html,body{margin:0 !important;padding:0 !important;background:#fff !important}' +
      /* ซ่อนหน้าเว็บทั้งหมดตอนพิมพ์ฟอร์ม ให้กระดาษมีแต่ฟอร์ม ไม่มีหน้าว่างนำหน้า/ตามหลัง */
      'body:has(>.print-only.show-print)>*:not(.show-print){display:none !important}' +
      '.print-a4-landscape{page:a4landscape}' +
      '.official-form{box-sizing:border-box;max-width:none;padding:15mm 18mm;-webkit-box-decoration-break:clone;box-decoration-break:clone}' +
    '}';
  var st = document.createElement('style');
  st.id = 'print-standard-style';
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
})();
