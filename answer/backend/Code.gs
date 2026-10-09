/**
 * lawyerthaiai.com — หลังบ้านของ AI ช่วยพิมพ์คำให้การจำเลย และ AI ร่างฟ้องคดีกู้ยืมเงิน (ใช้ร่วมกัน)
 * Google Apps Script + Google Sheets + Claude API
 *
 * ติดตั้ง: ดูไฟล์ SETUP.md
 * Script Properties ที่ต้องตั้ง:
 *   CLAUDE_API_KEY   = sk-ant-...            (จำเป็น)
 *   ADMIN_PASSWORD   = รหัสผ่านหน้าหลังบ้าน     (จำเป็น)
 * Script Properties ที่ไม่ตั้งก็ได้ (มีค่าเริ่มต้น):
 *   MODEL            = claude-sonnet-5-5
 *   SERVICE_OPEN     = true
 *   LIMIT_USER_DAY   = 3      จำนวนคดีต่อผู้ใช้ต่อวัน
 *   LIMIT_TOTAL_DAY  = 50     จำนวนคดีรวมต่อวัน (คุมค่าใช้จ่ายช่วงทดลอง)
 *   PRICE_IN_MTOK    = 3      ราคา USD ต่อ 1 ล้าน token ขาเข้า (ใช้ประมาณค่าใช้จ่าย)
 *   PRICE_OUT_MTOK   = 15     ราคา USD ต่อ 1 ล้าน token ขาออก
 *   USD_THB          = 36
 *   C_EFFORT         = medium  ระดับการคิดของ AI ตอนร่างฟ้อง (low / medium / high) ยิ่งสูงยิ่งช้าและแพง
 *
 * ความเป็นส่วนตัว: ระบบนี้ "ไม่เก็บ" ไฟล์คำฟ้อง ชื่อคู่ความ หรือข้อความคำให้การ
 * เก็บเฉพาะข้อมูลผู้ใช้งาน (ที่ผู้ใช้กรอกเอง) และข้อมูลสถิติของงาน (ศาล ประเภทคดี จำนวนหน้า token เวลา)
 */

const SHEET_USERS = 'users';
const SHEET_JOBS = 'jobs';
const USER_HEAD = ['userId', 'createdAt', 'name', 'phone', 'line', 'email', 'role', 'consentAt', 'jobs', 'lastUsedAt', 'blocked'];
const JOB_HEAD = ['time', 'jobId', 'userId', 'userName', 'stage', 'files', 'court', 'caseType', 'matter', 'tokensIn', 'tokensOut', 'costTHB', 'ms', 'status', 'error'];

/* ---------- run once from the editor ---------- */
function setup() {
  const ss = SpreadsheetApp.getActive();
  [[SHEET_USERS, USER_HEAD], [SHEET_JOBS, JOB_HEAD]].forEach(([name, head]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) { sh.appendRow(head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, head.length).setFontWeight('bold'); }
  });
  const p = PropertiesService.getScriptProperties();
  const defaults = { MODEL: 'claude-sonnet-5-5', SERVICE_OPEN: 'true', LIMIT_USER_DAY: '3', LIMIT_TOTAL_DAY: '50', PRICE_IN_MTOK: '3', PRICE_OUT_MTOK: '15', USD_THB: '36' };
  Object.keys(defaults).forEach(k => { if (!p.getProperty(k)) p.setProperty(k, defaults[k]); });
  Logger.log('ตั้งค่าเรียบร้อย ตรวจว่าได้ใส่ CLAUDE_API_KEY และ ADMIN_PASSWORD ใน Script Properties แล้ว');
}

/* ---------- web entry ---------- */
function doGet() {
  return json({ ok: true, service: 'lawyerthaiai', open: prop('SERVICE_OPEN', 'true') === 'true' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'คำขอไม่ถูกต้อง' }); }
  try {
    switch (req.action) {
      case 'status': return json(statusFor(req.userId));
      case 'register': return json(register(req));
      case 'extract': return json(extract(req));
      case 'draft': return json(draft(req));
      case 'cStart': return json(cStart(req));
      case 'cExtract': return json(cExtract(req));
      case 'cDraft': return json(cDraft(req));
      case 'admin': return json(admin(req));
      default: return json({ ok: false, error: 'ไม่รู้จักคำสั่ง' });
    }
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'ระบบขัดข้อง: ' + (err && err.message ? err.message : err) });
  }
}

