// 缩放质量验证：面积平均 / 最近邻 / 画布尺寸建议 / 导出尺寸跟随画布
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
  constructor(cv){ this.canvas = cv; }
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
    for(let j=0;j<dh;j++) for(let i=0;i<dw;i++){
      const tx = Math.round(dx+i), ty = Math.round(dy+j);
      if(tx<0||ty<0||tx>=cv.width||ty>=cv.height) continue;
      const u = Math.min(src.width-1,  sx + Math.min(sw-1, Math.floor((i+0.5)*sw/dw)));
      const v = Math.min(src.height-1, sy + Math.min(sh-1, Math.floor((j+0.5)*sh/dh)));
      const si = (v*src.width+u)*4, di = (ty*cv.width+tx)*4;
      cv.buf[di]=src.buf[si]; cv.buf[di+1]=src.buf[si+1]; cv.buf[di+2]=src.buf[si+2]; cv.buf[di+3]=src.buf[si+3];
    }
  }
  clearRect(x,y,w,h){ for(let j=0;j<h;j++) for(let i=0;i<w;i++){ const di=((y+j)*this.canvas.width+(x+i))*4; this.canvas.buf[di]=this.canvas.buf[di+1]=this.canvas.buf[di+2]=this.canvas.buf[di+3]=0; } }
  fillRect(){} fillText(){} stroke(){} arc(){} save(){} restore(){} translate(){} rotate(){} scale(){}
  setTransform(){} resetTransform(){} beginPath(){} moveTo(){} lineTo(){} arcTo(){} rect(){} ellipse(){}
  closePath(){} quadraticCurveTo(){} bezierCurveTo(){} clip(){} strokeRect(){} setLineDash(){} fill(){}
  measureText(t){ return {width:String(t).length*12}; }
  createLinearGradient(){ return {addColorStop(){}}; }
  createRadialGradient(){ return {addColorStop(){}}; }
  createPattern(){ return {}; }
}
class El {
  constructor(){ this.style={}; this.dataset={}; this.value='0'; this.checked=false; this.disabled=false;
    this.files=[]; this.textContent=''; this.innerHTML=''; this.className=''; this.title='';
    this._cls=new Set();
    this.classList={toggle:(c,on)=>{ if(on) this._cls.add(c); else this._cls.delete(c); },
      add:c=>this._cls.add(c), remove:c=>this._cls.delete(c), contains:c=>this._cls.has(c)};
  }
  addEventListener(){} appendChild(){} querySelectorAll(){ return []; } querySelector(){ return null; }
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
try{ vm.runInContext(src, sandbox, {filename:'ptr_fit.js'}); console.log('LOAD OK'); }
catch(e){ console.error('LOAD FAIL:', e.message, '\n', e.stack.split('\n').slice(0,5).join('\n')); process.exit(1); }

let pass = 0, fail = 0;
const T = (n, c, x='') => { if(c){ pass++; console.log('PASS', n, x); } else { fail++; console.log('FAIL', n, x); } };
const run = c => vm.runInContext(c, sandbox);

/* ---------- 造一张 10×2 的红蓝交替源图 ---------- */
const srcW = run(`(function(){
  const c = document.createElement('canvas'); c.width=10; c.height=2;
  for(let y=0;y<2;y++) for(let x=0;x<10;x++){
    const i=(y*10+x)*4;
    if(x%2===0){ c.buf[i]=220; c.buf[i+1]=40; c.buf[i+2]=40; }
    else { c.buf[i]=40; c.buf[i+1]=80; c.buf[i+2]=220; }
    c.buf[i+3]=255;
  }
  globalThis.SRC = c; return 10;
})()`);

/* ---------- 1. 面积平均：会混出中间色 ---------- */
run(`TW_x = 0`);
const area = run(`(function(){
  const c = areaDown(SRC, 5, 1);
  return [c.buf[0], c.buf[1], c.buf[2], c.buf[3]];
})()`);
T('面积平均 10→5：首像素是红蓝混合（R 在 40~220 之间）', area[0] > 50 && area[0] < 210, `R=${area[0]}`);
T('面积平均保留不透明', area[3] === 255, `A=${area[3]}`);

/* ---------- 2. 最近邻：只有原色，没有中间色 ---------- */
const near = run(`(function(){
  const c = nearDown(SRC, 5, 1);
  return [...c.buf.slice(0,20)];
})()`);
const pureOnly = [0,4,8,12,16].every(i=> (near[i]===220 && near[i+1]===40) || (near[i]===40 && near[i+1]===80));
T('最近邻：5 个像素都是原色（无混合色）', pureOnly, JSON.stringify([0,4,8,12,16].map(i=>near[i])));
T('最近邻取中心像素：第 1 格 = 源 x=1（蓝）', near[0]===40 && near[2]===220, `${near[0]},${near[2]}`);

/* ---------- 3. 透明区不渗色（面积平均的 alpha 加权） ---------- */
const noBleed = run(`(function(){
  const c = document.createElement('canvas'); c.width=8; c.height=8;
  for(let y=0;y<8;y++) for(let x=0;x<8;x++){
    const i=(y*8+x)*4;
    if(x<4){ c.buf[i]=255; c.buf[i+1]=255; c.buf[i+2]=255; c.buf[i+3]=255; }
  }
  const d = areaDown(c, 4, 4);
  // 目标 x=0/1 覆盖源 0-3（不透明），x=2/3 覆盖源 4-7（透明）
  return [d.buf[3], d.buf[7], d.buf[11], d.buf[15]];
})()`);
T('左半不透明白仍在（alpha 255）', noBleed[0]===255 && noBleed[1]===255, `${noBleed[0]}/${noBleed[1]}`);
T('右半全透明区 alpha=0（白边没渗进来）', noBleed[2]===0 && noBleed[3]===0, `${noBleed[2]}/${noBleed[3]}`);

/* ---------- 4. 像素风开关 ---------- */
getEl('pxMode').checked = true;
T('pxModeOn 读得到勾选', run(`pxModeOn()`) === true);
const near2 = run(`(function(){ const c = shrinkTo(SRC,5,1); return [...c.buf.slice(0,20)]; })()`);
T('勾像素风后 shrinkTo 走最近邻', near2.every((v,i)=> i%4===3 || v===near[i]), JSON.stringify(near2.slice(0,8)));
getEl('pxMode').checked = false;
const area2 = run(`(function(){ const c = shrinkTo(SRC,5,1); return [c.buf[0],c.buf[1],c.buf[2]]; })()`);
T('取消像素风后 shrinkTo 走面积平均', area2[0] > 50 && area2[0] < 210, `${area2[0]}`);

/* ---------- 5. fitInto：居中 + 缩小时重采样 ---------- */
const fit = run(`(function(){
  const c = fitInto(SRC, 20, true);
  // 10×2 → 20×20 画布，等比后 20×4，水平铺满、垂直居中（y=8..12）
  const g = c.getContext('2d');
  const mid = g.getImageData(0,10,20,1).data;
  const top = g.getImageData(0,2,20,1).data;
  return [c.width, c.height, mid[3], top[3]];
})()`);
T('fitInto 输出 20×20', fit[0]===20 && fit[1]===20, `${fit[0]}×${fit[1]}`);
T('等比内容在中间行不透明', fit[2] === 255, `A=${fit[2]}`);
T('上下空白透明', fit[3] === 0, `A=${fit[3]}`);

/* ---------- 6. 画布尺寸建议 ---------- */
run(`D.W = 64`);
T('512 源 + 64 画布 → 建议 128', run(`suggestCanvas({width:512,height:512})`) === 128);
T('400×200 源 → 建议 128', run(`suggestCanvas({width:400,height:200})`) === 128);
T('100 源 + 64 画布 → 建议 96', run(`suggestCanvas({width:100,height:100})`) === 96);
T('70 源 → 不建议（比值太小）', run(`suggestCanvas({width:70,height:70})`) === 0);
run(`D.W = 128`);
T('已是 128 画布 → 不再建议', run(`suggestCanvas({width:512,height:512})`) === 0);

/* ---------- 7. 导出尺寸跟随画布 ---------- */
sandbox.__curSizes = [32,48,64,96];
run(`D.W = 256`);
const cs256 = run(`curSizesNow()`);
T('256 画布：自动补 256 尺寸', cs256.includes(256), cs256.join('/'));
run(`D.W = 128`);
const cs128 = run(`curSizesNow()`);
T('128 画布：同样补 128', cs128.includes(128), cs128.join('/'));
run(`D.W = 64`);
const cs64 = run(`curSizesNow()`);
T('64 画布：不额外加尺寸', cs64.join('/') === '32/48/64/96', cs64.join('/'));
sandbox.__curSizes = [];
run(`D.W = 256`);
T('未勾选任何尺寸时回默认三档', run(`curSizesNow()`).join('/') === '48/64/96');

/* ---------- 8. 画布提示 ---------- */
run(`D.W = 64; switchCanvas(64)`);
T('64 画布显示高分屏提示', getEl('cvWarn').style.display === '' && /64px/.test(getEl('cvWarn').textContent));
run(`switchCanvas(128)`);
T('128 画布不再提示', getEl('cvWarn').style.display === 'none');
T('switchCanvas 同步了下拉框与文案', getEl('canvasSize').value === '128' && getEl('cvInfo').textContent === '128 × 128');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
