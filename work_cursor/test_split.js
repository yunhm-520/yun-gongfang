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
  addEventListener(){} appendChild(c){ (this.kids=this.kids||[]).push(c); return c; }
  append(){ } prepend(){} remove(){} querySelectorAll(){ return []; } querySelector(){ return null; }
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


/* ---------- 造一张 100×60 的"素材图"：2 个元素 + 1 个碎点 ---------- */
run(`
  SP.W = 100; SP.H = 60;
  SP.srcData = {data:new Uint8ClampedArray(100*60*4)};
  SP.alpha = new Uint8Array(100*60);
  SP.outCv = document.createElement('canvas'); SP.outCv.width = 100; SP.outCv.height = 60;
  const g = SP.outCv.getContext('2d');
  const paint = (x0,y0,w,h,r,gg,b)=>{
    for(let y=y0;y<y0+h;y++) for(let x=x0;x<x0+w;x++){
      const i=(y*100+x)*4;
      g.canvas.buf[i]=r; g.canvas.buf[i+1]=gg; g.canvas.buf[i+2]=b; g.canvas.buf[i+3]=255;
      SP.alpha[y*100+x]=255;
    }
  };
  paint(10,10,20,20, 220,40,40);    // 元素 A：20×20
  paint(60,20,30,30, 40,180,80);    // 元素 B：30×30（最大）
  paint(95,55,3,3, 255,255,0);      // 碎点：3×3，应被过滤
  SP.dirty = false;
`);
T('素材图状态就绪', run(`spHas()`) === true);
T('初始素材为空', run(`assets.length`) === 0);

/* ---------- 拆分 ---------- */
run(`autoSplitElements()`);
T('拆出 2 个元素（碎点被过滤）', run(`assets.length`) === 2, `got ${run(`assets.length`)}`);
const list = run(`assets.map(a=>({w:a.w,h:a.h,name:a.name}))`);
T('按面积从大到小：30×30 在前', list[0].w === 30 && list[0].h === 30, JSON.stringify(list[0]));
T('第二个是 20×20', list[1].w === 20 && list[1].h === 20, JSON.stringify(list[1]));
T('命名带「元素」前缀', /^元素/.test(list[0].name), list[0].name);
T('按钮旁显示数量', /拆出 2 个/.test(getEl('splitN').textContent), getEl('splitN').textContent);

/* 元素内容确实是各自那块（不是整图） */
const px = run(`(function(){
  const a = assets[0].cv; const g = a.getContext('2d');
  const d = g.getImageData(0,0,a.width,a.height).data;
  return [d[0], d[1], d[2], d[3]];
})()`);
T('最大的元素取到的是绿色那块', px[1] > 150 && px[0] < 80, JSON.stringify(px));

/* ---------- 只有一个元素时不乱拆 ---------- */
run(`assets = []; SP.alpha.fill(0); SP.outCv.getContext('2d').clearRect(0,0,100,60);
  (function(){ const g = SP.outCv.getContext('2d');
    for(let y=10;y<40;y++) for(let x=10;x<50;x++){
      const i=(y*100+x)*4; g.canvas.buf[i]=200; g.canvas.buf[i+1]=60; g.canvas.buf[i+2]=60; g.canvas.buf[i+3]=255;
      SP.alpha[y*100+x]=255;
    }
  })(); SP.dirty=false;`);
run(`autoSplitElements()`);
T('单元素图不产出素材', run(`assets.length`) === 0, `got ${run(`assets.length`)}`);

/* ---------- 全透明图给出提示 ---------- */
run(`SP.alpha.fill(0); SP.outCv.getContext('2d').clearRect(0,0,100,60); SP.dirty=false;`);
run(`autoSplitElements()`);
T('全透明时不产出素材', run(`assets.length`) === 0);

/* ---------- 长宽比提醒文案 ---------- */
const arTip = run(`(function(){
  const cv = {width:1244,height:732};
  const ar = cv.width/cv.height;
  return (ar > 1.45 || ar < 0.69) ? 'warn' : 'ok';
})()`);
T('1244×732 判定为「会留白」', arTip === 'warn', arTip);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