/* ---------- users ---------- */
function register(req) {
  const name = clean(req.name, 120), phone = clean(req.phone, 30);
  if (!req.userId || !name || !phone) return { ok: false, error: 'กรุณากรอกชื่อและเบอร์โทร' };
  if (!req.consent) return { ok: false, error: 'กรุณายอมรับเงื่อนไขก่อนใช้งาน' };
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = sheet(SHEET_USERS), row = findRow(sh, req.userId), now = new Date();
    const vals = [req.userId, now, name, phone, clean(req.line, 60), clean(req.email, 120), clean(req.role, 40), now, 0, '', false];
    if (row) {
      const cur = sh.getRange(row, 1, 1, USER_HEAD.length).getValues()[0];
      vals[1] = cur[1]; vals[8] = cur[8]; vals[9] = cur[9]; vals[10] = cur[10];
      sh.getRange(row, 1, 1, USER_HEAD.length).setValues([vals]);
    } else sh.appendRow(vals);
  } finally { lock.releaseLock(); }
  return Object.assign({ ok: true }, statusFor(req.userId));
}

function getUser(userId) {
  const sh = sheet(SHEET_USERS), row = findRow(sh, userId);
  if (!row) return null;
  const v = sh.getRange(row, 1, 1, USER_HEAD.length).getValues()[0];
  const o = {}; USER_HEAD.forEach((h, i) => o[h] = v[i]); o._row = row; return o;
}

function statusFor(userId) {
  const open = prop('SERVICE_OPEN', 'true') === 'true';
  const limitUser = +prop('LIMIT_USER_DAY', '3'), limitTotal = +prop('LIMIT_TOTAL_DAY', '50');
  const counts = todayCounts(userId);
  const u = userId ? getUser(userId) : null;
  return {
    ok: true, open, registered: !!u, blocked: !!(u && u.blocked === true),
    usedToday: counts.user, limitUser, leftToday: Math.max(0, limitUser - counts.user),
    totalLeftToday: Math.max(0, limitTotal - counts.total)
  };
}

function todayCounts(userId) {
  const sh = sheet(SHEET_JOBS), n = sh.getLastRow() - 1;
  if (n <= 0) return { user: 0, total: 0 };
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const take = Math.min(n, 3000); // recent rows are enough for a daily count
  const rows = sh.getRange(sh.getLastRow() - take + 1, 1, take, 14).getValues();
  let user = 0, total = 0;
  rows.forEach(r => { if ((r[4] === 'extract' || r[4] === 'c_extract' || r[4] === 'c_start') && r[13] === 'ok' && new Date(r[0]) >= start) { total++; if (r[2] === userId) user++; } });
  return { user, total };
}

function checkAllowed(userId) {
  const st = statusFor(userId);
  if (!st.open) return 'ระบบปิดให้บริการชั่วคราว';
  if (!st.registered) return 'กรุณาลงทะเบียนก่อนใช้งาน';
  if (st.blocked) return 'บัญชีนี้ถูกระงับการใช้งาน';
  if (st.leftToday <= 0) return 'วันนี้ใช้ครบ ' + st.limitUser + ' คดีแล้ว กรุณาใช้งานใหม่พรุ่งนี้';
  if (st.totalLeftToday <= 0) return 'วันนี้มีผู้ใช้งานครบจำนวนแล้ว กรุณาใช้งานใหม่พรุ่งนี้';
  return '';
}

