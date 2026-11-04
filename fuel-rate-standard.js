/* ===== ตารางอัตราสิ้นเปลืองเชื้อเพลิงเครื่องจักรกลของกรมทางหลวง =====
   ที่มา: "อัตราการสิ้นเปลือง Update 30-10-68.pdf" (งานเครื่องจักร หมวด) พิมพ์จากภาพสแกน 11 หน้า
   หมายเหตุท้ายตารางของกรม: อัตราจริงขึ้นกับภาระงาน รอบเครื่อง ลักษณะการขับขี่ ฯลฯ คลาดเคลื่อนได้
   ถ้าต่างจากตารางมากผิดปกติให้พิจารณาเป็นกรณี ๆ ไป — ระบบจึงใช้เป็นคำเตือนเท่านั้น ไม่บล็อกการเบิก
   รูปแบบแถว: [ยี่ห้อ, รุ่น, เครื่องยนต์, แรงม้า, กม./ลิตร, ลิตร/ชม.]  (null = ตารางไม่ระบุ) */
(function () {
  'use strict';
  var GROUPS = [
    ['04', 'เครื่องตัดหญ้าสะพาย', [
      ['MITSUBISHI', 'TU 43 PSF (ข้ออ่อน)', '2 stroke', '2', null, 0.41],
      ['MITSUBISHI', 'TU 43 PFD (ข้อแข็ง)', '2 stroke', '2', null, 0.41],
      ['HONDA', 'GX-35 (ข้ออ่อน)', '4 stroke', '2', null, 0.41],
      ['HONDA', 'GX-35 (ข้อแข็ง)', '4 stroke', '2', null, 0.41],
      ['HONDA', 'GXV160 (แบบเข็น)', '4 stroke ปี66', '4.4', null, 0.90],
      ['ECHO', 'RM-451si', '2 stroke', '2.2', null, 0.45]]],
    ['10', 'เครื่องอัดลมขนาดใหญ่', [
      ['AIR MAN', 'PDS80S-5C5', 'KUBOTA', '23', null, 3.50],
      ['AIR MAN', 'PDS185S-6C2', 'YANMAR', '49.5', null, 5.40]]],
    ['12', 'เครื่องตัดคอนกรีต', [
      ['FLYING STAR', 'FCC 600', 'SM140E', '14', null, 2.30],
      ['OKURA', 'HCC-18', '4 stroke', '13', null, 2.13]]],
    ['20', 'รถยนต์นั่ง/รถตู้/รถโดยสาร', [
      ['TOYOTA', 'COMMUTER', '2KD FTV', '109', 10.09, null],
      ['TOYOTA', 'COMMUTER', '1KD FTV', '136', 8.09, null],
      ['TOYOTA', 'COMMUTER 2.8 AT HIGH ROOF', '1GD FTV', '163', 7.58, null],
      ['TOYOTA', 'Corolla Cross', '2ZR-FXE (เบนซิน)', '122', 15.44, null],
      ['Mercedes-Benz', 'Sprinter', '419 CDI', '190', 8.00, null],
      ['FOTON/CP FOTON', 'AUV MINI BUS/BJ6730TD3', 'ISF3.8', '165', 4.20, null],
      ['HYUNDAI', 'H1', 'A2 D4CB', '175', 10.03, null]]],
    ['21', 'รถนั่งตรวจการณ์', [
      ['ISUZU', 'TFR85HGM9C (MU7)', '4JJ1-TC', '144', 10.32, null],
      ['ISUZU', 'MU-X', '4JK1-TCX', '138', 10.77, null],
      ['ISUZU', 'MU-X', 'RZ4E-TC', '150', 10.08, null],
      ['ISUZU', 'TFR40GWAHE/Mu-X 3.0 Elegant', '4JJ3', '190', 10.00, null],
      ['TOYOTA', 'FORTUNER', '1KD-FTV (160HP)', '160', 9.12, null],
      ['TOYOTA', 'FORTUNER', '2KD-FTV (VNT)', '144', 10.32, null],
      ['TOYOTA', 'FORTUNER', '1KD-FTV (171HP)', '171', 9.12, null],
      ['TOYOTA', 'FORTUNER 2.4 V 2WD', '2GD-FTV', '150', 9.78, null],
      ['TOYOTA', 'FORTUNER 2.4G A/T 4X4', '2GD', '150', 10.00, null],
      ['GMW', 'TANK 500 PRO', '-', '346', 10.00, null],
      ['HAVAL', 'H6 PHEV Ultra', 'GW4B15 (Plug-in Hybrid)', '150', 19.00, null]]],
    ['23', 'รถบรรทุกกระบะเทท้าย', [
      ['HINO', 'FE3WGLD', 'W06E', '165', 5.56, null],
      ['HINO', 'FM1JNRD', 'J08C-TT(TICS)', '245', 3.00, null],
      ['HINO', 'FM8JN1D-SGT', 'J08E-WH', '260', 3.00, null],
      ['HINO', 'FG8JF1D-JJT', 'J08EWJH', '240', 3.50, null],
      ['HINO', 'FC9JE1A', 'J05E-UT', '210', 3.80, null],
      ['HINO', 'XZU710R-HKFTLT3', 'NO4C-VB', '150', 4.41, null],
      ['ISUZU', 'FTR11FY', '6BD1', '160', 3.81, null],
      ['ISUZU', 'FTR32H', '6HE1', '195', 3.39, null],
      ['ISUZU', 'FTR11HY', '6BD1', '160', 3.81, null],
      ['ISUZU', 'FSR102', '6BD1', '160', 3.81, null],
      ['ISUZU', 'JCR360Y', '6BD1', '160', 3.81, null],
      ['ISUZU', 'FR 13GN', '6SA1', '200', 3.39, null],
      ['ISUZU', 'NPR75H5NH', '4HK1-TCN', '150', 4.41, null],
      ['ISUZU', 'FTR 33FT', '6HH1', '195', 3.39, null],
      ['ISUZU', 'FTR33F2', '6HH1', '200', 3.39, null],
      ['ISUZU', 'FVZ34QSDFU', '6HK1-TCN', '240', 3.00, null],
      ['ISUZU', 'FTR34JXXXU', '6HK1-TCN', '240', 3.50, null],
      ['ISUZU', 'NPR 66 LXS', '4HF1', '120', 5.52, null],
      ['ISUZU', 'NPR75HXXXS', '4HK1', '150', 5.22, null],
      ['MITSUBISHI', 'FK455HRH1', '6D14-3A', '160', 4.14, null],
      ['MITSUBISHI', 'FN 527', '6D16', '170', 3.74, null],
      ['NISSAN', 'NAVARA', 'YD25DDTi', '163', 4.06, null],
      ['TOYOTA', '2.5E (VIGO)', '2KD-FTV(I/C)', '120', 5.52, null],
      ['UD TRUCK', 'CWE350', 'CWE08N43R50SS9', '350', 2.00, null]]],
    ['24', 'รถลาดยาง', [
      ['ISUZU', 'FTR33H', '6HH1', '195', null, 23.30]]],
    ['25', 'รถบรรทุกน้ำ', [
      ['HINO', 'FE3 WJKA', 'W06E', '165', 3.70, 16.20],
      ['HINO', 'FG8JJ1A-JGT', 'J08E-WJ', '240', 2.75, 21.80],
      ['HINO', 'FG8JJ1A-JJT', 'J08E-WJ', '240', 2.75, 21.80],
      ['ISUZU', 'FTR 11H', '6BD1', '160', 3.82, 15.71],
      ['ISUZU', 'FTR 32H', '6HE1', '167', 3.18, 18.89],
      ['ISUZU', 'FTR 33H', '6HH1', '195', 3.13, 19.15],
      ['ISUZU', 'FXZ23NZPE', '6SD1', '150', 4.07, 14.73],
      ['ISUZU', 'NPR75HXXXS', '4HK1-TCN', '150', 4.07, 14.73],
      ['ISUZU', 'FTR34LXXXS', '6HK1-TCN', '240', 3.06, 19.63],
      ['ISUZU', 'FTR34LXXXT', '6HK1-TCN', '230', 3.19, 18.81],
      ['MITSUBISHI', 'FK 455H', '6D14', '160', 3.82, 15.71],
      ['MITSUBISHI', 'FK 457', '6D16', '170', 3.59, 16.69],
      ['MITSUBISHI', 'FK 458', '6D17', '195', 3.13, 17.69],
      ['MITSUBISHI', 'FM65FH1RDH1', '6M60-1AT1 (Euro3)', '240', 3.06, 19.63],
      ['MITSUBISHI', 'FN62FM2RDH1', '6M60-1AT1 (EURO3)', '270', 2.32, 25.91],
      ['NISSAN', 'CPA87', 'FE 6', '180', 3.39, 17.68]]],
    ['26', 'รถบรรทุกน้ำมัน', [
      ['HINO', 'KL340', 'EC100', '130', 3.00, null],
      ['HINO', 'FE3WJKA', 'W06E', '165', 3.00, null],
      ['ISUZU', 'FTR32H', '6HE1', '167', 3.00, null],
      ['NISSAN', 'UG780', 'ND6', '140', 3.00, null]]],
    ['27', 'รถบริการอัด-ฉีด', [
      ['ISUZU', 'FTR 112', '6DB1', '160', 5.00, null],
      ['ISUZU', 'FTR 11HY', '6DB1', '160', 5.00, null],
      ['MITSUBISHI', 'FK 455', '6D14', '160', 5.00, null],
      ['NISSAN', 'NAVARA', 'YD25DDTi', '151', 9.50, null],
      ['NISSAN', 'NAVARA', 'YD25', '163', 9.00, null],
      ['TOYOTA', 'HILUX REVO 2.4', '2GD-FTV', '150', 9.50, null],
      ['FORD', 'XL+ 2.2L', 'Duratorq TDCi', '160', 9.50, null]]],
    ['28', 'อุปกรณ์ตีเส้นจราจร/ลบสีตีเส้น/รถตีเส้นจราจร', [
      ['NPT', 'NPT-150', 'Honda GX200', '5.6', null, 1.37]]],
    ['31', 'รถบดสั่นสะเทือนชนิดคนเดินตามล้อคู่', [
      ['HITACHI', 'TSR65KDS', 'Kubota E75-NB3', '6.3', null, 1.50]]],
    ['31', 'รถบดสั่นสะเทือนขนาด 2-3 ตัน', [
      ['BITELLI', 'MICHELINO', 'F2L 511', '34', null, 3.59],
      ['BOMAG', 'BW 90A', '2AB1', '24', null, 2.53],
      ['DYNAPACK', 'CC142', 'F3L 1011F', '40', null, 4.22],
      ['DYNAPACK', 'CC1300C VI', 'V2403-M-DI', '49', null, 6.00],
      ['HAMM', 'HD10', 'F2L 1011', '30', null, 3.16],
      ['HAMM', 'HD 13 VT', 'KUBOTA V2203', '47', null, 4.96],
      ['INGERSOLLRAND', 'DD23', 'F2L 511D', '30', null, 3.16],
      ['VOLVO', 'CR30', 'KUBOTA V2203-M', '44', null, 4.64]]],
    ['31', 'รถบดสั่นสะเทือนขนาด 5-10 ตัน', [
      ['BOMAG', 'BW226DH-5', 'Deutz TCD 2012L06', '202', null, 28.34],
      ['CATERPILLAR', 'CS64B', 'C4.4', '129', null, 17.59],
      ['DYNAPACK', 'CA 25', '-', '152', null, 20.73],
      ['DYNAPACK', 'CA 35 D', 'Cummins QSF3.8', '130', null, 17.73],
      ['HAMM', '2420 D', 'F6L 912', '130', null, 17.73],
      ['HAMM', '2420 D', 'F62', '121', null, 16.50],
      ['HAMM', '3520', 'Deutz TCD 2012L06 2V', '207', null, 28.34],
      ['INGERSOLLRAND', 'SD 100D', '4BTAB.9', '125', null, 17.05],
      ['SAKAI', 'SW 100', '6BD1', '118', null, 16.09],
      ['SINGTHAI', 'PV 65D-S', '6BT5.9', '152', null, 20.73],
      ['VOLVO', 'SD110', 'VOLVO D5D GA E 3', '133', null, 18.14]]],
    ['32', 'รถบดล้อเหล็ก 2 ล้อ', [
      ['ROAD KING', '455D', 'LDU', '80', null, 10.91],
      ['SAKAI', 'KM-2410-B', 'DA-120', '74', null, 10.09]]],
    ['33', 'รถบดล้อเหล็ก 3 ล้อ', [
      ['GALION', 'WARRIOR', 'UDBKM 14409', '-', null, 10.00],
      ['SAKAI', 'KD-7610', 'DA120', '100', null, 13.64]]],
    ['35', 'รถบดล้อยาง', [
      ['BOMAG', 'BW16R', '4B3.9', '100.6', null, 13.72],
      ['DYNAPACK', 'CP22', 'OM 352', '145', null, 19.78],
      ['HAMM', 'GRW10', '-', '113', null, 15.41],
      ['HAMM', 'GRW280-12H', 'DEUTZ', '134', null, 12.00],
      ['SAKAI', 'TS 7409', 'DA 120', '100', null, 13.64],
      ['SAKAI', 'TS150', '6BD1', '130', null, 17.73],
      ['SAKAI', 'TS600', '6BD1', '93', null, 12.68],
      ['SINGTHAI', 'RRT 9-10T', '6BT', '125', null, 17.05]]],
    ['36', 'เครื่องสะเทือนดิน', [
      ['SAKAI', 'RS55E', 'Robin EH09-2D', '2.7', null, 0.55],
      ['MATON', 'ALL NEW', '6.5 HP', '5.2', null, 1.26],
      ['MATON', 'SPRING MARTON', 'BRIGGS&STRATTON', '5', null, 1.21],
      ['MATON', 'SPRING ALL NEW', 'MT6.5 HP', '6.5', null, 1.26],
      ['FLYING STAR', 'FC90', 'KATO', '6.5', null, 1.26]]],
    ['37', 'เครื่องสะเทือนคอนกรีต', [
      ['HONDA', 'GP200', 'HONDA', '5', null, 1.02]]],
    ['40', 'ชุดเครื่องตัดและเจาะถนนระบบไฮโดรลิค', [
      ['ATLAS COPCO', 'Briggs&Stratton', 'Vanguard V-twin', '18', null, 2.00],
      ['ATLAS COPCO', 'LP18 Twin PE', '-', '18', null, 1.74],
      ['ATLAS COPCO', 'GP18 MULTIFLOW', 'V-TWIN VANGUARD', '18', null, 2.95],
      ['HYCON', 'HPP18VMF', 'VANGUARD 18 HP.570 CC.', '18', null, 2.95]]],
    ['41', 'รถเกลี่ย', [
      ['CATERPILLAR', '120G', '78P', '125', null, 17.05],
      ['CATERPILLAR', '140K', 'TX7', '190', null, 25.91],
      ['CHAMPION', '720', 'GM4A-71', '144', null, 19.64],
      ['CHAMPION', '710A', '-', '135', null, 18.41],
      ['KOMATSU', 'GD611A', '115725', '155', null, 21.14],
      ['MITSUBISHI', 'T3GA', '-', '135', null, 18.41],
      ['MITSUBISHI', 'MG460', '6D24-TUN', '185', null, 25.23],
      ['VOLVO', 'G930', 'D7', '195', null, 26.60]]],
    ['43', 'รถบรรทุกขยะมูลฝอย', [
      ['MITSUBISHI', 'K64TENSRUI', '4D56', '90', 6.69, null],
      ['ISUZU', 'TFR86 HSM 2A', '4JK1-TC', '115', 5.24, null]]],
    ['44', 'รถบรรทุกขนาดไม่เกิน 1 ตัน', [
      ['ISUZU', 'TFR86HSM2AG (D-MAX)', '4JK1', '115', 11.00, null],
      ['ISUZU', 'TFS85', '4JJ1', '144', 10.00, null],
      ['ISUZU', 'D-MAX Double cab 2014', '4JK1-TCX', '136', 10.50, null],
      ['ISUZU', '1.9L Ddi Blue Power', 'RZ4E-TC', '150', 10.00, null],
      ['NISSAN', 'NAVARA', 'YD25DDTi', '163', 9.21, null],
      ['NISSAN', 'NAVARA KING CAB E 6MT', 'YD25', '163', 10.00, null],
      ['NISSAN', 'NAVARA Double cab 4WD', 'YS23DDTT', '190', 8.50, null],
      ['MITSUBISHI', 'K64T', '4D56', '84', 9.70, null],
      ['TOYOTA', 'HILUX VIGO', '2KD-FTV(I/c)', '120', 11.00, null],
      ['TOYOTA', 'HILUX VIGO CHAMP', '2KD-FTV(VNT)', '144', 10.00, null],
      ['TOYOTA', 'HILUX REVO 2.4 PRERUNNER AT', '2GD-FTV', '150', 10.00, null],
      ['TOYOTA', 'HILUX REVO 2.4', '2GD-FTV', '150', 10.00, null],
      ['FORD', 'RANGER 2.0L 5MT', 'BJ2Q', '150', 10.00, null]]],
    ['46', 'รถบรรทุกขนาด 3-4.5 ตัน', [
      ['HINO', 'XZU710R', 'N04C', '150', 4.41, null],
      ['ISUZU', 'NPR71LY52E', '4HG1', '130', 5.37, null],
      ['ISUZU', 'NDR 66', '4HF1', '120', 5.73, null],
      ['ISUZU', 'NPR75H5NAH', '4HK1-TCN', '150', 4.97, null],
      ['ISUZU', 'NPR75HXXXS', '4HK1-TCN', '150', 4.97, null],
      ['MITSUBISHI', 'FE659E75RDH3', '4D34-LA', '110', 4.95, null],
      ['MITSUBISHI', 'FE 657E', '4D33-4A', '122', 4.46, null]]],
    ['47', 'รถบรรทุกขนาด 4.5-6 ตัน', [
      ['HINO', 'KR320', 'EH100', '150', 4.78, null],
      ['ISUZU', 'FTR 11 H', '6BD1', '160', 4.48, null],
      ['ISUZU', 'FTR33H2', '6HH1', '195', 3.68, null],
      ['MITSUBISHI', 'FK 455', '6D14', '160', 4.48, null]]],
    ['48', 'รถดูดกวาดทำความสะอาด', [
      ['ISUZU', 'FTR33F2Y', '6HH1', '200', 3.00, 20.00],
      ['TENNANT', 'SENTINEL HEAVY DUTY', 'caterpillar C4.4L', '99', 6.67, 9.00]]],
    ['52', 'รถขูดไสผิวถนน', [
      ['WIRTGEN', 'W50DC', 'Deutz TCD2012L042V', '123', null, 16.10],
      ['WIRTGEN', 'W100CF', 'CUMMINS QSL9', '304', null, 39.80],
      ['WIRTGEN', 'W50R', 'Deutz TCD2012L04V2', '134', null, 17.55],
      ['BOBCAT', 'S750', 'Kubota V3800-dite3 tier3', '85', null, 4.30]]],
    ['53', 'รถดูดโคลนและล้างทำความสะอาดท่อ', [
      ['HINO', 'FM1JNRD', 'J08C-TT(TICS)', '245', null, 22.30]]],
    ['54', 'เครื่องลบสีตีเส้นจราจร', [
      ['BERGIN', 'SGX270', 'GCBHT', '8.6', null, 2.11]]],
    ['55', 'เครื่องจักรต้นแบบ', [
      ['TOYOTA', 'HILUX VIGO', '2KD-FTV(I/c)', '120', null, 6.11]]],
    ['60', 'รถฟาร์มแทรคเตอร์', [
      ['BELARUS', 'MTZ80', 'D-240', '90', null, 11.78],
      ['KUBOTA', 'L5018', 'V2403-M-D1', '50', null, 6.55],
      ['YANMAR', 'EF514T', '4TNV88', '51', null, 7.20]]],
    ['61', 'รถลากพ่วง', [
      ['ISUZU', 'EXZ 71J', '10PD1', '335', 2.20, null],
      ['SCANIA', 'P 113EL', 'DS11-75', '310', 2.20, null],
      ['VOLVO', 'FM10 6x4', 'D10B 312221', '320', 2.20, null],
      ['VOLVO', 'FM12 6x4', 'D12 293317 D1 A', '380', 2.20, null],
      ['VOLVO', 'FM13 64T32440ALSI', 'D13A440', '440', 2.20, null],
      ['UD TRUCK', 'GWE11N34R460CSSI', 'GH11460-EU V', '460', 2.00, null]]],
    ['63', 'รถแทรคเตอร์ตีนตะขาบ', [
      ['CATERPILLAR', 'D6 C', '44V-8037', '120', null, 15.71],
      ['FIAT ALLIS', 'FD 9', '8065T', '108', null, 14.14],
      ['KOMATSU', 'D85A-12', 'NH220CI', '180', null, 23.57],
      ['KOMATSU', 'D53 A17', '6D125', '124', null, 16.24],
      ['KOMATSU', 'D75 A', '-', '200', null, 26.19],
      ['KOMATSU', 'D85A-18', '-', '220', null, 28.81],
      ['KOMATSU', 'D155 A2', '-', '320', null, 41.90],
      ['KOMATSU', 'D65EX-16', 'Komatsu SAA6D114E-3', '207', null, 28.67]]],
    ['64', 'รถบรรทุกเครื่องจักร', [
      ['ISUZU', 'CXZ', '6RB1', '300', 2.50, null],
      ['ISUZU', 'FXZ 23 NEP', '6SD1', '240', 2.50, null],
      ['HINO', 'FM1JNRD', 'J08C-TT(TICS)', '245', 2.50, null],
      ['HINO', 'GY2PSLA', 'P11C-UV', '380', 2.50, null],
      ['HINO', 'FL1AS1A-SHT', 'A09C', '344', 2.50, null]]],
    ['68', 'รถฟาร์มแทรคเตอร์ติดเครื่องตัดหญ้า', [
      ['BELARUS', 'MTZ 80', 'D240', '90', null, 14.73],
      ['KUBOTA', 'L 4708SP', 'Kubota V2203-M-DI', '45', null, 7.36],
      ['KUBOTA', 'K5018DT', 'V2403', '50', null, 8.18],
      ['KUBOTA', 'M6240suh', 'Kubota V2403-DI-TE2', '62', null, 6.76],
      ['VOLVO', 'L 50', 'D 45B', '90', null, 14.73]]],
    ['72', 'รถตักล้อยาง', [
      ['CASE', '6T-830', '721B', '140', null, 18.33],
      ['CATERPILLAR', '930', '3304', '100', null, 13.09],
      ['KOMATSU', 'WA320-3', 'S6D108', '163', null, 21.34],
      ['KOMATSU', 'WA180-3', '6D95L', '133', null, 17.41],
      ['KAWASAKI', 'KSS60', '6BD1', '103', null, 13.49],
      ['KAWASAKI', '60Z', '6BD1', '108', null, 14.14]]],
    ['73', 'รถยกของแบบงา', [
      ['KOMATSU', 'FD25-0-5', 'C-221', '43', null, 5.63],
      ['HYSTER', '-', 'F163', '49', null, 6.42],
      ['GROVE', '24', '-', '50', null, 6.55]]],
    ['74', 'รถบรรทุกติดเครน 5-10 ตัน', [
      ['HINO', 'FF175 KA', 'EH 700', '168', 3.78, 15.89],
      ['ISUZU', 'NPR75HXXXS', '4HK1', '150', 4.23, 14.18],
      ['ISUZU', 'FTR33H2', '6HH1', '195', 3.25, 18.46],
      ['ISUZU', 'FTR 11 HY', '6BD1', '160', 3.97, 15.11],
      ['ISUZU', 'FTR 34LZL 2010', '6HK1-TCN', '240', 2.64, 22.70],
      ['ISUZU', 'FTR34LXXXT', '6HK1-TCN', '230', 2.76, 21.75],
      ['ISUZU', 'FTR34QXXXU', '6HK1-TCN', '240', 2.64, 22.70],
      ['MITSUBISHI', 'FK455MRDH1', '6D14-3A', '160', 3.97, 15.13],
      ['MITSUBISHI', 'FK457HSRGDH3 (EURO 2)', '6D16-NA', '220', 2.88, 20.80],
      ['NISSAN', 'CPA 87', 'FE 6B', '180', 3.53, 17.02],
      ['NISSAN', 'PKB214G', 'FE 6TA-21', '216', 2.94, 20.43]]],
    ['74', 'รถบรรทุกติดเครน 10-15 ตัน', [
      ['HINO', 'FG8JM1A-JGT', 'J08E-WJ', '240', 2.64, 22.70],
      ['ISUZU', 'FVM33M', '6HH1', '195', 3.25, 18.44],
      ['ISUZU', 'FXZ 23N', '6SD1', '150', 4.23, 14.18]]],
    ['74', 'รถบรรทุกติดเครน 5-15 ตัน และกระบะเทท้าย', [
      ['ISUZU', 'FTR33H2', '6HH1', '195', 3.25, 18.44],
      ['MITSUBISHI', 'FK455MRDH1', '6D14-3A', '160', 3.97, 15.13]]],
    ['77', 'รถตักหน้า-ขุดหลัง', [
      ['HIDROMEK', 'HMK 102S', 'Perkin 1104c-44T-40T', '100', null, 10.28],
      ['JCB', '4CX4WS', '1004-0THR4', '96', null, 10.28],
      ['JCB', '4CX 4XWS', '004-40T', '100', null, 10.28],
      ['JCB', '4CX ECO', 'SB320', '100', null, 10.28],
      ['JCB', '4CX ECO', 'JCB STAGE V', '100', null, 10.28],
      ['JCB', '4CX', 'Diesel max stage II/IIIA', '100', null, 10.28]]],
    ['78', 'รถกระเช้าไฟฟ้า', [
      ['ISUZU', 'FRR30LSXXY', '4HK1-TCS', '210', 3.00, 20.00],
      ['HINO', 'FF177', 'EH 700', '168', 3.04, 19.74],
      ['HINO', 'XZU720R', 'N04CVBH', '150', 3.41, 17.61],
      ['GFNTILI', '17/12TJ FTR11NT', '6BD1', '160', 3.00, 20.00],
      ['TOYOTA', 'BU12', 'BU12', '85', 5.00, 12.00],
      ['NISSAN', 'CLG 87F', 'FE6B', '180', 2.84, 21.13]]],
    ['80', 'รถยก/รถเครน', [
      ['CONQUIP', 'CC86', '4.270D', '62', null, 8.12],
      ['GARWOOD', '100BT25T', '3-71', '74', null, 9.69],
      ['ISUZU', 'TXD50HC', 'DA-120', '125', null, 16.37],
      ['ISUZU', 'FSR11D', '6BD1', '160', null, 20.95],
      ['SHUTTLE LIFT', '-', '4B3.9', '71', null, 9.30],
      ['SUMITTUMO', 'HCTTS', 'PE-6', '220', null, 28.81],
      ['T.C.M', 'TL250E', 'PE6', '225', null, 29.46],
      ['TADANO', 'TL-250E', 'PE6', '225', null, 29.46],
      ['TADANO', 'GT-350E-2', 'Cummins ISLE+325', '325', null, 35.46],
      ['TADANO', 'GT-350E-3-00801', 'Mercedes-Benz OM 926LA', '326', null, 30.09],
      ['XCMG', 'QY20B', '6C250-2', '250', null, 32.73]]],
    ['82', 'รถขุดดิน', [
      ['CATERPILLAR', 'M317D2', 'C4E', '147', null, 16.57],
      ['CATERPILLAR', '320 GC', 'C4.4 ACERT', '145', null, 15.82],
      ['CATERPILLAR', '323 GC', 'C7.1 TA', '158', null, 17.24],
      ['CATERPILLAR', '313 GC', 'C3.6', '100', null, 10.91],
      ['CATERPILLAR', 'M315', 'C3.6', '121', null, 14.52],
      ['HALLA', 'HE 280E', '-', '182', null, 19.86],
      ['HITACHI', 'EX220-5', 'H07C-TD', '150', null, 16.28],
      ['HITACHI', 'ZX200LC-3', 'AH-4HK1', '166', null, 18.02],
      ['HITACHI', 'ZX180LC-3', 'ISUZU AL-4JJ1X', '121', null, 17.60],
      ['HITACHI', 'ZX200-5G', 'ISUZU CC-6BG1T', '170', null, 18.56],
      ['HITACHI', 'ZX180LC-5G', '4BG1', '121', null, 13.64],
      ['HITACHI', 'ZX170W-3', '4HK1', '143', null, 15.25],
      ['HYUNDAI', 'R60WVS PRO', 'Yanmar 4TNV98-E', '57', null, 6.49],
      ['HYUNDAI', '250 LC-3 (ROBEX)', '6B59-C', '161', null, 17.57],
      ['HYUNDAI', 'R130W-3', 'B39-C', '102', null, 11.13],
      ['HYUNDAI', 'R140W-9', 'HE6.7', '146', null, 16.46],
      ['HYUNDAI', 'R60W-9S', 'Yanmar 4tnv94l-phyby', '57', null, 6.49],
      ['JCB', 'JS 130W', '4BD1PTA-14', '86', null, 9.38],
      ['JCB', '8035 ZTS', 'HL403C-17, GL403D-17', '31.6', null, 5.00],
      ['JCB', 'JS145W (TCAE-97)', 'JCB 444 Turbo', '130', null, 16.08],
      ['KOMATSU', 'PC 220-6', '6A6D120E-1', '158', null, 17.24],
      ['KOMATSU', 'PC 200-6', '6D102', '132', null, 14.40],
      ['KOMATSU', 'PC130-10M0', 'SAA4D95LE-5', '97', null, 10.62],
      ['VOLVO', 'EC210DLR', 'D5E TIRE3', '165', null, 16.50],
      ['VOLVO', 'EC55D', 'D2.6A', '50', null, 6.00],
      ['SAMSUNG', 'SE210', '21161527', '145', null, 15.74]]],
    ['85', 'รถเครนยกของในโรงงาน', [
      ['BENCINI', '-', '-', '38', null, 5.00]]],
    ['94', 'เครื่องผสมคอนกรีต', [
      ['FLYING STAR', 'S.T.E.7/5', 'R.175N', '-', null, 1.63],
      ['FLYING STAR', 'STM 7/5', 'SF-65E', '6.5', null, 1.00],
      ['BERGIN', 'CM 400 CE', 'YANMA JG-110DIE', '11', null, 1.20]]],
    ['98', 'เครื่องกำเนิดไฟฟ้า', [
      ['CATERPILLAR', 'D353E', '-', '475', null, 51.83],
      ['SUPERFORD', '200', 'TF115-LM', '11.5', null, 1.25],
      ['BEAM', 'BLF120MB', '2100 DI', '27', null, 2.95],
      ['DAICHI', 'DA 5050', '-', '13.5', null, 1.65]]]
  ];

  var rows = [];
  GROUPS.forEach(function (g) {
    g[2].forEach(function (r) {
      rows.push({
        key: [g[0], g[1], r[0], r[1], r[2], r[3]].join('|'),
        code: g[0], group: g[1], brand: r[0], model: r[1], engine: r[2], hp: r[3], kmpl: r[4], lph: r[5]
      });
    });
  });
  var byKey = {};
  rows.forEach(function (r) { byKey[r.key] = r; });

  window.FUEL_RATE_STD = {
    updated: '30-10-68',
    rows: rows,
    find: function (key) { return byKey[key] || null; },
    /* เลือกอัตราตามหน่วยที่ระบุ — แถวที่มีหน่วยเดียว คืนหน่วยนั้นเสมอ */
    rateFor: function (row, unit) {
      if (!row) return null;
      var byHour = /ชม/.test(unit || '');
      if (row.kmpl != null && row.lph != null) return byHour ? { rate: row.lph, unit: 'ลิตร/ชม.' } : { rate: row.kmpl, unit: 'กม./ลิตร' };
      return row.kmpl != null ? { rate: row.kmpl, unit: 'กม./ลิตร' } : { rate: row.lph, unit: 'ลิตร/ชม.' };
    }
  };
})();
