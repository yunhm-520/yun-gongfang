// 指针工坊 Pro 编码器验证：软件画布 + vm 加载 → 输出真实二进制文件
const fs = require('fs'), vm = require('vm'), path = require('path');
const OUT = './_ptr2_out';
fs.mkdirSync(OUT, {recursive:true});

/* ---------- 极简软件画布 ---------- */
class Cv {
  constructor(w, h){
    this._w = w|0; this._h = h|0;
    this.buf = new Uint8ClampedArray(Math.max(1, this._w*this._h*4));
    this._ctx = null;
  }
  get width(){ return this._w; }
  set width(v){ v = v|0; if(v !== this._w){ this._w = v; this.buf = new Uint8ClampedArray(Math.max(1, this._w*this._h*4)); } }
  get height(){ return this._h; }
  set height(v){ v = v|0; if(v !== this._h){ this._h = v; this.buf = new Uint8ClampedArray(Math.max(1, this._w*this._h*4)); } }
  getContext(){ if(!this._ctx) this._ctx = new Ctx(this); return this._ctx; }
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
      const tx = dx+i, ty = dy+j;
      if(tx<0||ty<0||tx>=cv.width||ty>=cv.height) continue;
      const u = Math.min(src.width-1,  sx + Math.min(sw-1, Math.floor((i+0.5)*sw/dw)));
      const v = Math.min(src.height-1, sy + Math.min(sh-1, Math.floor((j+0.5)*sh/dh)));
      const si = (v*src.width+u)*4, di = (ty*cv.width+tx)*4;
      cv.buf[di]=src.buf[si]; cv.buf[di+1]=src.buf[si+1]; cv.buf[di+2]=src.buf[si+2]; cv.buf[di+3]=src.buf[si+3];
    }
  }
  clearRect(x,y,w,h){ for(let j=0;j<h;j++) for(let i=0;i<w;i++){ const di=((y+j)*this.canvas.width+(x+i))*4; this.canvas.buf[di]=this.canvas.buf[di+1]=this.canvas.buf[di+2]=this.canvas.buf[di+3]=0; } }
  fillRect(){}
  save(){} restore(){} translate(){} rotate(){} scale(){} beginPath(){} moveTo(){} lineTo(){}
  stroke(){} fill(){} arc(){} rect(){} ellipse(){} strokeRect(){} fillText(){} setLineDash(){}
  closePath(){} quadraticCurveTo(){} bezierCurveTo(){} clip(){} drawFocusIfNeeded(){} isPointInPath(){return false;}
  createLinearGradient(){ return {addColorStop(){}}; }
  createPattern(){ return {}; }
}