/* ---------- step 1: read the complaint ---------- */
const EXTRACT_PROMPT = `คุณเป็นผู้ช่วยทนายความไทย อ่านเอกสารที่แนบมา (ภาพถ่ายหรือ PDF ของคำฟ้อง หมายเรียก หรือเอกสารท้ายฟ้อง) แล้วสรุปข้อมูลตามรูปแบบ JSON ด้านล่าง
กติกา:
- ใช้เฉพาะข้อมูลที่ปรากฏในเอกสารจริง ห้ามเดา ถ้าไม่พบให้ใส่ "" หรือ []
- ถ้าเอกสารไม่ใช่คำฟ้องหรือเอกสารคดี หรืออ่านไม่ออก ให้ ok=false และบอกเหตุผลใน reason
- ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ไม่มี markdown
{
 "ok": true,
 "reason": "",
 "court": "ชื่อศาล เช่น ศาลจังหวัดสมุทรปราการ",
 "blackCaseNo": "คดีหมายเลขดำ เช่น ผบ.1234/2569",
 "caseKind": "แพ่ง หรือ อาญา หรือ ผู้บริโภค หรือ แรงงาน หรืออื่น ๆ",
 "matter": "ข้อหา/ฐานความผิด/เรื่อง เช่น ผิดสัญญากู้ยืมเงิน",
 "amount": "ทุนทรัพย์หรือจำนวนเงินที่ฟ้อง เป็นข้อความ",
 "plaintiffs": ["ชื่อโจทก์"],
 "defendants": [{"name":"ชื่อจำเลยพร้อมคำนำหน้า","order":"จำเลยที่ ๑","age":"","nationality":"","occupation":"","houseNo":"","moo":"","soi":"","road":"","subdistrict":"","district":"","province":"","postcode":"","phone":""}],
 "allegations": ["สรุปข้อเท็จจริงตามคำฟ้องเป็นข้อ ๆ ข้อละ 1-2 ประโยค ระบุวันที่ จำนวนเงิน สัญญา ตามที่ปรากฏ"],
 "relief": ["คำขอท้ายฟ้องเป็นข้อ ๆ"],
 "attachments": ["เอกสารท้ายฟ้องที่อ้าง"],
 "hearingDate": "วันนัดพิจารณา/วันนัดยื่นคำให้การ ถ้ามี"
}`;

function extract(req) {
  const t0 = Date.now(), jobId = Utilities.getUuid().slice(0, 8);
  const stop = checkAllowed(req.userId);
  if (stop) return { ok: false, error: stop };
  const files = (req.files || []).slice(0, 12);
  if (!files.length) return { ok: false, error: 'ยังไม่มีไฟล์' };
  const content = files.map(f => f.mime === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } }
    : { type: 'image', source: { type: 'base64', media_type: f.mime, data: f.data } });
  content.push({ type: 'text', text: EXTRACT_PROMPT });
  let res, data;
  try {
    res = callClaude([{ role: 'user', content }], 3000, 'ตอบเป็น JSON ที่ถูกต้องเท่านั้น');
    data = parseJson(res.text);
  } catch (err) {
    logJob(jobId, req.userId, 'extract', files.length, {}, res, Date.now() - t0, 'error', String(err.message || err));
    return { ok: false, error: 'AI อ่านเอกสารไม่สำเร็จ ลองใหม่อีกครั้ง หรือถ่ายภาพให้ชัดขึ้น' };
  }
  const ok = data && data.ok !== false;
  logJob(jobId, req.userId, 'extract', files.length, data || {}, res, Date.now() - t0, ok ? 'ok' : 'unreadable', ok ? '' : (data && data.reason) || '');
  if (!ok) return { ok: false, error: (data && data.reason) || 'อ่านเอกสารไม่ได้' };
  bumpUser(req.userId);
  return { ok: true, jobId, data };
}

