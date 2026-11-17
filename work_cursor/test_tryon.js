// 实景试戴预览验证：场景绘制 / 命中切换 / 热点 / 尺寸 / 帧循环 / 开关
const fs = require('fs'), vm = require('vm');

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
    this.canvas = cv;
    this.calls = {fillRect:0, fillText:0, drawImage:[], stroke:0, arc:0, save:0};
  }
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
    const cv = this.canvas;
    let sx=0, sy=0, sw=src.width, sh=src.height, dx=0, dy=0, dw=sw, dh=sh;
    if(a.length === 2){ dx=a[0]; dy=a[1]; }
    else if(a.length === 4){ dx=a[0]; dy=a[1]; dw=a[2]; dh=a[3]; }
    else if(a.length === 8){ sx=a[0]; sy=a[1]; sw=a[2]; sh=a[3]; dx=a[4]; dy=a[5]; dw=a[6]; dh=a[7]; }
    this.calls.drawImage.push({dx,dy,dw,dh,sw,sh,src:[src.width,src.height]});
    for(let j=0;j<dh;j++) for(let i=0;i<dw;i++){
      const tx = Math.round(dx+i), ty = Math.round(dy+j);
      if(tx<0||ty<0||tx>=cv.width||ty>=cv.height) continue;
      const u = Math.min(src.width-1,  sx + Math.min(sw-1, Math.floor((i+0.5)*sw/dw)));
      const v = Math.min(src.height-1, sy + Math.min(sh-1, Math.floor((j+0.5)*sh/dh)));
      const si = (v*src.width+u)*4, di = (ty*cv.width+tx)*4;
      cv.buf[di]=src.buf[si]; cv.buf[di+1]=src.buf[si+1]; cv.buf[di+2]=src.buf[si+2]; cv.buf[di+3]=src.buf[si+3];
    }
  }
  clearRect(x,y,w,h){ this.calls.fillRect++; for(let j=0;j<h;j++) for(let i=0;i<w;i++){ const di=((y+j)*this.canvas.width+(x+i))*4; this.canvas.buf[di]=this.canvas.buf[di+1]=this.canvas.buf[di+2]=this.canvas.buf[di+3]=0; } }
  fillRect(){ this.calls.fillRect++; }
  fillText(){ this.calls.fillText++; }
  stroke(){ this.calls.stroke++; }
  arc(){ this.calls.arc++; }
  save(){ this.calls.save++; } restore(){} translate(){} rotate(){} scale(){}
  setTransform(){} resetTransform(){}
  beginPath(){} moveTo(){} lineTo(){} arcTo(){} rect(){} ellipse(){} closePath(){}
  quadraticCurveTo(){} bezierCurveTo(){} clip(){} strokeRect(){} setLineDash(){} fill(){}
  measureText(t){ return {width: String(t).length*12}; }
  createLinearGradient(){ return {addColorStop(){}}; }
  createRadialGradient(){ return {addColorStop(){}}; }
  createPattern(){ return {}; }
}

/* 可记录子节点的容器（用于角色胶囊） */
class Box {
  constructor(){ this.children = []; this.style={}; this.dataset={}; this.className='';
    this.textContent=''; this.innerHTML=''; this.title=''; this._cls = new Set();
    this.classList = {
      toggle:(c,on)=>{ if(on===undefined) { this._cls.has(c)?this._cls.delete(c):this._cls.add(c); } else if(on) this._cls.add(c); else this._cls.delete(c); },
      add:c=>this._cls.add(c), remove:c=>this._cls.delete(c), contains:c=>this._cls.has(c)
    };
  }
  get childElementCount(){ return this.children.length; }
  appendChild(c){ this.children.push(c); return c; }
  querySelectorAll(){ return []; } querySelector(){ return null; }
  getBoundingClientRect(){ return {left:0, top:0, width:900, height:420}; }
  addEventListener(){} showModal(){ this.open=true; } close(){ this.open=false; }
}

class El extends Box {
  constructor(id){
    super(); this.id = id;
    this.value='0'; this.checked=false; this.disabled=false; this.files=[];
    this.width=0; this.height=0; this._ctx=null;
  }
  getContext(){ if(!this._ctx){ const c = new Cv(1,1); this._ctx = c.getContext(); this._cv = c; } return this._ctx; }
  setPointerCapture(){}
  click(){ this.onclick && this.onclick(); }
}

