// 角色隔离 / 一键标准尺寸 / 自动动画 / 按角色导出 —— 验证
const fs = require('fs'), vm = require('vm');

/* ---------- 带仿射变换的软件画布（够 animFrame 用） ---------- */
function mul(m, n){
  return [
    m[0]*n[0] + m[2]*n[1], m[1]*n[0] + m[3]*n[1],
    m[0]*n[2] + m[2]*n[3], m[1]*n[2] + m[3]*n[3],
    m[0]*n[4] + m[2]*n[5] + m[4], m[1]*n[4] + m[3]*n[5] + m[5]
  ];
}
function inv(m){
  const det = m[0]*m[3] - m[1]*m[2];
  if(!det) return [1,0,0,1,0,0];
  const a = m[3]/det, b = -m[1]/det, c = -m[2]/det, d = m[0]/det;
  return [a, b, c, d, -(a*m[4] + c*m[5]), -(b*m[4] + d*m[5])];
}
class Cv {
  constructor(w, h){
    this._w = w|0; this._h = h|0;
    this.buf = new Uint8ClampedArray(Math.max(1, this._w*this._h*4));
    this._ctx = null; this.style = {};
  }
  get width(){ return this._w; }
  set width(v){ v = v|0; if(v !== this._w){ this._w = v; this.buf = new Uint8ClampedArray(Math.max(1, this._w*this._h*4)); } }
  get height(){ return this._h; }
  set height(v){ v = v|0; if(v !== this._h){ this._h = v; this.buf = new Uint8ClampedArray(Math.max(1, this._w*this._h*4)); } }
  getContext(){ if(!this._ctx) this._ctx = new Ctx(this); return this._ctx; }
  addEventListener(){} removeEventListener(){} setPointerCapture(){}
}
class Ctx {
  constructor(cv){
    this.canvas = cv; this.m = [1,0,0,1,0,0]; this.stack = [];
    this.globalAlpha = 1; this.imageSmoothingEnabled = true; this.imageSmoothingQuality = 'high';
    this.shadowBlur = 0; this.shadowColor = '';
  }
  save(){ this.stack.push(this.m.slice()); }
  restore(){ if(this.stack.length) this.m = this.stack.pop(); }
  translate(x, y){ this.m = mul(this.m, [1,0,0,1,x,y]); }
  scale(x, y){ this.m = mul(this.m, [x,0,0,y,0,0]); }
  rotate(a){ const c = Math.cos(a), s = Math.sin(a); this.m = mul(this.m, [c,s,-s,c,0,0]); }
  setTransform(a,b,c,d,e,f){ this.m = [a,b,c,d,e,f]; }
  resetTransform(){ this.m = [1,0,0,1,0,0]; }
  getImageData(x, y, w, h){
    const out = new Uint8ClampedArray(w*h*4), cv = this.canvas;
    for(let j=0;j<h;j++) for(let i=0;i<w;i++){
      const sx = x+i, sy = y+j;
      if(sx<0||sy<0||sx>=cv.width||sy>=cv.height) continue;
      const si = (sy*cv.width+sx)*4, di = (j*w+i)*4;
      out[di]=cv.buf[si]; out[di+1]=cv.buf[si+1]; out[di+2]=cv.buf[si+2]; out[di+3]=cv.buf[si+3];
    }
    return {data:out, width:w, height:h};
  }
  putImageData(img, x, y){
    const cv = this.canvas, w = img.width, h = img.height;
    for(let j=0;j<h;j++) for(let i=0;i<w;i++){
      const di = ((y+j)*cv.width + (x+i))*4, si = (j*w+i)*4;
      cv.buf[di]=img.data[si]; cv.buf[di+1]=img.data[si+1]; cv.buf[di+2]=img.data[si+2]; cv.buf[di+3]=img.data[si+3];
    }
  }
  createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; }
  drawImage(src, ...a){
    let dx=0, dy=0, dw=src.width, dh=src.height, sx0=0, sy0=0, sw=src.width, sh=src.height;
    if(a.length === 2){ dx=a[0]; dy=a[1]; }
    else if(a.length === 4){ dx=a[0]; dy=a[1]; dw=a[2]; dh=a[3]; }
    else if(a.length === 8){ sx0=a[0]; sy0=a[1]; sw=a[2]; sh=a[3]; dx=a[4]; dy=a[5]; dw=a[6]; dh=a[7]; }
    const cv = this.canvas, M = inv(this.m);
    for(let y=0;y<cv.height;y++) for(let x=0;x<cv.width;x++){
      // 设备像素 → 用户坐标 → 源像素
      const ux = M[0]*x + M[2]*y + M[4] + 0.5;
      const uy = M[1]*x + M[3]*y + M[5] + 0.5;
      const fx = (ux - dx) / dw, fy = (uy - dy) / dh;
      if(fx < 0 || fy < 0 || fx >= 1 || fy >= 1) continue;
      const u = Math.min(src.width-1, sx0 + Math.floor(fx*sw));
      const v = Math.min(src.height-1, sy0 + Math.floor(fy*sh));
      if(u < 0 || v < 0) continue;
      const si = (v*src.width+u)*4, di = (y*cv.width+x)*4;
      cv.buf[di]=src.buf[si]; cv.buf[di+1]=src.buf[si+1]; cv.buf[di+2]=src.buf[si+2]; cv.buf[di+3]=src.buf[si+3];
    }
  }
  clearRect(x,y,w,h){ for(let j=0;j<h;j++) for(let i=0;i<w;i++){
    const di=((y+j)*this.canvas.width+(x+i))*4;
    this.canvas.buf[di]=this.canvas.buf[di+1]=this.canvas.buf[di+2]=this.canvas.buf[di+3]=0; } }
  fillRect(){} fillText(){} stroke(){} arc(){} beginPath(){} moveTo(){} lineTo(){} rect(){} ellipse(){}
  closePath(){} quadraticCurveTo(){} bezierCurveTo(){} clip(){} strokeRect(){} setLineDash(){} fill(){}
  drawFocusIfNeeded(){} measureText(t){ return {width:String(t).length*12}; }
  createLinearGradient(){ return {addColorStop(){}}; }
  createRadialGradient(){ return {addColorStop(){}}; }
  createPattern(){ return {}; }
}
class El {
  constructor(){ this.style={}; this.dataset={}; this.value='0'; this.checked=false; this.disabled=false;
    this.files=[]; this.textContent=''; this.innerHTML=''; this.className=''; this.title='';
    this._cls=new Set(); this.kids=[];
    this.classList={toggle:(c,on)=>{ if(on) this._cls.add(c); else this._cls.delete(c); },
      add:c=>this._cls.add(c), remove:c=>this._cls.delete(c), contains:c=>this._cls.has(c)};
  }
  addEventListener(){} appendChild(c){ this.kids.push(c); return c; }
  append(){ } prepend(){} remove(){}
  querySelectorAll(sel){
    const all = this.kids || [];
    if(!sel) return all;
    const cls = sel.replace(/^\./, '');
    return all.filter(k=> k._cls && (k._cls.has(cls) || String(k.className||'').split(/\s+/).includes(cls)));
  }
  querySelector(){ return null; }
  getBoundingClientRect(){ return {left:0,top:0,width:800,height:600}; }
  getContext(){ const c=new Cv(1,1); return c.getContext(); }
  showModal(){} close(){} click(){ this.onclick && this.onclick(); }
  setPointerCapture(){}
}
const store = {};
const getEl = id => store[id] || (store[id] = new El());