/* ---------- step 2: draft the answer ---------- */
const DRAFT_SYSTEM = `คุณเป็นผู้ช่วยทนายความไทยที่ช่วยพิมพ์ "ตัวอย่าง" คำให้การจำเลย เพื่อให้ผู้ใช้นำไปแก้ไขต่อและปรึกษาทนายความก่อนยื่นศาล
หลักการเขียน:
- ใช้ภาษากฎหมายไทยที่เป็นทางการ แบบคำให้การที่ยื่นต่อศาลยุติธรรม
- เขียนเป็นข้อ ๆ ข้อแรกไม่ต้องขึ้นต้นด้วย "ข้อ ๑." (แบบพิมพ์มีพิมพ์ไว้แล้ว) ข้อต่อไปขึ้นต้นด้วย "ข้อ ๒." "ข้อ ๓." ตามลำดับ แต่ละข้อขึ้นบรรทัดใหม่
- ข้อแรกโดยทั่วไปเป็นการรับหรือปฏิเสธข้อเท็จจริงตามคำฟ้องโดยรวม แล้วจึงตามด้วยข้อต่อสู้แต่ละประเด็น
- ใช้ข้อต่อสู้เฉพาะที่มีฐานจากข้อเท็จจริงของผู้ใช้หรือจากคำฟ้อง ห้ามแต่งข้อเท็จจริงขึ้นเอง
- ข้อมูลที่ยังไม่ทราบ ให้เว้นเป็น [ระบุ...] ให้ผู้ใช้เติม เช่น [ระบุวันที่ชำระ] [ระบุจำนวนเงิน]
- อ้างตัวบทกฎหมายเฉพาะที่มั่นใจว่าถูกต้อง ถ้าไม่แน่ใจให้เขียนหลักการโดยไม่ระบุเลขมาตรา
- คดีอาญา: คำให้การให้สั้น ระบุว่าจำเลยให้การปฏิเสธ (หรือรับสารภาพ ตามที่ผู้ใช้เลือก) และจะนำสืบในชั้นพิจารณา ไม่ต้องบรรยายยาว
- ข้อสุดท้ายเป็นคำขอท้ายคำให้การ เช่น "ด้วยเหตุดังกล่าวข้างต้น จำเลยจึงขอศาลได้โปรดพิพากษายกฟ้องโจทก์ และให้โจทก์เป็นผู้ชำระค่าฤชาธรรมเนียมและค่าทนายความแทนจำเลย" ปรับให้เหมาะกับคดี
- ใช้ตัวเลขไทยทั้งหมด
ตอบเป็น JSON อย่างเดียว ไม่มี markdown:
{"body":"เนื้อหาคำให้การ แต่ละข้อคั่นด้วยการขึ้นบรรทัดใหม่ \\n","checklist":["สิ่งที่ผู้ใช้ต้องตรวจหรือเติมก่อนยื่น"],"issues":["ประเด็นข้อต่อสู้ที่ใช้ สั้น ๆ"]}`;

function draft(req) {
  const t0 = Date.now();
  const st = statusFor(req.userId);
  if (!st.open) return { ok: false, error: 'ระบบปิดให้บริการชั่วคราว' };
  if (!st.registered || st.blocked) return { ok: false, error: 'ไม่สามารถใช้งานได้' };
  if (!req.jobId || draftCount(req.jobId) >= 3) return { ok: false, error: 'คดีนี้ให้ AI พิมพ์ใหม่ครบ 3 ครั้งแล้ว กรุณาแก้ไขข้อความเอง หรือเริ่มคดีใหม่' };
  const x = req.extracted || {};
  const brief = {
    ศาล: x.court, คดีหมายเลขดำ: x.blackCaseNo, ประเภทคดี: x.caseKind, เรื่อง: x.matter, ทุนทรัพย์: x.amount,
    โจทก์: x.plaintiffs, จำเลยผู้ให้การ: req.defendantName, ข้อเท็จจริงตามคำฟ้อง: x.allegations, คำขอท้ายฟ้อง: x.relief, เอกสารท้ายฟ้อง: x.attachments
  };
  const user = [
    'ข้อมูลคดีจากคำฟ้อง:', JSON.stringify(brief, null, 1),
    '', 'แนวทางที่ผู้ใช้เลือก: ' + ((req.options || []).join(', ') || 'ไม่ได้เลือก'),
    '', 'ข้อเท็จจริงฝั่งจำเลยตามที่ผู้ใช้เล่า:', clean(req.facts, 6000) || '(ผู้ใช้ไม่ได้ให้ข้อมูลเพิ่ม ให้ร่างแบบทั่วไปและเว้น [ระบุ...] ไว้)',
    '', 'ช่วยพิมพ์ตัวอย่างคำให้การจำเลยตามรูปแบบที่กำหนด'
  ].join('\n');
  let res, data;
  try {
    res = callClaude([{ role: 'user', content: user }], 6000, DRAFT_SYSTEM);
    data = parseJson(res.text);
    if (!data || !data.body) throw new Error('no body');
  } catch (err) {
    logJob(req.jobId, req.userId, 'draft', 0, x, res, Date.now() - t0, 'error', String(err.message || err));
    return { ok: false, error: 'AI ร่างคำให้การไม่สำเร็จ ลองกดร่างใหม่อีกครั้ง' };
  }
  logJob(req.jobId, req.userId, 'draft', 0, x, res, Date.now() - t0, 'ok', '');
  return { ok: true, body: data.body, checklist: data.checklist || [], issues: data.issues || [] };
}

