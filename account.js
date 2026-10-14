/* ผู้ใช้ / ออกจากระบบ — shared by the AI tools (complaint, notice, answer).
   The site has no password login: registration is remembered in this browser (localStorage 'answerUser').
   Logging out forgets it; the stronger option also wipes every draft, signature and file kept on this device.
   Pages without their own sign-up step (the PDF tool) load this with data-gate: a sign-up card covers the page until the user registers,
   and the bar goes into [data-acct] when the page has no .site-head. */
(function(){
  const USER='answerUser';
  const WORK=['cWork','xWork','gWork','cLawyer','cTab','nWork','nLawyer','answerWork','answerMan','answerTab',
    'pdfFields','pdfImport','pdfMe','pdfSigs','pdfThNum'];
  const DBS=['lawComplaint','pdf-filler'];
  const get=k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}};
  const del=k=>{try{localStorage.removeItem(k)}catch(e){}};
  const CSS=`.acct{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:14px;color:var(--muted,#5b6475);min-width:0}
.acct b{color:var(--ink,#1f45b5);font-weight:600;max-width:12em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.acct button{font:inherit;font-size:13px;border:1px solid var(--line,#dfe3ea);background:#fff;border-radius:8px;padding:5px 10px;cursor:pointer;color:inherit;white-space:nowrap}
.acct button:hover{border-color:var(--ink,#1f45b5)}
.acct-pop{position:fixed;inset:0;background:#0008;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}
.acct-card{background:#fff;border-radius:14px;max-width:420px;width:100%;padding:20px;display:flex;flex-direction:column;gap:10px;font-size:15px;color:#17202e;box-shadow:0 10px 40px #0004}
.acct-card h3{margin:0 0 4px;font-size:18px}.acct-card p{margin:0 0 6px;color:#5b6475;line-height:1.5}
.acct-card button{font:inherit;min-height:46px;border-radius:10px;border:1px solid #dfe3ea;background:#fff;cursor:pointer;text-align:left;padding:8px 14px}
.acct-card button small{display:block;color:#5b6475;font-size:13px}
.acct-card .danger{border-color:#f0b4ae;color:#8a1c12}.acct-card .cancel{text-align:center}
@media (max-width:560px){.acct .nm{display:none}}
.acct-card label{display:flex;flex-direction:column;gap:4px;font-size:14px;color:#5b6475}
.acct-card input,.acct-card select{font:inherit;font-size:16px;min-height:44px;border:1px solid #dfe3ea;border-radius:9px;padding:6px 10px;color:#17202e;background:#fff}
.acct-card .ck{flex-direction:row;align-items:flex-start;gap:8px;color:#17202e;font-size:14px;line-height:1.5}.acct-card .ck input{min-height:0;width:20px;height:20px;flex:none;margin-top:2px}
.acct-card .go{background:#1f45b5;color:#fff;border-color:#1f45b5;text-align:center;font-weight:600}.acct-card .go:disabled{opacity:.6}
.acct-card .msg{color:#8a1c12;font-size:14px;min-height:1.2em}.acct-card .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media (max-width:480px){.acct-card .two{grid-template-columns:1fr}}
.acct-card a{color:#1f45b5}
.acct-gate{align-items:flex-start;overflow:auto}.acct-gate .acct-card{margin:auto}
@media print{.acct,.acct-pop{display:none!important}}`;
  function wipeAll(){
    WORK.forEach(del);
    DBS.forEach(n=>{try{indexedDB.deleteDatabase(n)}catch(e){}});
  }
  function ask(){
    const w=document.createElement('div');w.className='acct-pop';
    w.innerHTML='<div class="acct-card" role="dialog" aria-modal="true" aria-labelledby="acctT"><h3 id="acctT">ออกจากระบบ</h3>'+
      '<p>ระบบจำการลงทะเบียนไว้ในเบราว์เซอร์นี้ ถ้าเป็นเครื่องที่ใช้ร่วมกับคนอื่น ควรลบงานที่ร่างค้างด้วย</p>'+
      '<button type="button" data-a="out">ออกจากระบบ<small>งานที่ร่างค้างยังอยู่ในเครื่องนี้</small></button>'+
      '<button type="button" data-a="wipe" class="danger">ออกและลบงานที่ร่างค้างทั้งหมดในเครื่องนี้<small>ข้อมูลคู่ความ ร่างเอกสาร ไฟล์แนบ ลายเซ็น และงานค้างในเครื่องมือพิมพ์บนแบบฟอร์ม</small></button>'+
      '<button type="button" data-a="no" class="cancel">ยกเลิก</button></div>';
    const close=()=>w.remove();
    w.addEventListener('click',e=>{const b=e.target.closest('button');if(e.target===w||(b&&b.dataset.a==='no'))return close();if(!b)return;
      del(USER);if(b.dataset.a==='wipe')wipeAll();
      setTimeout(()=>location.reload(),150)});
    document.addEventListener('keydown',function esc(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',esc)}});
    document.body.append(w);w.querySelector('button').focus();
  }
  let styled=false;const style=()=>{if(styled)return;styled=true;const st=document.createElement('style');st.textContent=CSS;document.head.append(st)};
  function mount(){
    const u=get(USER),host=document.querySelector('.site-head .wrap')||document.querySelector('[data-acct]');if(!u||!u.name||!host||host.querySelector('.acct'))return;
    style();
    const box=document.createElement('div');box.className='acct';
    const nm=document.createElement('span');nm.className='nm';nm.append('ผู้ใช้: ');const b=document.createElement('b');b.textContent=u.name;nm.append(b);
    const out=document.createElement('button');out.type='button';out.textContent='ออกจากระบบ';out.onclick=ask;
    box.append(nm,out);host.style.display='flex';host.style.alignItems='center';host.style.gap='12px';host.append(box);
  }
  /* ---------- sign-up gate (data-gate) ---------- */
  const me=document.currentScript,GATE=me&&me.hasAttribute('data-gate');
  const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
  async function api(action,payload){
    const API=(window.ANSWER_API||'').trim();if(!API)throw new Error('ยังไม่ได้ตั้งค่าระบบหลังบ้าน');
    const r=await fetch(API,{method:'POST',body:JSON.stringify(Object.assign({action},payload))});
    if(!r.ok)throw new Error('เชื่อมต่อระบบไม่ได้ ('+r.status+')');const j=await r.json();if(!j.ok)throw new Error(j.error||'ระบบขัดข้อง');return j;
  }
  function gate(old,note){
    if(document.querySelector('.acct-gate'))return;style();
    const w=document.createElement('div');w.className='acct-pop acct-gate';
    w.innerHTML='<form class="acct-card" novalidate role="dialog" aria-modal="true" aria-labelledby="gT"><h3 id="gT">ลงทะเบียนก่อนใช้งาน</h3>'+
      '<p>กรอกครั้งเดียว ระบบจำไว้ในเบราว์เซอร์นี้ ถ้าเคยลงทะเบียนในเครื่องมือ AI ของเว็บนี้ในเครื่องนี้แล้ว จะเข้าใช้ได้ทันที</p>'+(note?'<p class="msg">'+note+'</p>':'')+
      '<label>ชื่อ-นามสกุล *<input name="name" autocomplete="name" required></label>'+
      '<div class="two"><label>เบอร์โทรศัพท์ *<input name="phone" inputmode="tel" autocomplete="tel" required></label><label>LINE ID<input name="line"></label></div>'+
      '<label>อีเมล<input name="email" type="email" autocomplete="email"></label>'+
      '<label>คุณคือ<select name="role"><option>ทนายความ</option><option>เจ้าหน้าที่สำนักงานทนายความ / นิติกร</option><option>ประชาชน (ใช้เอง)</option><option>นักศึกษากฎหมาย</option><option>อื่น ๆ</option></select></label>'+
      '<label class="ck"><input type="checkbox" name="ok"><span>ฉันยินยอมให้เก็บชื่อและช่องทางติดต่อข้างต้นเพื่อบันทึกการใช้งาน (เอกสารที่พิมพ์อยู่ในเครื่องของฉันเท่านั้น ไม่ถูกส่งออกไป) และจะตรวจความถูกต้องของเอกสารเอง</span></label>'+
      '<div class="msg" aria-live="polite"></div><button class="go" type="submit">เริ่มใช้งาน</button><a href="/">← กลับหน้าเครื่องมือทั้งหมด</a></form>';
    const f=w.querySelector('form'),msg=f.querySelector('.msg:not(p)'),q=n=>f.elements[n];
    if(old)['name','phone','line','email','role'].forEach(k=>{if(old[k])q(k).value=old[k]});
    f.addEventListener('submit',async e=>{e.preventDefault();
      const u={userId:(old&&old.userId)||uid(),name:q('name').value.trim(),phone:q('phone').value.trim(),line:q('line').value.trim(),email:q('email').value.trim(),role:q('role').value};
      if(!u.name||!u.phone){msg.textContent='กรุณากรอกชื่อและเบอร์โทรศัพท์';return}
      if(!q('ok').checked){msg.textContent='กรุณาติ๊กยินยอมก่อน';return}
      const b=f.querySelector('.go');b.disabled=true;msg.textContent='กำลังบันทึก…';
      try{await api('register',Object.assign({consent:true},u));localStorage.setItem(USER,JSON.stringify(u));w.remove();document.documentElement.style.overflow=''}
      catch(err){msg.textContent=err.message}finally{b.disabled=false}});
    document.documentElement.style.overflow='hidden';document.body.append(w);setTimeout(()=>q('name').focus(),50);
  }
  function blockedCard(){style();const w=document.createElement('div');w.className='acct-pop acct-gate';
    w.innerHTML='<div class="acct-card"><h3>บัญชีนี้ถูกระงับการใช้งาน</h3><p>หากเห็นว่าผิดพลาด โปรดติดต่อผู้ดูแลเว็บไซต์</p><a href="/">← กลับหน้าเครื่องมือทั้งหมด</a></div>';
    document.documentElement.style.overflow='hidden';document.body.append(w)}
  function checkGate(){
    const u=get(USER);if(!u||!u.name||!u.userId)return gate(u);
    /* the admin may have removed or blocked this user: ask the server, but never lock anyone out when it cannot be reached */
    api('status',{userId:u.userId}).then(st=>{if(st.blocked)blockedCard();else if(st.registered===false){del(USER);document.querySelector('.acct')?.remove();gate(u,'ไม่พบข้อมูลลงทะเบียนของคุณในระบบ กรุณาลงทะเบียนอีกครั้ง')}}).catch(()=>{});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  if(GATE){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',checkGate);else checkGate()}
  /* registration happens inside the page: show the bar as soon as it is saved */
  window.addEventListener('storage',mount);
  const _set=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){_set.apply(this,arguments);if(k===USER&&this===window.localStorage)setTimeout(mount,0)};
})();