const store = {};
const getEl = (id)=>{
  if(!store[id]) store[id] = new El(id);
  return store[id];
};

const CURSOR = new Cv(900, 420);
CURSOR.parentElement = { getBoundingClientRect: ()=>({width:900, height:420}) };
const CURCTX = CURSOR.getContext();
store['twCv'] = CURSOR;

const sandbox = {
  console, Math, JSON, Date, parseInt, parseFloat, Number, String, Array, Object, Boolean,
  Float32Array, Uint8Array, Uint8ClampedArray, Uint32Array, Int32Array, DataView, ArrayBuffer,
  TextEncoder, Blob, isNaN, Infinity, NaN, undefined, Promise,
  ImageData: class { constructor(a,b,c){
    if(typeof a === 'number'){ this.width=a; this.height=b; this.data=new Uint8ClampedArray(a*b*4); }
    else { this.data=a; this.width=b; this.height=c; }
  }},
  setTimeout: ()=>0, clearTimeout: ()=>{},
  requestAnimationFrame: (fn)=>{ sandbox.__raf = fn; return 1; },
  cancelAnimationFrame: ()=>{ sandbox.__raf = null; },
  performance: { now: ()=> sandbox.__now || 0 },
  URL: {createObjectURL:()=>'blob:x', revokeObjectURL:()=>{}},
  Image: function(){ return new El('img'); },
  createImageBitmap: async ()=>new Cv(1,1),
  alert: ()=>{}, confirm: ()=>true, prompt: ()=>null,
  devicePixelRatio: 1, innerWidth: 1400, innerHeight: 900,
  document: {
    getElementById: (id)=>getEl(id),
    querySelector: (s)=>{
      if(s.startsWith('#')) return getEl(s.slice(1));
      return getEl(s);
    },
    querySelectorAll: (s)=>{
      if(s === '#twRoles .twRole') return getEl('twRoles').children;
      return [];
    },
    createElement: (t)=> t==='canvas' ? new Cv(32,32) : new El('new'),
    addEventListener(){}, body:{classList:{toggle(){},add(){},remove(){}}}
  },
  addEventListener(){}, removeEventListener(){}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.globalThis.devicePixelRatio = 1;
vm.createContext(sandbox);

const html = fs.readFileSync('../指针工坊.html','utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
try{
  vm.runInContext(src, sandbox, {filename:'ptr_tryon.js'});
  console.log('LOAD OK');
}catch(err){
  console.error('LOAD FAIL:', err.message, '\n', err.stack.split('\n').slice(0,6).join('\n'));
  process.exit(1);
}

let pass = 0, fail = 0;
const T = (name, cond, extra='') => {
  if(cond){ pass++; console.log('PASS', name, extra); }
  else { fail++; console.log('FAIL', name, extra); }
};
const run = (code)=>vm.runInContext(code, sandbox);

/* ---------- 0. 造一个作品：64×64 红色圆 + 热点 ---------- */
run(`
  D.layers = [];
  const g = D.base.getContext('2d');
  for(let y=0;y<64;y++) for(let x=0;x<64;x++){
    const d = Math.hypot(x-31.5, y-31.5);
    const i = (y*64+x)*4;
    if(d < 26){ D.base.buf[i]=220; D.base.buf[i+1]=40; D.base.buf[i+2]=40; D.base.buf[i+3]=255; }
  }
  D.hotspot = {x:12, y:18};
`);

/* ---------- 1. 打开 / 关闭 ---------- */
run(`openTryOn()`);
T('开窗后 TW.open', run(`TW.open`) === true);
T('空作品提示：有作品时隐藏', getEl('twEmpty').style.display === 'none');
T('已排入一帧动画循环', typeof sandbox.__raf === 'function');

/* ---------- 2. 首帧绘制：画布按 DPR 定尺 ---------- */
run(`twDraw(16)`);
T('画布尺寸=900×420', CURSOR.width === 900 && CURSOR.height === 420, `got ${CURSOR.width}×${CURSOR.height}`);
T('场景有填充绘制', CURCTX.calls.fillRect > 3, `fillRect=${CURCTX.calls.fillRect}`);
T('场景有文字', CURCTX.calls.fillText >= 9, `fillText=${CURCTX.calls.fillText}`);
/* 四种背景都要能画 */
['desk','doc','dark','checker'].forEach(mode=>{
  const before = CURCTX.calls.fillRect;
  run(`TW.bg='${mode}'; twDraw(16)`);
  T('背景「' + mode + '」可正常绘制', CURCTX.calls.fillRect > before, `+${CURCTX.calls.fillRect-before}`);
});
run(`TW.bg='desk'; twDraw(16)`);

/* ---------- 3. 指针本体绘制尺寸 = 尺寸 × 放大 ---------- */
const lastDraw = ()=>{
  const a = CURCTX.calls.drawImage.filter(d=>d.dw === d.dh && d.dw >= 8);
  return a[a.length-1];
};
let d0 = lastDraw();
T('48px × 2 放大 → 绘制 96×96', d0 && d0.dw === 96 && d0.dh === 96, d0 ? `${d0.dw}×${d0.dh}` : 'none');
const px0 = run(`TW.fx`), py0 = run(`TW.fy`);
T('绘制原点 = 光标 - 热点', Math.abs(d0.dx - (px0 - 12.5/64*96)) < 0.01 && Math.abs(d0.dy - (py0 - 18.5/64*96)) < 0.01,
  `dx=${d0.dx.toFixed(2)} dy=${d0.dy.toFixed(2)}`);

/* ---------- 4. 命中测试 ---------- */
const regions = run(`(function(){
  const c = document.createElement('canvas'); c.width=900; c.height=420;
  return twScene(900,420,c.getContext('2d')).map(r=>({x:r.x,y:r.y,w:r.w,h:r.h,role:r.role}));
})()`);
const G = run(`TW.geo`);
const at = (x,y)=>run(`twRoleAt(${x},${y},${JSON.stringify(regions).replace(/"/g,'\\"')})`);
const roleAt = (x,y)=>{
  for(const r of regions) if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h) return r.role;
  return 'Arrow';
};
T('正文 → IBeam', roleAt(G.bx+120, G.by+40) === 'IBeam', roleAt(G.bx+120, G.by+40));
T('按钮 → Hand', roleAt(G.btnX+20, G.btnY+10) === 'Hand', roleAt(G.btnX+20, G.btnY+10));
T('窗口右边缘 → SizeWE', roleAt(G.wx+G.ww-2, G.wy+80) === 'SizeWE', roleAt(G.wx+G.ww-2, G.wy+80));
T('窗口下边缘 → SizeNS', roleAt(G.wx+200, G.wy+G.wh-2) === 'SizeNS', roleAt(G.wx+200, G.wy+G.wh-2));
T('右下角 → SizeNWSE', roleAt(G.wx+G.ww-3, G.wy+G.wh-3) === 'SizeNWSE', roleAt(G.wx+G.ww-3, G.wy+G.wh-3));
T('桌面空白 → Arrow', roleAt(6, 6) === 'Arrow', roleAt(6,6));

/* 真实函数口径一致 */
const atReal = (x,y)=>run(`twRoleAt(${x},${y},${'regions'})`);
run(`globalThis.regions = ${JSON.stringify(regions)}`);
T('真实 twRoleAt 与几何一致（正文）', run(`twRoleAt(${G.bx+120},${G.by+40},regions)`) === 'IBeam');
T('真实 twRoleAt（按钮）', run(`twRoleAt(${G.btnX+20},${G.btnY+10},regions)`) === 'Hand');

/* ---------- 5. 自动 / 锁定角色影响状态栏 ---------- */
run(`TW.role='auto'; TW.inside=true; TW.fx=${G.bx+120}; TW.fy=${G.by+40}; twDraw(16)`);
T('自动模式下状态栏显示文本选择', /文本选择/.test(getEl('twInfo').innerHTML), getEl('twInfo').innerHTML.slice(0,60));
run(`TW.role='Wait'; twDraw(16)`);
T('锁定忙碌后状态栏跟着变', /忙碌/.test(getEl('twInfo').innerHTML), getEl('twInfo').innerHTML.slice(0,60));
run(`TW.role='auto'; TW.inside=false`);

/* ---------- 6. 尺寸切换 ---------- */
run(`TW.size=96; TW.iconFor=''; twDraw(16)`);
d0 = lastDraw();
T('切到 96px 后绘制 192×192', d0.dw === 192, `${d0.dw}`);
run(`TW.scale=1; twDraw(16)`);
d0 = lastDraw();
T('1× 放大时绘制 96×96', d0.dw === 96, `${d0.dw}`);
run(`TW.size=48; TW.scale=2; TW.iconFor=''; twDraw(16)`);

/* ---------- 7. 帧动画推进 ---------- */
run(`
  frames = [];
  for(let k=0;k<3;k++){
    const c = document.createElement('canvas'); c.width=c.height=64;
    for(let i=0;i<64*64;i++){ c.buf[i*4]=200; c.buf[i*4+1]=40+k*60; c.buf[i*4+2]=40; c.buf[i*4+3]=255; }
    frames.push({cv:c, ms:100});
  }
  TW.iconFor=''; TW.fi=0; TW.acc=0; twBuildIcons();
`);
T('3 帧各生成一张图标', run(`TW.list.length`) === 3, `len=${run(`TW.list.length`)}`);
run(`TW.fi=0; TW.acc=0; twDraw(50)`);
T('50ms 未到 100ms，帧号不动', run(`TW.fi`) === 0, `fi=${run(`TW.fi`)}`);
run(`twDraw(60)`);
T('累计 110ms 后进到第 2 帧', run(`TW.fi`) === 1, `fi=${run(`TW.fi`)}`);
run(`twDraw(100); twDraw(100)`);
T('循环回绕到第 1 帧', run(`TW.fi`) === 0, `fi=${run(`TW.fi`)}`);
T('多帧时状态栏提示帧数', /3 帧循环/.test(getEl('twInfo').innerHTML), getEl('twInfo').innerHTML.slice(-30));

/* ---------- 8. 演示路径在动 ---------- */
run(`TW.inside=false; TW.demo=true; TW.t=0;`);
const p1 = run(`(function(){ const p = twDemoPos(0,900,420); return [p.x,p.y]; })()`);
const p2 = run(`(function(){ const p = twDemoPos(700,900,420); return [p.x,p.y]; })()`);
T('示范路径随时间移动', Math.abs(p1[0]-p2[0]) + Math.abs(p1[1]-p2[1]) > 4,
  `${p1.map(v=>v.toFixed(1))} → ${p2.map(v=>v.toFixed(1))}`);

/* 走完一整圈，看是否真的演示到各类角色，且不出画布 */
const sweep = run(`(function(){
  const out = []; TW.t = 0; TW.demo = true;
  for(let i=0;i<340;i++){
    const p = twDemoPos(50, 900, 420);
    out.push([Math.round(p.x), Math.round(p.y)]);
  }
  return out;
})()`);
T('示范路径不出画布', sweep.every(([x,y])=> x>=0 && x<=900 && y>=0 && y<=420),
  JSON.stringify(sweep.filter(([x,y])=> x<0||x>900||y<0||y>420).slice(0,3)));
const seenRoles = new Set(sweep.map(([x,y])=>roleAt(x,y)));
['IBeam','Hand','SizeNWSE','SizeWE','Arrow'].forEach(r=>{
  T('示范覆盖角色 ' + r, seenRoles.has(r), [...seenRoles].join('/'));
});

/* ---------- 9. 角色胶囊 ---------- */
run(`TW.role='auto'; twBuildChips(); twSyncChips();`);
const chips = getEl('twRoles').children;
T('胶囊数 = 1 自动 + 17 角色', chips.length === 18, `got ${chips.length}`);
T('第一个是自动', chips[0].dataset.role === 'auto' && /自动/.test(chips[0].textContent));
T('包含 17 个角色键', ['Arrow','Help','AppStarting','Wait','Crosshair','IBeam','NWPen','No',
  'SizeNS','SizeWE','SizeNWSE','SizeNESW','SizeAll','UpArrow','Hand','Pin','Person']
  .every(k=>chips.some(c=>c.dataset.role === k)));
T('当前项高亮', chips[0]._cls.has('on'));

/* ---------- 10. 关闭 ---------- */
run(`closeTryOn()`);
T('关闭后 TW.open=false', run(`TW.open`) === false);
T('关闭后取消动画帧', sandbox.__raf === null);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