function draftCount(jobId) {
  const sh = sheet(SHEET_JOBS), n = sh.getLastRow() - 1; if (n <= 0) return 0;
  const take = Math.min(n, 2000);
  return sh.getRange(sh.getLastRow() - take + 1, 2, take, 4).getValues().filter(r => r[0] === jobId && (r[3] === 'draft' || r[3] === 'c_draft')).length;
}

/* ---------- Claude ---------- */
function callClaude(messages, maxTokens, system, effort) {
  const key = prop('CLAUDE_API_KEY', '');
  if (!key) throw new Error('ยังไม่ได้ตั้ง CLAUDE_API_KEY');
  const r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(Object.assign({ model: prop('MODEL', 'claude-sonnet-5-5'), max_tokens: maxTokens, system, messages },
      effort ? { output_config: { effort } } : {}))
  });
  const code = r.getResponseCode(), body = JSON.parse(r.getContentText() || '{}');
  if (code !== 200) throw new Error('Claude ' + code + ': ' + (body.error && body.error.message || ''));
  const text = (body.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  return { text, usage: body.usage || {} };
}

function parseJson(t) {
  if (!t) return null;
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  return JSON.parse(t.slice(a, b + 1));
}

/* ---------- logging (no party names, no document text) ---------- */
function logJob(jobId, userId, stage, files, x, res, ms, status, error) {
  const u = getUser(userId) || {};
  const inT = res && res.usage ? (res.usage.input_tokens || 0) : 0, outT = res && res.usage ? (res.usage.output_tokens || 0) : 0;
  const cost = (inT * +prop('PRICE_IN_MTOK', '3') + outT * +prop('PRICE_OUT_MTOK', '15')) / 1e6 * +prop('USD_THB', '36');
  sheet(SHEET_JOBS).appendRow([new Date(), jobId || '', userId || '', u.name || '', stage, files, clean(x.court, 80), clean(x.caseKind, 30), clean(x.matter, 80), inT, outT, Math.round(cost * 100) / 100, ms, status, clean(error, 200)]);
}

function bumpUser(userId) {
  const u = getUser(userId); if (!u) return;
  sheet(SHEET_USERS).getRange(u._row, 9, 1, 2).setValues([[(+u.jobs || 0) + 1, new Date()]]);
}

/* ---------- admin ---------- */
function admin(req) {
  const pw = prop('ADMIN_PASSWORD', '');
  if (!pw || req.password !== pw) { Utilities.sleep(1200); return { ok: false, error: 'รหัสผ่านไม่ถูกต้อง' }; }
  const p = PropertiesService.getScriptProperties();
  if (req.op === 'settings') {
    const s = req.settings || {};
    if ('SERVICE_OPEN' in s) p.setProperty('SERVICE_OPEN', s.SERVICE_OPEN ? 'true' : 'false');
    if (s.LIMIT_USER_DAY > 0) p.setProperty('LIMIT_USER_DAY', String(Math.floor(s.LIMIT_USER_DAY)));
    if (s.LIMIT_TOTAL_DAY > 0) p.setProperty('LIMIT_TOTAL_DAY', String(Math.floor(s.LIMIT_TOTAL_DAY)));
  }
  if (req.op === 'block' && req.userId) {
    const u = getUser(req.userId);
    if (u) sheet(SHEET_USERS).getRange(u._row, 11).setValue(!!req.blocked);
  }
  const users = rows(SHEET_USERS, USER_HEAD), jobs = rows(SHEET_JOBS, JOB_HEAD);
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const month0 = new Date(day0.getFullYear(), day0.getMonth(), 1);
  const ext = jobs.filter(j => (j.stage === 'extract' || j.stage === 'c_extract' || j.stage === 'c_start') && j.status === 'ok');
  const sum = (a, k) => Math.round(a.reduce((s, j) => s + (+j[k] || 0), 0) * 100) / 100;
  return {
    ok: true,
    settings: { SERVICE_OPEN: prop('SERVICE_OPEN', 'true') === 'true', LIMIT_USER_DAY: +prop('LIMIT_USER_DAY', '3'), LIMIT_TOTAL_DAY: +prop('LIMIT_TOTAL_DAY', '50'), MODEL: prop('MODEL', '') },
    stats: {
      users: users.length,
      usersToday: users.filter(u => new Date(u.createdAt) >= day0).length,
      cases: ext.length,
      casesToday: ext.filter(j => new Date(j.time) >= day0).length,
      drafts: jobs.filter(j => (j.stage === 'draft' || j.stage === 'c_draft') && j.status === 'ok').length,
      errors: jobs.filter(j => j.status === 'error').length,
      costMonth: sum(jobs.filter(j => new Date(j.time) >= month0), 'costTHB'),
      costAll: sum(jobs, 'costTHB')
    },
    users: users.slice(-300).reverse(),
    jobs: jobs.slice(-300).reverse()
  };
}