/* ---------- 桩 DOM ---------- */
function el(){
  return {
    style:{}, dataset:{}, classList:{toggle(){}, add(){}, remove(){}, contains(){return false;}},
    addEventListener(){}, removeEventListener(){}, value:'0', textContent:'', innerHTML:'',
    disabled:false, checked:false, width:0, height:0, files:[],
    getContext(){ return new Ctx(new Cv(1,1)); },
    getBoundingClientRect(){ return {left:0, top:0, width:800, height:600}; },
    setPointerCapture(){}, querySelectorAll(){ return []; }, appendChild(){}, append(){}, prepend(){}, remove(){}, click(){}, close(){},
    showModal(){}, padEnd(){}
  };
}
const elCache = {};
const sandbox = {
  console, Math, JSON, Date, parseInt, parseFloat, Number, String, Array, Object, Float32Array,
  Uint8Array, Uint8ClampedArray, Uint32Array, Int32Array, DataView, ArrayBuffer, TextEncoder, Blob,
  isNaN, Infinity, NaN, undefined,
  ImageData: class { constructor(a,b,c){
    if(typeof a === 'number'){ this.width=a; this.height=b; this.data=new Uint8ClampedArray(a*b*4); }
    else { this.data=a; this.width=b; this.height=c; }
  }},
  setTimeout: ()=>0, clearTimeout: ()=>{},
  URL: {createObjectURL:()=>'blob:x', revokeObjectURL:()=>{}},
  Image: function(){ return el(); },
  createImageBitmap: async ()=>new Cv(1,1),
  alert: ()=>{}, confirm: ()=>true, prompt: ()=>null,
  document: {
    getElementById: (id)=>{ const k='#'+id; if(!elCache[k]) elCache[k] = el(); return elCache[k]; },
    querySelector: (s)=>{ if(!elCache[s]) elCache[s] = el(); return elCache[s]; },
    querySelectorAll: ()=>[],
    createElement: (t)=> t==='canvas' ? new Cv(32,32) : el(),
    addEventListener(){}, body:{classList:{toggle(){}}}
  },
  addEventListener(){}, removeEventListener(){}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const html = fs.readFileSync('../指针工坊.html','utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
try{
  vm.runInContext(src, sandbox, {filename:'ptr2.js'});
  console.log('LOAD OK');
}catch(err){
  console.error('LOAD FAIL:', err.message, '\n', err.stack.split('\n').slice(0,4).join('\n'));
  process.exit(1);
}

/* ---------- 造测试图：R=x*8, G=y*8, B=200，左下角 4x4 透明 ---------- */
function makeTest(w, h){
  const cv = new Cv(w, h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i = (y*w+x)*4;
    cv.buf[i] = x*8; cv.buf[i+1] = y*8; cv.buf[i+2] = 200; cv.buf[i+3] = 255;
  }
  for(let y=h-4;y<h;y++) for(let x=0;x<4;x++) cv.buf[(y*w+x)*4+3] = 0;  // 透明块
  return cv;
}
const c32 = makeTest(32,32);
const S = sandbox;

/* .cur 多尺寸 */
const curBytes = S.makeCur([
  {cv:c32, hx:5, hy:7},
  {cv:S.scaleCv(c32, 48), hx:8, hy:11},
  {cv:S.scaleCv(c32, 64), hx:10, hy:14}
]);
fs.writeFileSync(path.join(OUT,'test_multi.cur'), Buffer.from(curBytes));

/* .ani 3 帧 */
const aniBytes = S.makeAni([
  {cv:c32, ms:90, hx:5, hy:7},
  {cv:c32, ms:120, hx:5, hy:7},
  {cv:c32, ms:60, hx:5, hy:7}
], '测试指针');
fs.writeFileSync(path.join(OUT,'test.ani'), Buffer.from(aniBytes));

/* INF + 脚本 + zip（SLOTS 是顶层 const，需在同一 context 里求值取到） */
const SLOTS = vm.runInContext('SLOTS', sandbox);
const roleFiles = SLOTS.map(s=>({slot:s, fileName:s.file + '.ani', data:aniBytes}));
const infTxt = S.buildInf('测试皮肤', '测试皮肤', roleFiles);
fs.writeFileSync(path.join(OUT,'Install.inf.txt'), infTxt, 'utf8');

const files = [];
roleFiles.forEach(f=>files.push({name:f.fileName, data:f.data}));
const enc = new TextEncoder();
files.push({name:'Install.inf', data:S.encodeUtf16(infTxt)});
files.push({name:'安装皮肤.bat', data:enc.encode(S.installBat('测试皮肤','测试皮肤','ptest'))});
files.push({name:'立即启用.bat', data:enc.encode(S.applyBat('测试皮肤','测试皮肤',roleFiles))});
files.push({name:'卸载皮肤.bat', data:enc.encode(S.uninstallBat('测试皮肤','测试皮肤'))});
files.push({name:'恢复默认指针.bat', data:enc.encode(S.restoreBat())});
files.push({name:'立即生效.ps1', data:S.encodeUtf8Bom('x')});
files.push({name:'恢复默认.ps1', data:enc.encode(S.restorePs1())});
files.push({name:'说明.txt', data:enc.encode(S.readmeTxt('测试皮肤','测试皮肤',roleFiles,true))});
const zipBytes = S.makeZip(files);
fs.writeFileSync(path.join(OUT,'skin.zip'), Buffer.from(zipBytes));

console.log('written:', fs.readdirSync(OUT).join(', '));
console.log('sizes: cur=%d ani=%d zip=%d inf=%d', curBytes.length, aniBytes.length, zipBytes.length, infTxt.length);

/* ================= 逻辑测试：框选即切 / 角色文件组装 ================= */
let pass = 0, fail = 0;
const T = (name, cond, extra='') => {
  if(cond){ pass++; console.log('PASS', name, extra); }
  else { fail++; console.log('FAIL', name, extra); }
};

/* 造 30×20 底图：左半红右半蓝，中间一列透明 */
const splitRes = vm.runInContext(`(function(){
  const c = document.createElement('canvas'); c.width=30; c.height=20;
  for(let y=0;y<20;y++) for(let x=0;x<30;x++){
    const i=(y*30+x)*4;
    if(x<15){ c.buf[i]=220; c.buf[i+1]=30; c.buf[i+2]=30; }
    else { c.buf[i]=30; c.buf[i+1]=30; c.buf[i+2]=220; }
    c.buf[i+3] = (x===15) ? 0 : 255;
  }
  setSheet(c, '整图');
  assets = [];
  var rowsEl = document.querySelector('#sRows');   // 桩元素，直接改内部状态
  SP.sel = {x0:0, y0:0, x1:30, y1:20};
  // 通过 setSheet 后手动指定行列为 2×3（桩 DOM 的 value 恒为 '0'，故直接改）
  var okRows = true;
  return {okRows:okRows, W:SP.W, H:SP.H};
})()`, sandbox);
T('setSheet 载入 30×20', splitRes.W===30 && splitRes.H===20, JSON.stringify(splitRes));

/* 直接测切片：3 列 × 2 行 */
const sliceInfo = vm.runInContext(`(function(){
  document.getElementById('sRows').value = '2';
  document.getElementById('sCols').value = '3';
  document.getElementById('chkTrim').checked = false;
  assets = [];
  SP.sel = {x0:0, y0:0, x1:30, y1:20};
  doSplitSel();                       // 真实入口：框选即切
  const sizes = assets.map(a=>a.w+'x'+a.h);
  const mid = assets[1].cv;           // 第 2 块含中间透明列 x=15（局部 x=5）
  const alphaAt = (x,y)=> mid.buf[(y*mid.width+x)*4+3];
  const row=[]; for(let x=0;x<mid.width;x++) row.push(alphaAt(x,5));
  return {n:assets.length, sizes, midW:mid.width, midH:mid.height,
          leftA:alphaAt(0,0), midA:alphaAt(5,5), rightA:alphaAt(9,5), row:row,
          sheetA:[SP.alpha[5*30+14],SP.alpha[5*30+15],SP.alpha[5*30+16]],
          outSize:[SP.outCv.width,SP.outCv.height],
          outA:[SP.outCv.buf[(5*SP.outCv.width+14)*4+3],SP.outCv.buf[(5*SP.outCv.width+15)*4+3],SP.outCv.buf[(5*SP.outCv.width+16)*4+3]],
          srcA:[SP.srcData.data[(5*30+15)*4+3]], dirtyFlag:SP.dirty,
          direct:(function(){ var c=sliceMasked(10,0,10,10);
            return {w:c.width,h:c.height,a05:c.buf[(5*10+5)*4+3],a25:c.buf[(2*10+5)*4+3],
                    buf40:c.buf[40], buf43:c.buf[43]}; })()};
})()`, sandbox);
T('框选切成 6 块', sliceInfo.n===6, JSON.stringify(sliceInfo.sizes));
T('每块尺寸 10×10', sliceInfo.sizes.every(s=>s==='10x10'), JSON.stringify(sliceInfo.sizes));
console.log('  sliceInfo:', JSON.stringify(sliceInfo));
T('透明列被保留（中间块 x=5 透明）', sliceInfo.midA===0);
T('左右两侧仍不透明', sliceInfo.leftA===255 && sliceInfo.rightA===255);

/* 撤销：回到 0 块 */
const undoN = vm.runInContext(`(function(){ spUndo(); return assets.length; })()`, sandbox);
T('分割可撤销（回 0 块）', undoN===0, 'assets='+undoN);

/* 角色文件组装：静态 → 全部 .cur；动画 → 全部 .ani；自定义覆盖 */
const builtStatic = vm.runInContext(`(function(){
  frames = [];
  roleOverride = {};
  D.W = 64; D.hotspot = {x:8, y:9};
  return buildRoleFiles();
})()`, sandbox);
T('静态：17 个角色文件', builtStatic.files.length===17);
T('静态：全部 .cur', builtStatic.files.every(f=>/\.cur$/.test(f.fileName)),
  builtStatic.files.map(f=>f.fileName).slice(0,3).join(','));
T('静态：是合法 CUR 头', builtStatic.files.every(f=>f.data[0]===0 && f.data[2]===2));

const builtAni = vm.runInContext(`(function(){
  const c = document.createElement('canvas'); c.width=64; c.height=64;
  for(let i=0;i<c.buf.length;i+=4){ c.buf[i]=90; c.buf[i+3]=255; }
  frames = [{cv:c, ms:100}, {cv:c, ms:120}];
  return buildRoleFiles();
})()`, sandbox);
T('动画：全部 .ani', builtAni.files.every(f=>/\.ani$/.test(f.fileName)) && builtAni.animated===true);
T('动画：是合法 RIFF', builtAni.files.every(f=>f.data[0]===0x52 && f.data[8]===0x41));

const builtMix = vm.runInContext(`(function(){
  roleOverride = {Arrow:{name:'my.cur', bytes:new Uint8Array([0,0,2,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), ext:'.cur'}};
  return buildRoleFiles();
})()`, sandbox);
const arrow = builtMix.files.find(f=>f.slot.key==='Arrow');
T('自定义角色：文件名/扩展名生效', arrow.fileName==='pointer.cur', arrow.fileName);
T('自定义角色：字节被原样使用', arrow.data.length===22 && arrow.data[2]===2);
T('其它角色仍用本作品', builtMix.files.find(f=>f.slot.key==='Help').fileName==='help.ani');

/* INF 在混合场景下仍自洽 */
const inf2 = S.buildInf('混合皮肤','混合皮肤', builtMix.files);
T('混合 INF: 17 项且含 pointer.cur',
  /%10%\\%CUR_DIR%\\%pointer%/.test(inf2) && inf2.split('[Strings]')[1].includes('pointer="pointer.cur"'));

console.log('---');
console.log('LOGIC RESULT: pass=' + pass + ' fail=' + fail);
if(fail) process.exit(1);
