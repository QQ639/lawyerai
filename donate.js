/* ช่วยเติมน้ำมัน — PromptPay QR (ไม่บังคับ) shared by every page.
   Donate.mount(el,{onBack}) puts the panel in el (hidden until Donate.reveal(el)).
   A small link is added to every .site-foot; it opens the same panel in a popup. */
(function(){
  const ROOT=(document.currentScript&&document.currentScript.src||'/donate.js').replace(/donate\.js.*$/,'');
  const IMG=n=>ROOT+'img/'+n;
  /* payload of the owner's CLIX PromptPay QR (static); an amount is added as tag 54 */
  const PP_ACC='0016A000000677010111'+'0315088989000065561';
  const TH=s=>String(s).replace(/\d/g,d=>'๐๑๒๓๔๕๖๗๘๙'[d]);
  function crc(s){let c=0xFFFF;for(const b of new TextEncoder().encode(s)){c^=b<<8;for(let i=0;i<8;i++)c=(c&0x8000)?((c<<1)^0x1021)&0xFFFF:(c<<1)&0xFFFF}return c.toString(16).toUpperCase().padStart(4,'0')}
  const tlv=(t,v)=>t+String(v.length).padStart(2,'0')+v;
  function payload(amt){
    let p=tlv('00','01')+tlv('01',amt?'12':'11')+tlv('29',PP_ACC)+tlv('58','TH')+tlv('53','764');
    if(amt)p+=tlv('54',amt.toFixed(2));
    p+='6304';return p+crc(p);
  }
  function qrCanvas(text,px){
    const q=qrcode(0,'M');q.addData(text);q.make();
    const n=q.getModuleCount(),quiet=3,cell=Math.max(2,Math.floor(px/(n+quiet*2))),size=cell*(n+quiet*2);
    const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');
    g.fillStyle='#fff';g.fillRect(0,0,size,size);g.fillStyle='#000';
    for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(q.isDark(r,k))g.fillRect((k+quiet)*cell,(r+quiet)*cell,cell,cell);
    return c;
  }
  const CSS=`
.dn{margin:18px 0 6px;border:1px solid #bfe3c9;background:linear-gradient(180deg,#f3fbf5,#fff);border-radius:16px;padding:16px;font-size:15px;color:#1c2b22}
.dn[hidden]{display:none}
.dn-h{display:flex;gap:12px;align-items:center}
.dn-h img{width:54px;height:54px;border-radius:12px;flex:none}
.dn-h b{display:block;font-size:17px;color:#14532d}
.dn-h small{display:block;color:#5b6b61;font-size:13px;margin-top:2px}
.dn-amt{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 10px}
.dn .dn-amt button{width:auto;min-height:0;font:inherit;border:1px solid #9fd3ad;background:#fff;color:#14532d;border-radius:999px;padding:7px 16px;cursor:pointer;min-width:64px}
.dn .dn-amt button.on{background:#15803d;border-color:#15803d;color:#fff}
.dn-amt label{display:flex;align-items:center;gap:6px;border:1px solid #9fd3ad;border-radius:999px;padding:3px 6px 3px 14px;background:#fff}
.dn-amt label.on{border-color:#15803d;box-shadow:0 0 0 2px #15803d33}
.dn-amt input{font:inherit;width:84px;border:0;outline:0;background:transparent;text-align:right;padding:4px}
.dn-body{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.dn-card{background:#fff;border:1px solid #dfe7e2;border-radius:14px;padding:10px 10px 8px;text-align:center;width:230px;flex:none}
.dn-card .pp{display:inline-block;background:#103e68;color:#fff;font:600 13px/1 sans-serif;border-radius:4px;padding:4px 8px;letter-spacing:.3px}
.dn-card canvas{width:200px;height:200px;display:block;margin:6px auto 4px;image-rendering:pixelated}
.dn-card .amt{font-weight:700;color:#14532d}
.dn-txt{flex:1;min-width:200px;color:#33433a;line-height:1.6}
.dn-txt p{margin:0 0 8px}
.dn .dn-txt button{width:auto;min-height:0;font:inherit;border:1px solid #9fd3ad;background:#fff;color:#14532d;border-radius:10px;padding:6px 12px;cursor:pointer}
.dn-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
.dn-pair img{width:100%;display:block;border-radius:14px}
.dn-pair a{display:block;border-radius:14px;cursor:pointer;transition:transform .15s}
.dn-pair a:hover{transform:translateY(-2px)}
.dn-pair a:focus-visible{outline:3px solid #15803d;outline-offset:2px}
.dn-pop{position:fixed;inset:0;background:#0009;z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px}
.dn-pop .dn{max-width:560px;width:100%;background:#fff;margin:0}
.dn .dn-x{width:auto;min-height:0;float:right;font:inherit;font-size:22px;line-height:1;border:0;background:none;cursor:pointer;color:#5b6b61;padding:0 4px}
.dn-link{color:inherit;text-decoration:underline;cursor:pointer}
@media (max-width:520px){.dn-card{margin:0 auto}.dn-txt{min-width:100%}}
@media print{.dn,.dn-pop{display:none!important}}`;
  function css(){if(document.getElementById('dnCss'))return;const s=document.createElement('style');s.id='dnCss';s.textContent=CSS;document.head.append(s)}

  function build(onBack,closeBtn){
    css();
    const d=document.createElement('div');d.className='dn';
    d.innerHTML=`${closeBtn?'<button class="dn-x" type="button" aria-label="ปิด">×</button>':''}
<div class="dn-h"><img src="${IMG('logo.jpg')}" alt="ทนาย Ai+"><div><b>ช่วยเติมน้ำมัน</b>สนับสนุนค่าใช้จ่าย AI และการพัฒนาเว็บไซต์ (ไม่บังคับ)<small>ไม่ใช่ค่าบริการทางกฎหมาย ใช้งานต่อได้ตามปกติแม้ไม่สนับสนุน</small></div></div>
<div class="dn-amt"><button type="button" data-a="20">๒๐ บาท</button><button type="button" data-a="50" class="on">๕๐ บาท</button><button type="button" data-a="100">๑๐๐ บาท</button><label>ระบุเอง<input inputmode="decimal" placeholder="จำนวน" aria-label="ระบุจำนวนเงินเอง"> บาท</label></div>
<div class="dn-body"><div class="dn-card"><span class="pp">PromptPay พร้อมเพย์</span><div class="cv"></div><div class="amt"></div></div>
<div class="dn-txt"><p>สแกนด้วยแอปธนาคารใดก็ได้ผ่านพร้อมเพย์ ไม่มีค่าธรรมเนียม ยอดเงินขึ้นให้อัตโนมัติ</p><p>ใช้มือถือ: กด “บันทึกรูป QR” แล้วเลือกรูปนี้ในเมนูสแกนของแอปธนาคาร</p><button type="button" class="sv">บันทึกรูป QR</button></div></div>
<div class="dn-pair"><img src="${IMG('thanks.jpg')}" alt="ขอบคุณที่ช่วยค่าเชื้อเพลิง AI"><a role="button" tabindex="0" title="ย้อนกลับไปแก้ไขเอกสาร"><img src="${IMG('back.jpg')}" alt="ย้อนกลับไปแก้ไขเอกสาร"></a></div>`;
    let amt=50;const cv=d.querySelector('.cv'),am=d.querySelector('.amt'),inp=d.querySelector('input'),lab=d.querySelector('label');
    function draw(){cv.textContent='';if(typeof qrcode!=='function'){cv.textContent='โหลด QR ไม่สำเร็จ';return}cv.append(qrCanvas(payload(amt),400));am.textContent=amt?TH(amt.toLocaleString('en-US',{maximumFractionDigits:2}))+' บาท':'ระบุยอดเองในแอป'}
    d.querySelectorAll('.dn-amt button').forEach(b=>b.onclick=()=>{d.querySelectorAll('.dn-amt button').forEach(x=>x.classList.toggle('on',x===b));lab.classList.remove('on');inp.value='';amt=+b.dataset.a;draw()});
    inp.oninput=()=>{const v=parseFloat(inp.value.replace(/[๐-๙]/g,c=>'๐๑๒๓๔๕๖๗๘๙'.indexOf(c)).replace(/[^\d.]/g,''));d.querySelectorAll('.dn-amt button').forEach(x=>x.classList.remove('on'));lab.classList.add('on');amt=v>0&&v<1e6?Math.round(v*100)/100:0;draw()};
    d.querySelector('.sv').onclick=()=>{
      const q=qrCanvas(payload(amt),600),W=q.width+80,c=document.createElement('canvas');c.width=W;c.height=q.height+170;const g=c.getContext('2d');
      g.fillStyle='#fff';g.fillRect(0,0,W,c.height);g.fillStyle='#103e68';g.fillRect(0,0,W,70);g.fillStyle='#fff';g.font='bold 34px sans-serif';g.textAlign='center';g.fillText('PromptPay พร้อมเพย์',W/2,47);
      g.drawImage(q,40,85);g.fillStyle='#14532d';g.font='bold 36px sans-serif';g.fillText(amt?amt.toLocaleString('en-US')+' บาท':'ระบุยอดเอง',W/2,q.height+130);
      g.fillStyle='#555';g.font='22px sans-serif';g.fillText('ช่วยเติมน้ำมัน AI · lawyerthaiai.com',W/2,q.height+160);
      c.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='promptpay-'+(amt||'qr')+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)},'image/png');
    };
    const back=d.querySelector('.dn-pair a'),go=()=>onBack&&onBack();back.onclick=go;back.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}};
    if(closeBtn)d.querySelector('.dn-x').onclick=()=>onBack&&onBack();
    draw();return d;
  }
  function ensureLib(cb){if(typeof qrcode==='function')return cb();const s=document.createElement('script');s.src=ROOT+'lib/qrcode.js';s.onload=cb;s.onerror=cb;document.head.append(s)}

  const Donate={
    /* panel placed in host, hidden until reveal() */
    mount(host,opt={}){ensureLib(()=>{if(host.querySelector('.dn'))return;const p=build(opt.onBack,false);p.hidden=true;host.append(p)})},
    reveal(host,scroll=true){ensureLib(()=>{let p=host.querySelector('.dn');if(!p){Donate.mount(host);p=host.querySelector('.dn')}if(!p)return;const was=p.hidden;p.hidden=false;if(scroll&&was)setTimeout(()=>p.scrollIntoView({behavior:'smooth',block:'nearest'}),150)})},
    hide(host){const p=host&&host.querySelector('.dn');if(p)p.hidden=true},
    open(){ensureLib(()=>{const w=document.createElement('div');w.className='dn-pop';const close=()=>{w.remove();document.removeEventListener('keydown',esc)};const esc=e=>{if(e.key==='Escape')close()};w.append(build(close,true));w.onclick=e=>{if(e.target===w)close()};document.addEventListener('keydown',esc);document.body.append(w)})}
  };
  window.Donate=Donate;
  /* small link at the end of every page */
  function footLink(){css();document.querySelectorAll('.site-foot,.credit').forEach(f=>{if(f.querySelector('.dn-link'))return;const host=f.querySelector('.wrap>span')||f.querySelector('span')||f;const a=document.createElement('a');a.className='dn-link';a.textContent='ช่วยเติมน้ำมัน AI';a.href='#support';a.onclick=e=>{e.preventDefault();Donate.open()};host.append(' · ',a)})
    if(location.hash==='#support')Donate.open()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',footLink);else footLink();
})();