/* ---------- helpers ---------- */
function sheet(name) { const sh = SpreadsheetApp.getActive().getSheetByName(name); if (!sh) throw new Error('ยังไม่ได้รัน setup()'); return sh; }
function findRow(sh, id) {
  const n = sh.getLastRow() - 1; if (n <= 0 || !id) return 0;
  const ids = sh.getRange(2, 1, n, 1).getValues();
  for (let i = 0; i < n; i++) if (ids[i][0] === id) return i + 2;
  return 0;
}
function rows(name, head) {
  const sh = sheet(name), n = sh.getLastRow() - 1; if (n <= 0) return [];
  return sh.getRange(2, 1, n, head.length).getValues().map(r => { const o = {}; head.forEach((h, i) => o[h] = r[i] instanceof Date ? r[i].toISOString() : r[i]); return o; });
}
function prop(k, d) { const v = PropertiesService.getScriptProperties().getProperty(k); return v == null || v === '' ? d : v; }
function clean(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 200); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* =====================================================================
 * AI ร่างคำฟ้องคดีแพ่ง (/complaint/)
 * ขั้น ๑ cExtract: อ่านสัญญาและเอกสาร (หรือ cStart: ผู้ใช้กรอกเอง ไม่มีไฟล์)  ขั้น ๒ cDraft: ร่างคำฟ้อง คำขอท้ายฟ้อง คำร้องขอส่งหมาย
 * ระบบไม่เก็บไฟล์ ชื่อคู่ความ หรือข้อความที่ร่าง (บันทึกเฉพาะสถิติงาน)
 * ===================================================================== */
const C_EXTRACT_PROMPT = `คุณเป็นผู้ช่วยทนายความไทย อ่านเอกสารที่แนบมาทุกไฟล์ (สัญญากู้ยืมเงิน หนังสือทวงถาม ใบตอบรับ ฯลฯ) ไฟล์เรียงลำดับ ๑, ๒, ๓ … ตามที่แนบ
กติกา:
- ใช้เฉพาะข้อมูลที่ปรากฏในเอกสารจริง ห้ามเดา ไม่พบให้ใส่ "" หรือ [] หรือ 0
- ถ้าไม่มีเอกสารที่เกี่ยวกับการกู้ยืมเงินเลย หรืออ่านไม่ออก ให้ ok=false และบอกเหตุผลใน reason
- ตอบเป็น JSON อย่างเดียว ไม่มี markdown
{
 "ok": true, "reason": "",
 "documents": [{"file": 1, "title": "ชื่อเอกสาร เช่น สัญญากู้ยืมเงิน / หนังสือบอกกล่าวทวงถาม / ใบตอบรับไปรษณีย์", "date": "วันที่ของเอกสารตามที่ปรากฏ"}],
 "persons": [{"role": "ผู้ให้กู้ หรือ ผู้กู้ หรือ ผู้ค้ำประกัน หรือ พยาน", "title": "นาย/นาง/นางสาว", "name": "", "surname": "", "age": "", "idCard": "เลข ๑๓ หลัก", "nationality": "", "occupation": "", "houseNo": "", "moo": "", "road": "", "soi": "", "subdistrict": "", "district": "", "province": "", "postcode": "", "phone": ""}],
 "loan": {"principal": 0, "interestRate": 0, "contractDate": "YYYY-MM-DD ปี ค.ศ.", "dueDate": "YYYY-MM-DD ปี ค.ศ. หรือ \\"\\"", "place": "สถานที่ทำสัญญา"},
 "demand": {"letterDate": "YYYY-MM-DD หรือ \\"\\"", "receivedDate": "YYYY-MM-DD หรือ \\"\\""},
 "clauses": ["ข้อสัญญาที่สำคัญคัดตามตัวอักษร ข้อละรายการ พร้อมเลขข้อในสัญญา"],
 "payments": "การชำระหนี้ที่ปรากฏในเอกสาร ถ้ามี"
}`;

