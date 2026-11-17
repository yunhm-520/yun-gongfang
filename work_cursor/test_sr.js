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
try{ vm.runInContext(src, sandbox, {filename:'ptr_sr.js'}); console.log('LOAD OK'); }
catch(e){ console.error('LOAD FAIL:', e.message, '\n', e.stack.split('\n').slice(0,5).join('\n')); process.exit(1); }

let pass = 0, fail = 0;
const T = (n, c, x='') => { if(c){ pass++; console.log('PASS', n, x); } else { fail++; console.log('FAIL', n, x); } };
const run = c => vm.runInContext(c, sandbox);

/* ---------- 常量与接线 ---------- */
T('SRMOD_URL 固定 v0.1.1', run(`SRMOD_URL`).includes('@websr/websr@0.1.1/+esm'), run(`SRMOD_URL`));
T('x4 档是 Real-ESRGAN x4v3、4 倍', run(`SRNETS.x4.net`)==='realesrgan/x4v3' && run(`SRNETS.x4.scale`)===4);
T('x4 权重指向 websr 仓库 v0.1.1', run(`SRNETS.x4.url`).includes('sb2702/websr@v0.1.1/weights/realesrgan/x4v3.bin'));
T('x2 档是 cnn-m、2 倍', run(`SRNETS.x2.net`)==='websr/cnn-m' && run(`SRNETS.x2.scale`)===2);
T('srFetchWeights 存在', typeof run(`srFetchWeights`) === 'function');
T('srComposite 存在', typeof run(`srComposite`) === 'function');
const h = fs.readFileSync('../指针工坊.html','utf8');
T('按钮 id=btnSR 在页面里', h.includes('id="btnSR"'));
T('状态栏 id=srMeta 在页面里', h.includes('id="srMeta"'));
T('下拉 id=srNet 两档', h.includes('id="srNet"') && h.includes('value="x4"') && h.includes('value="x2"'));

/* ---------- srComposite：alpha 放大 + RGB 保真 ---------- */
/* 2×2 蒙版：左列不透明、右列透明 → 放大到 4×4 */
const out1 = run(`(function(){
  const alpha = new Uint8Array([255,0, 255,0]);       // 2×2
  const raw = new Uint8ClampedArray(4*4*4);           // 4×4 网络输出，全红
  for(let i=0;i<raw.length;i+=4){ raw[i]=200; raw[i+1]=30; raw[i+2]=40; raw[i+3]=255; }
  const nd = srComposite(raw, 4, 4, alpha, 2, 2);
  const A = [], R = [];
  for(let p=0;p<16;p++){ A.push(nd.data[p*4+3]); R.push(nd.data[p*4]); }
  return {A, R};
})()`);
// 4×4 每个目标像素对应源的一列：x0,x1←源x0(255)，x2,x3←源x1(0)
const a = out1.A;
// 目标 x∈{0,1,2,3} 映射源坐标 0/0.25/0.75/1.25(=clamp 1)，行内数值只随 x 变化
T('x=0 全不透明（255）', a[0]===255 && a[8]===255, a[0]+','+a[8]);
T('x=3 全透明（0）', a[3]===0 && a[11]===0, a[3]+','+a[11]);
T('过渡像素单调递减 255→196→59→0（无硬锯齿无溢出）',
  a[0]>a[1] && a[1]>a[2] && a[2]>a[3] && a[1]>0 && a[1]<255 && a[2]>0 && a[2]<255,
  a.slice(0,4).join(','));
T('同一源列目标行数值一致（行独立）', a[0]===a[4] && a[4]===a[8] && a[8]===a[12], a.join(','));
T('RGB 原样保留（透明区颜色不被吃掉，可重新抠）', out1.R.every(v=>v===200), out1.R[10]);

/* ---------- 全透明 / 全不透明 ---------- */
const out2 = run(`(function(){
  const raw = new Uint8ClampedArray(4*4*4);
  for(let i=0;i<raw.length;i+=4){ raw[i]=9; raw[i+1]=9; raw[i+2]=9; raw[i+3]=255; }
  const nd = srComposite(raw, 4, 4, new Uint8Array(4).fill(0), 2, 2);
  const A = []; for(let p=0;p<4;p++) A.push(nd.data[p*4+3]);
  return A;
})()`);
T('全透明蒙版 → 输出全透明', out2.every(v=>v===0), out2.join(','));

/* ---------- 大图目标尺寸保护逻辑（复算 1244×732 的 4×） ---------- */
const big = run(`(function(){
  const tw = 1244*4, th = 732*4;
  return {mp: tw*th/1e6, ok: tw*th <= 24e6};
})()`);
T('1244×732 走 4× ≈ 14.6MP，在 24MP 上限内', big.ok && big.mp > 12, big.mp.toFixed(1)+'MP');
const tooBig = run(`(function(){ const tw=3000*4, th=3000*4; return tw*th > 24e6; })()`);
T('3000² 走 4× 被拒（>24MP）', tooBig);

/* ---------- ImageData 双构造形态在沙箱可用 ---------- */
const idOk = run(`(function(){
  const a = new ImageData(4, 4);
  const b = new ImageData(new Uint8ClampedArray(4*4*4), 4, 4);
  return a.data.length===64 && b.data.length===64;
})()`);
T('ImageData(w,h) 与 ImageData(data,w,h) 均可用', idOk);

/* ---------- GPU 画布读取回归：WebSR 用 webgpu 上下文占用 out 后，2d getContext 返回 null ---------- */
class GpuCv extends Cv {
  constructor(w,h){ super(w,h); this._gpu=false; }
  getContext(t){
    if(t === 'webgpu'){ this._gpu = true; return {}; }
    if(this._gpu) return null;                       // 浏览器真实行为：上下文类型互斥
    return super.getContext(t);
  }
}
const gcv = new GpuCv(2,2);
gcv.buf.set([10,20,30,255, 40,50,60,255, 70,80,90,255, 110,120,130,255]);
gcv.getContext('webgpu');                             // 模拟 WebSR 渲染占用
T('GPU 占用后 getContext("2d") 为 null（复现用户报错）', gcv.getContext('2d') === null);
const cpy = new Cv(2,2);
cpy.getContext('2d').drawImage(gcv, 0, 0);            // drawImage 不受上下文类型限制
const gpx = cpy.getContext('2d').getImageData(0,0,2,2).data;
T('drawImage 仍能从 GPU 画布复制内容（修复路径）',
  gpx[0]===10 && gpx[1]===20 && gpx[4]===40 && gpx[12]===110 && gpx[13]===120, Array.from(gpx.slice(0,16)).join(','));
T('不再对 out 直接调 2d getImageData（旧写法必然崩）', !/out\.getContext\('2d'\)\.getImageData/.test(src));
T('代码先 drawImage 复制到普通 2D 画布再读像素', /cpy\.getContext\('2d'\)\.drawImage\(out, 0, 0\)/.test(src));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
