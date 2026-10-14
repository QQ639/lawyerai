/* ผู้ใช้ / ออกจากระบบ — shared by the AI tools (complaint, notice, answer).
   The site has no password login: registration is remembered in this browser (localStorage 'answerUser').
   Logging out forgets it; the stronger option also wipes every draft, signature and file kept on this device. */
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
  function mount(){
    const u=get(USER),host=document.querySelector('.site-head .wrap');if(!u||!u.name||!host||host.querySelector('.acct'))return;
    const st=document.createElement('style');st.textContent=CSS;document.head.append(st);
    const box=document.createElement('div');box.className='acct';
    const nm=document.createElement('span');nm.className='nm';nm.append('ผู้ใช้: ');const b=document.createElement('b');b.textContent=u.name;nm.append(b);
    const out=document.createElement('button');out.type='button';out.textContent='ออกจากระบบ';out.onclick=ask;
    box.append(nm,out);host.style.display='flex';host.style.alignItems='center';host.style.gap='12px';host.append(box);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  /* registration happens inside the page: show the bar as soon as it is saved */
  window.addEventListener('storage',mount);
  const _set=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){_set.apply(this,arguments);if(k===USER&&this===window.localStorage)setTimeout(mount,0)};
})();