function cExtract(req) {
  const t0 = Date.now(), jobId = 'C' + Utilities.getUuid().slice(0, 7);
  const stop = checkAllowed(req.userId);
  if (stop) return { ok: false, error: stop };
  const files = (req.files || []).slice(0, 12);
  if (!files.length) return { ok: false, error: 'ยังไม่มีไฟล์' };
  const content = [];
  files.forEach((f, i) => {
    content.push({ type: 'text', text: 'ไฟล์ที่ ' + (i + 1) });
    content.push(f.mime === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } }
      : { type: 'image', source: { type: 'base64', media_type: f.mime, data: f.data } });
  });
  content.push({ type: 'text', text: C_EXTRACT_PROMPT });
  const meta = { court: '', caseKind: 'แพ่ง', matter: 'ฟ้องผิดสัญญากู้ยืมเงิน' };
  let res, data;
  try {
    res = callClaude([{ role: 'user', content }], 6000, 'ตอบเป็น JSON ที่ถูกต้องเท่านั้น', 'low');
    data = parseJson(res.text);
  } catch (err) {
    logJob(jobId, req.userId, 'c_extract', files.length, meta, res, Date.now() - t0, 'error', String(err.message || err));
    return { ok: false, error: 'AI อ่านเอกสารไม่สำเร็จ ลองใหม่อีกครั้ง หรือถ่ายภาพให้ชัดขึ้น' };
  }
  const ok = data && data.ok !== false;
  logJob(jobId, req.userId, 'c_extract', files.length, meta, res, Date.now() - t0, ok ? 'ok' : 'unreadable', ok ? '' : (data && data.reason) || '');
  if (!ok) return { ok: false, error: (data && data.reason) || 'อ่านเอกสารไม่ได้' };
  bumpUser(req.userId);
  return { ok: true, jobId, data };
}

/* ผู้ใช้กรอกข้อมูลเอง: ไม่เรียก AI แค่ตรวจสิทธิ์ นับโควตา และออกเลขงาน */
function cStart(req) {
  const stop = checkAllowed(req.userId);
  if (stop) return { ok: false, error: stop };
  const jobId = 'C' + Utilities.getUuid().slice(0, 7);
  logJob(jobId, req.userId, 'c_start', 0, { court: '', caseKind: 'แพ่ง', matter: clean(req.charge, 80) }, null, 0, 'ok', '');
  bumpUser(req.userId);
  return { ok: true, jobId };
}

const C_DRAFT_SYSTEM = `คุณเป็นทนายความไทยผู้เชี่ยวชาญคดีแพ่ง ร่างคำฟ้องตามข้อหาและข้อเท็จจริงที่ให้ ด้วยภาษากฎหมายที่เป็นทางการ ตามแบบที่ใช้ยื่นศาลยุติธรรม
- ใช้เลขไทยทั้งหมด
- ใช้เฉพาะข้อเท็จจริงจากข้อมูลที่ให้ ห้ามแต่งเพิ่ม ส่วนที่ไม่ทราบให้เขียน [ระบุ…]
- ถ้ามี "ยอดหนี้ที่คำนวณแล้ว" ให้ใช้ตัวเลขนั้นเท่านั้น ห้ามคำนวณใหม่ แสดงวิธีคิดตามข้อมูลนั้น
- ถ้ามี "ทุนทรัพย์ที่ผู้ใช้ระบุ" ให้ใช้ยอดนั้นเป็นทุนทรัพย์ แยกรายการตามที่ผู้ใช้ให้มา ถ้าแยกไม่ได้ให้เขียน [ระบุรายการ…] ห้ามสร้างตัวเลขเอง
- ถ้ามีโจทก์หรือจำเลยหลายคน ให้เรียกว่า โจทก์ที่ ๑ โจทก์ที่ ๒ / จำเลยที่ ๑ จำเลยที่ ๒ ระบุฐานะและความรับผิดของแต่ละคนตามข้อเท็จจริง (เช่น ผู้กู้ ผู้ค้ำประกัน รับผิดร่วมกันหรือแทนกัน) และคำขอท้ายคำฟ้องให้ระบุว่าจำเลยคนใดต้องรับผิด
- อ้างเอกสารท้ายคำฟ้องตามหมายเลขที่กำหนดให้เท่านั้น ถ้าไม่มีเอกสาร ให้เขียน [ระบุเอกสาร…] ในจุดที่ควรอ้าง
- ตอบเป็น JSON อย่างเดียว ไม่มี markdown`;