const sandbox = {
  console, Math, JSON, Date, parseInt, parseFloat, Number, String, Array, Object, Boolean,
  Float32Array, Uint8Array, Uint8ClampedArray, Uint32Array, Int32Array, DataView, ArrayBuffer,
  TextEncoder, Blob, isNaN, Infinity, NaN, undefined, Promise,
  ImageData: class { constructor(a,b,c){
    if(typeof a === 'number'){ this.width=a; this.height=b; this.data=new Uint8ClampedArray(a*b*4); }
    else { this.data=a; this.width=b; this.height=c; }
  }},
  setTimeout: ()=>0, clearTimeout: ()=>{},
  requestAnimationFrame: ()=>1, cancelAnimationFrame: ()=>{},
  performance: { now: ()=>0 },
  URL: {createObjectURL:()=>'blob:x', revokeObjectURL:()=>{}},
  Image: function(){ return new El(); },
  createImageBitmap: async ()=>new Cv(1,1),
  alert: ()=>{}, confirm: ()=> sandbox.__confirm !== false, prompt: ()=>null,
  devicePixelRatio: 1,
  navigator: {},
  document: {
    getElementById: id=>getEl(id),
    querySelector: s=>getEl(s.startsWith('#') ? s.slice(1) : s),
    querySelectorAll: s=>{
      if(s === '#curSizeBox input:checked') return (sandbox.__curSizes||[]).map(v=>({value:String(v)}));
      return [];
    },
    createElement: t=> t==='canvas' ? new Cv(32,32) : new El(),
    addEventListener(){}, body:{classList:{toggle(){}}}
  },
  addEventListener(){}, removeEventListener(){}
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const html = fs.readFileSync('../指针工坊.html','utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
try{ vm.runInContext(src, sandbox, {filename:'ptr_roles.js'}); console.log('LOAD OK'); }
catch(e){ console.error('LOAD FAIL:', e.message, '\n', e.stack.split('\n').slice(0,6).join('\n')); process.exit(1); }

let pass = 0, fail = 0;
const T = (n, c, x='') => { if(c){ pass++; console.log('PASS', n, x); } else { fail++; console.log('FAIL', n, x); } };
const run = c => vm.runInContext(c, sandbox);
const sum = arr => { let s=0; for(let i=0;i<arr.length;i+=97) s=(s+arr[i]*(i%13+1))|0; return s; };

/* ---------- 1. 角色隔离：每个角色一份作品 ---------- */
run(`
  D.W = 64; D.base.width = D.base.height = 64;
  (function(){
    const d = new ImageData(64,64);
    for(let y=10;y<40;y++) for(let x=10;x<50;x++){ const i=(y*64+x)*4; d.data[i]=210; d.data[i+3]=255; }
    D.base.getContext('2d').putImageData(d,0,0);
  })();
  D.hotspot = {x:11,y:11};
`);
T('初始角色是 Arrow', run(`RD.cur`) === 'Arrow');
T('Arrow 有内容', run(`roleStateOf('Arrow').has`) === true);

run(`switchRole('Wait')`);
T('切到 Wait 后画布是空的', run(`roleStateOf('Wait').has`) === false);
T('画布尺寸沿用 64', run(`D.W`) === 64);
T('Arrow 的存档已建立', run(`!!RD.docs.Arrow`) === true);
T('Arrow 存档里有像素', run(`docHasContent(RD.docs.Arrow)`) === true);
T('当前角色变成 Wait', run(`RD.cur`) === 'Wait');
T('状态栏文字跟随角色', getEl('rbName').textContent === '忙碌', getEl('rbName').textContent);
T('tab 标题带角色名', /忙碌/.test(getEl('tabDesign').innerHTML), getEl('tabDesign').innerHTML);

/* 在 Wait 上画绿色，再切回去，两份互不污染 */
run(`
  (function(){
    const d = new ImageData(64,64);
    for(let y=20;y<50;y++) for(let x=20;x<60;x++){ const i=(y*64+x)*4; d.data[i+1]=200; d.data[i+3]=255; }
    D.base.getContext('2d').putImageData(d,0,0);
  })();
  D.hotspot = {x:22,y:22};
  switchRole('Arrow');
`);
const back = run(`(function(){
  const d = D.base.getContext('2d').getImageData(0,0,64,64).data;
  return {r:d[(11*64+11)*4], g:d[(11*64+11)*4+1], hs:D.hotspot.x};
})()`);
T('切回 Arrow：像素还是红色的那份', back.r === 210 && back.g === 0, JSON.stringify(back));
T('切回 Arrow：热点也恢复', back.hs === 11, String(back.hs));
run(`switchRole('Wait')`);
const waitPx = run(`(function(){
  const d = D.base.getContext('2d').getImageData(0,0,64,64).data;
  return {r:d[(25*64+25)*4], g:d[(25*64+25)*4+1], hs:D.hotspot.x};
})()`);
T('再切回 Wait：绿色那份额外还在', waitPx.g === 200 && waitPx.r === 0, JSON.stringify(waitPx));
T('Wait 热点独立（22）', waitPx.hs === 22, String(waitPx.hs));
T('角色徽标只高亮当前一个', run(`(()=>{
  const el = document.getElementById('roleGrid');
  const on = el.querySelectorAll('.rg').filter(b=>b.classList.contains('on'));
  return on.length;
})()`) === 1);

/* 无内容角色不应被误判 */
run(`switchRole('Help')`);
T('切到从没编辑过的 Help：空白', run(`roleStateOf('Help').has`) === false);
T('但 Arrow/Wait 仍有内容', run(`['Arrow','Wait'].every(k=>roleStateOf(k).has)`) === true);

/* ---------- 2. 一键标准尺寸 ---------- */
run(`
  switchRole('Arrow');
  // 造一张 100×50 宽扁的图（模拟「不管素材什么样」）
  (function(){
    const cv = document.createElement('canvas'); cv.width=100; cv.height=50;
    const g = cv.getContext('2d');
    const d = new ImageData(100,50);
    for(let y=5;y<45;y++) for(let x=5;x<95;x++){ const i=(y*100+x)*4; d.data[i]=40; d.data[i+1]=120; d.data[i+2]=200; d.data[i+3]=255; }
    g.putImageData(d,0,0);
    const data = g.getImageData(0,0,100,50);
    replaceSheet(cv, data, '测试');
  })();
`);
T('素材是 100×50（非正方形）', run(`SP.W+'x'+SP.H`) === '100x50');
run(`standardizeSheet(128, false)`);
T('标准尺寸后严格 128×128', run(`SP.W`) === 128 && run(`SP.H`) === 128);
const stdBox = run(`(function(){
  const d = SP.outCv.getContext('2d').getImageData(0,0,128,128).data;
  let x0=128,y0=128,x1=-1,y1=-1;
  for(let y=0;y<128;y++) for(let x=0;x<128;x++){
    if(d[(y*128+x)*4+3] > 8){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  }
  return {w:x1-x0+1, h:y1-y0+1, x0, y0, corner:d[3]};
})()`);
T('内容左右贴满（宽边先到 128）', Math.abs(stdBox.w - 128) <= 2, JSON.stringify(stdBox));
T('长宽比不变（源 90:40 → 目标约 2.25:1）', Math.abs(stdBox.w/stdBox.h - 90/40) < 0.12,
  (stdBox.w/stdBox.h).toFixed(2) + ' vs 2.25');
T('上下补的是透明边（角上 alpha=0）', stdBox.corner === 0, String(stdBox.corner));
T('上下留白对称（居中）', Math.abs(stdBox.y0 - (128 - stdBox.h - stdBox.y0)) <= 2, JSON.stringify(stdBox));

/* apply = 直接设为画布并用作画面 */
run(`standardizeSheet(128, true)`);
T('勾选后画布变成 128', run(`D.W`) === 128);
T('画布落在当前角色上', run(`D.W`) === 128 && run(`roleStateOf('Arrow').has`) === true);
T('热点落在画布内', run(`D.hotspot.x >= 0 && D.hotspot.x < 128 && D.hotspot.y >= 0 && D.hotspot.y < 128`));
T('自动切到设计模块', run(`tabName`) === 'design', String(run(`tabName`)));

/* ---------- 3. 自动动画 ---------- */
const bobDiff = run(`(function(){
  const cv = merged();
  const a = animFrame(cv, 'bob', 0, 1);
  const b = animFrame(cv, 'bob', 0.25, 1);
  let diff = 0;
  for(let i=0;i<a.buf.length;i+=4) if(a.buf[i+3] !== b.buf[i+3]) diff++;
  return diff;
})()`);
T('呼吸浮动：上下两帧确实不同', bobDiff > 50, 'diff=' + bobDiff);

const spinDiff = run(`(function(){
  const cv = merged();
  const a = animFrame(cv, 'spin', 0, 1);
  const b = animFrame(cv, 'spin', 0.25, 1);
  let diff = 0;
  for(let i=0;i<a.buf.length;i+=4) if(Math.abs(a.buf[i]-b.buf[i]) > 8) diff++;
  return diff;
})()`);
T('旋转：0° 与 90° 明显不同', spinDiff > 100, 'diff=' + spinDiff);

const ampDiff = run(`(function(){
  const cv = merged();
  const a = animFrame(cv, 'bob', 0.25, 0.3);
  const b = animFrame(cv, 'bob', 0.25, 2.0);
  let diff = 0;
  for(let i=0;i<a.buf.length;i+=4) if(a.buf[i+3] !== b.buf[i+3]) diff++;
  return diff;
})()`);
T('幅度参数生效（0.3 vs 2.0 位移不同）', ampDiff > 20, 'diff=' + ampDiff);

run(`
  $('#animPreset').value = 'spin'; $('#animN').value = '12';
  $('#animMs').value = '90'; $('#animAmp').value = '100';
  sandbox_confirm = true;
`);
run(`generateAnim()`);
T('生成 12 帧', run(`frames.length`) === 12, String(run(`frames.length`)));
T('每帧 90ms', run(`frames.every(f=>f.ms===90)`) === true);
T('帧尺寸与画布一致', run(`frames.every(f=>f.cv.width===D.W)`) === true);
const uniq = run(`(function(){
  const set = new Set();
  for(const F of frames){
    let s = 0;
    for(let i=0;i<F.cv.buf.length;i+=53) s = (s + F.cv.buf[i]) | 0;
    set.add(s);
  }
  return set.size;
})()`);
T('12 帧不是同一张图（至少 8 种）', uniq >= 8, 'unique=' + uniq);
T('角色状态显示为动画', /帧动画/.test(getEl('rbState').textContent), getEl('rbState').textContent);
T('导出名变成 .ani', /\.ani/.test(getEl('rbKey').textContent), getEl('rbKey').textContent);

/* 空画布不给生成 */
run(`switchRole('SizeAll')`);
const emptyGuard = run(`(function(){
  try{ generateAnim(); return 'no-throw'; }catch(e){ return 'threw:' + e.message; }
})()`);
T('空白角色生成动画不报错（只提示）', emptyGuard === 'no-throw', emptyGuard);
T('空白角色不产生帧', run(`frames.length`) === 0, String(run(`frames.length`)));

/* ---------- 4. 按角色导出 ---------- */
run(`
  switchRole('Wait');
  (function(){
    const d = new ImageData(128,128);
    for(let y=30;y<90;y++) for(let x=30;x<90;x++){ const i=(y*128+x)*4; d.data[i+1]=230; d.data[i+3]=255; }
    D.base.getContext('2d').putImageData(d,0,0);
    D.hotspot = {x:60,y:60};
  })();
`);
const files = run(`(function(){
  const r = buildRoleFiles();
  const map = {};
  for(const f of r.files) map[f.slot.file] = {len:f.data.length, sum:(function(){
    let s=0; for(let i=0;i<f.data.length;i+=31) s=(s+f.data[i]*(i%7+1))|0; return s;
  })(), from:f.from, name:f.fileName};
  return {map, own:r.own, reused:r.reused, n:r.files.length};
})()`);
T('导出仍然 17 个角色文件', files.n === 17, String(files.n));
T('每个文件都有内容', Object.values(files.map).every(v=>v.len > 100), JSON.stringify(Object.values(files.map).map(v=>v.len).slice(0,5)));
T('pointer（Arrow）与 busy（Wait）字节不同', files.map.pointer.sum !== files.map.busy.sum,
  files.map.pointer.sum + ' vs ' + files.map.busy.sum);
T('没单独做的角色沿用当前作品（help = busy 同字节）', files.map.help.sum === files.map.busy.sum,
  files.map.help.sum + ' vs ' + files.map.busy.sum);
T('统计：2 个单独（Arrow 动画 / Wait 静态）+ 15 个沿用', files.own === 2 && files.reused === 15,
  `own=${files.own} reused=${files.reused}`);
T('Arrow 有 12 帧 → 导出 .ani', files.map.pointer.name === 'pointer.ani', files.map.pointer.name);
T('Wait 单帧 → 导出 .cur', files.map.busy.name === 'busy.cur', files.map.busy.name);

/* 当前角色是 Wait，导出它自己那份也应该是绿色那份 */
T('当前角色 Wait 用自己的作品', files.map.busy.from === 'own', files.map.busy.from);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