const C_DRAFT_FORMAT = `ตอบ JSON รูปแบบนี้:
{
 "charge": "ข้อหาหรือฐานความผิด สั้น ๆ เช่น ผิดสัญญากู้ยืมเงิน",
 "body": ["คำฟ้องเป็นข้อ ๆ ย่อหน้าแรกไม่ต้องขึ้นต้นด้วย 'ข้อ ๑' (แบบพิมพ์มีแล้ว) ย่อหน้าถัดไปขึ้นต้นด้วย 'ข้อ ๒.' 'ข้อ ๓.' … ข้อแรกบรรยายฐานะคู่ความและเขตอำนาจศาล ข้อถัดมาบรรยายนิติสัมพันธ์ (เช่น การกู้ยืม การว่าจ้าง ตัวแทน) ข้อสัญญา การผิดนัด การทวงถาม และยอดหนี้พร้อมวิธีคิด ข้อสุดท้ายสรุปว่า โจทก์ไม่มีหนทางอื่นที่จะบังคับให้จำเลยชำระหนี้ได้ จึงนำคดีมาฟ้องต่อศาล เพื่อขอบารมีศาลเป็นที่พึ่ง บังคับจำเลยต่อไป (ไม่ต้องเขียน 'ควรมิควรแล้วแต่จะโปรด' ระบบเติมให้)"],
 "relief": ["คำขอท้ายคำฟ้องเฉพาะเรื่องเงินหรือการบังคับตามฟ้อง ไม่เกิน ๓ ข้อ ข้อละประโยค ไม่ต้องใส่เลขข้อ แต่ละข้อไม่เกินประมาณ ๑๘๐ ตัวอักษร ไม่ต้องใส่ข้อค่าฤชาธรรมเนียม (ระบบเติม 'ให้จำเลยชำระค่าฤชาธรรมเนียมและค่าทนายความแทนโจทก์' ให้เอง) และห้ามมีข้อ 'คำขออื่นตามที่ศาลเห็นสมควร'"],
 "notes": ["สิ่งที่ทนายต้องตรวจหรือเติมก่อนยื่น"]
}`;

function cDraft(req) {
  const t0 = Date.now();
  const st = statusFor(req.userId);
  if (!st.open) return { ok: false, error: 'ระบบปิดให้บริการชั่วคราว' };
  if (!st.registered || st.blocked) return { ok: false, error: 'ไม่สามารถใช้งานได้' };
  if (!req.jobId || draftCount(req.jobId) >= 3) return { ok: false, error: 'คดีนี้ให้ AI ร่างใหม่ครบ 3 ครั้งแล้ว กรุณาแก้ไขข้อความเอง หรือเริ่มคดีใหม่' };
  const c = req.caseData || {};
  const meta = { court: c.ศาล || '', caseKind: 'แพ่ง', matter: clean(c.ข้อหา || 'ฟ้องคดีแพ่ง', 80) };
  const user = 'ข้อมูลคดี:\n' + clean(JSON.stringify(c, null, 1), 20000) + '\n\n' + C_DRAFT_FORMAT;
  let res, data;
  try {
    res = callClaude([{ role: 'user', content: user }], 14000, C_DRAFT_SYSTEM, prop('C_EFFORT', 'medium'));
    data = parseJson(res.text);
    if (!data || !data.body || !data.body.length) throw new Error('no body');
  } catch (err) {
    logJob(req.jobId, req.userId, 'c_draft', 0, meta, res, Date.now() - t0, 'error', String(err.message || err));
    return { ok: false, error: 'AI ร่างคำฟ้องไม่สำเร็จ ลองกดร่างใหม่อีกครั้ง' };
  }
  logJob(req.jobId, req.userId, 'c_draft', 0, meta, res, Date.now() - t0, 'ok', '');
  return { ok: true, charge: data.charge || '', body: data.body, relief: data.relief || [], notes: data.notes || [] };
}
