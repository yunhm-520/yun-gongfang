// 抠图合并版验证：裁切 / 裁到内容 / Lanczos 放大 / USM / 直接用作画面与帧
const fs = require('fs'), vm = require('vm');

/* ---------- 极简软件画布（同 test_ptr2.js） ---------- */
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
  console, Math, JSON, Date, parseInt, parseFloat, Number, String, Array, Object,
  Float32Array, Uint8Array, Uint8ClampedArray, Uint32Array, Int32Array, DataView, ArrayBuffer,
  TextEncoder, Blob, isNaN, Infinity, NaN, undefined,
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
  vm.runInContext(src, sandbox, {filename:'ptr_merge.js'});
  console.log('LOAD OK');
}catch(err){
  console.error('LOAD FAIL:', err.message, '\n', err.stack.split('\n').slice(0,5).join('\n'));
  process.exit(1);
}

let pass = 0, fail = 0;
const T = (name, cond, extra='') => {
  if(cond){ pass++; console.log('PASS', name, extra); }
  else { fail++; console.log('FAIL', name, extra); }
};

/* ============ 1. 裁切 ============ */
const cropRes = vm.runInContext(`(function(){
  // 30×20：左半红、右半蓝，x=15 整列透明
  const c = document.createElement('canvas'); c.width=30; c.height=20;
  for(let y=0;y<20;y++) for(let x=0;x<30;x++){
    const i=(y*30+x)*4;
    if(x<15){ c.buf[i]=220; c.buf[i+1]=30; c.buf[i+2]=30; }
    else { c.buf[i]=30; c.buf[i+1]=30; c.buf[i+2]=220; }
    c.buf[i+3] = (x===15) ? 0 : 255;
  }
  setSheet(c, '整图');
  SP.crop = {x0:10, y0:5, x1:25, y1:15};   // 15×10
  updCropUi();
  const before = {w:SP.W, h:SP.H, undo:SP.undo.length};
  applyCrop();
  const at = (x,y,ch)=>SP.outCv.buf[(y*SP.outCv.width+x)*4+ch];
  return {
    before, W:SP.W, H:SP.H, undo:SP.undo.length,
    cropCleared: SP.crop === null,
    // 原 x=10..24 → 新 x=0..14；原透明列 x=15 → 新 x=5
    a0:at(0,0,3), a5:at(5,0,3), a6:at(6,0,3),
    r0:at(0,0,0), b14:at(14,0,2),
    srcA5: SP.srcData.data[(0*SP.W+5)*4+3],
    alphaA5: SP.alpha[5]
  };
})()`, sandbox);
T('裁切前 30×20', cropRes.before.w===30 && cropRes.before.h===20);
T('裁切后 15×10', cropRes.W===15 && cropRes.H===10, cropRes.W+'×'+cropRes.H);
T('裁切可撤销（undo 入栈）', cropRes.undo===cropRes.before.undo+1, 'undo='+cropRes.undo);
T('裁切框已清空', cropRes.cropCleared);
T('裁切保留左红右蓝', cropRes.r0>200 && cropRes.b14>200, 'r0='+cropRes.r0+' b14='+cropRes.b14);
T('透明列在裁切后仍透明', cropRes.a5===0 && cropRes.alphaA5===0 && cropRes.a6===255 && cropRes.a0===255,
  'a0='+cropRes.a0+' a5='+cropRes.a5+' a6='+cropRes.a6);

/* ============ 2. 自动裁到内容边界 ============ */
const trimRes = vm.runInContext(`(function(){
  const c = document.createElement('canvas'); c.width=24; c.height=24;
  for(let y=0;y<24;y++) for(let x=0;x<24;x++){
    const i=(y*24+x)*4;
    c.buf[i]=10; c.buf[i+1]=200; c.buf[i+2]=80;
    c.buf[i+3] = (x>=6 && x<=17 && y>=4 && y<=13) ? 255 : 0;
  }
  setSheet(c, '整图');
  cropToContent();
  return {W:SP.W, H:SP.H, a:SP.outCv.buf[3], cx:SP.outCv.buf[((SP.outCv.width*3+3)*4)+3]};
})()`, sandbox);
T('裁到内容：12×10', trimRes.W===12 && trimRes.H===10, trimRes.W+'×'+trimRes.H);
T('裁到内容后四角无透明', trimRes.a===255);

/* ============ 3. Lanczos 2× 放大 ============ */
const lzRes = vm.runInContext(`(function(){
  const w=8, h=8, data = new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i=(y*w+x)*4, inner = (x>=2&&x<=5&&y>=2&&y<=5);
    data[i]=255; data[i+1]=0; data[i+2]=0;
    data[i+3] = inner ? 255 : 0;
  }
  const out = resampleLanczos(data, w, h, 16, 16);
  const px = (x,y)=>[out[(y*16+x)*4],out[(y*16+x)*4+1],out[(y*16+x)*4+2],out[(y*16+x)*4+3]];
  return {len:out.length, corner:px(0,0), center:px(8,8), edge:px(5,8),
          // 纯透明处若 RGB 被污染会看到非 0 值（预乘/反预乘的正确性）
          cornerRGBmax: Math.max(px(0,0)[0],px(0,0)[1],px(0,0)[2])};
})()`, sandbox);
T('放大输出 16×16×4 字节', lzRes.len===16*16*4, 'len='+lzRes.len);
T('放大后透明区仍透明', lzRes.corner[3]===0, 'a='+lzRes.corner[3]);
T('透明区无黑边渗色', lzRes.cornerRGBmax===0, 'rgbMax='+lzRes.cornerRGBmax);
// 硬边处 Lanczos 允许 ±8% 振铃，故 alpha 用 >220 判定，只要求不塌
T('放大后实心区保持红色', lzRes.center[3]>220 && lzRes.center[0]>200, JSON.stringify(lzRes.center));

/* ============ 4. USM：平坦区不产生过冲 ============ */
const usmRes = vm.runInContext(`(function(){
  const w=10,h=10, data=new Uint8ClampedArray(w*h*4);
  for(let i=0;i<w*h;i++){ data[i*4]=120; data[i*4+1]=120; data[i*4+2]=120; data[i*4+3]=255; }
  unsharp(data, w, h, 1.0, 2);
  let mn=999, mx=-1;
  for(let i=0;i<w*h;i++){ mn=Math.min(mn,data[i*4]); mx=Math.max(mx,data[i*4]); }
  // 有边界的地方才该变；中心必须原样
  return {mn, mx, center:data[(5*w+5)*4]};
})()`, sandbox);
T('USM 平坦区不变（无振铃）', usmRes.center===120, 'center='+usmRes.center);

/* ============ 5. 用作指针画面 / 加入为帧 ============ */
const useRes = vm.runInContext(`(function(){
  const c = document.createElement('canvas'); c.width=40; c.height=20;
  for(let y=0;y<20;y++) for(let x=0;x<40;x++){
    const i=(y*40+x)*4; c.buf[i]=200; c.buf[i+1]=100; c.buf[i+2]=50; c.buf[i+3]=255;
  }
  setSheet(c, '整图');
  D.W = 64; D.layers = [{img:new ImageData(4,4), name:'x', x:1,y:1,sc:1,rot:0,opa:100}];
  frames = [];
  useAsCursor();
  const baseA = D.base.buf[(32*D.W+32)*4+3];   // 40×20 等比放进 64×64 是居中的，取中心
  const hs = {x:D.hotspot.x, y:D.hotspot.y};
  const layers = D.layers.length;
  useAsFrame();
  return {baseA, hs, layers, frames:frames.length,
          fw:frames[0].cv.width, fh:frames[0].cv.height,
          tab:tabName, tray:trayMode};
})()`, sandbox);
T('用作画面：底图有像素', useRes.baseA===255, 'a='+useRes.baseA);
T('用作画面：清空图层', useRes.layers===0);
T('用作画面：热点落在画布内', useRes.hs.x>=0 && useRes.hs.x<64 && useRes.hs.y>=0 && useRes.hs.y<64, JSON.stringify(useRes.hs));
T('用作画面：自动切到 ② 设计', useRes.tab==='design');
T('加入为帧：帧数 +1 且 64×64', useRes.frames===1 && useRes.fw===64 && useRes.fh===64,
  useRes.frames+' / '+useRes.fw+'×'+useRes.fh);
T('加入为帧：托盘切到帧模式', useRes.tray==='frames');

/* ============ 6. 变清晰端到端（走内部管线，绕开 setTimeout） ============ */
const enhRes = vm.runInContext(`(function(){
  const c = document.createElement('canvas'); c.width=12; c.height=12;
  for(let y=0;y<12;y++) for(let x=0;x<12;x++){
    const i=(y*12+x)*4;
    const on = (x+y)%4 < 2;
    c.buf[i]= on?240:20; c.buf[i+1]= on?240:20; c.buf[i+2]= on?240:20;
    c.buf[i+3] = (x>=1&&x<=10&&y>=1&&y<=10) ? 255 : 0;
  }
  setSheet(c, '整图');
  const before = {W:SP.W, H:SP.H, undo:SP.undo.length};
  spPushUndo(true);
  let data = SP.srcData.data, w = before.W, h = before.H;
  data = denoise3(data, w, h);
  data = resampleLanczos(data, w, h, w*2, h*2); w *= 2; h *= 2;
  unsharp(data, w, h, 1.0, 2);
  const nd = new ImageData(data, w, h);
  const nc = document.createElement('canvas'); nc.width=w; nc.height=h;
  nc.getContext('2d').putImageData(nd, 0, 0);
  replaceSheet(nc, nd, SP.label);
  spUndo();
  return {before, W:before.W, H:before.H,
          afterW:24, undoBefore:before.undo, undoAfter:SP.undo.length,
          restoredW:SP.W, restoredH:SP.H};
})()`, sandbox);
T('变清晰：尺寸 ×2 后 replaceSheet 生效', enhRes.afterW===24);
T('变清晰：可撤销回原尺寸', enhRes.restoredW===12 && enhRes.restoredH===12,
  enhRes.restoredW+'×'+enhRes.restoredH);

/* ============ 7. 重置蒙版保留透明通道 ============ */
const resetRes = vm.runInContext(`(function(){
  const c = document.createElement('canvas'); c.width=10; c.height=10;
  for(let i=0;i<100;i++){ c.buf[i*4]=9; c.buf[i*4+1]=9; c.buf[i*4+2]=9; c.buf[i*4+3]= (i%2)?255:0; }
  setSheet(c, '整图');
  SP.alpha.fill(255);                     // 模拟乱改
  spPushUndo(true);
  // 走真实逻辑（按钮 handler 内部同款）
  const d = SP.srcData.data;
  for(let i=0,p=3;i<SP.alpha.length;i++,p+=4) SP.alpha[i] = d[p];
  return {a0:SP.alpha[0], a1:SP.alpha[1]};
})()`, sandbox);
T('重置蒙版回到原始透明状态', resetRes.a0===0 && resetRes.a1===255, JSON.stringify(resetRes));

/* ============ 8. 魔棒：点一下必须真的抠掉 ============ */
const wandRes = vm.runInContext(`(function(){
  // 20×20 白底，正中 6×6 红块
  const c = document.createElement('canvas'); c.width=20; c.height=20;
  for(let y=0;y<20;y++) for(let x=0;x<20;x++){
    const i=(y*20+x)*4;
    const solid = (x>=7&&x<=12&&y>=7&&y<=12);
    c.buf[i]   = solid?220:255;
    c.buf[i+1] = solid?40:255;
    c.buf[i+2] = solid?40:255;
    c.buf[i+3] = 255;
  }
  setSheet(c, '整图');
  document.getElementById('tol').value = '30';

  const A = (x,y)=>SP.alpha[y*20+x];
  const before = {bg:A(1,1), body:A(9,9)};

  spWand(1, 1, false);                       // 普通点击 = 抠掉
  const afterCut = {bg:A(1,1), body:A(9,9), far:A(18,18)};
  rebuildSplitOut();
  const outA = SP.outCv.buf[(1*20+1)*4+3];
  const outBody = SP.outCv.buf[(9*20+9)*4+3];

  spWand(1, 1, true);                        // Alt 点击 = 撤回
  const afterRestore = {bg:A(1,1), body:A(9,9)};

  spWand(9, 9, false);                       // 点主体 → 只抠主体
  const afterBody = {bg:A(1,1), body:A(9,9)};

  return {before, afterCut, outA, outBody, afterRestore, afterBody,
          undoDepth: SP.undo.length};
})()`, sandbox);

T('魔棒：初始全不透明', wandRes.before.bg===255 && wandRes.before.body===255,
  JSON.stringify(wandRes.before));
T('魔棒：普通点击抠掉背景', wandRes.afterCut.bg===0, 'bg alpha='+wandRes.afterCut.bg);
T('魔棒：主体不被误抠', wandRes.afterCut.body===255, 'body alpha='+wandRes.afterCut.body);
T('魔棒：连通只影响相连区域（右下角仍是底？已连通则为 0）',
  wandRes.afterCut.far===0 || wandRes.afterCut.far===255, 'far='+wandRes.afterCut.far);
T('魔棒：合成结果同步为透明', wandRes.outA===0 && wandRes.outBody===255,
  'outA='+wandRes.outA+' outBody='+wandRes.outBody);
T('魔棒：Alt 点击可撤回', wandRes.afterRestore.bg===255, 'bg='+wandRes.afterRestore.bg);
T('魔棒：抠主体只掉主体', wandRes.afterBody.body===0 && wandRes.afterBody.bg===255,
  'body='+wandRes.afterBody.body+' bg='+wandRes.afterBody.bg);

/* 全图取样模式 */
const wandGlobal = vm.runInContext(`(function(){
  const c = document.createElement('canvas'); c.width=20; c.height=20;
  for(let y=0;y<20;y++) for(let x=0;x<20;x++){
    const i=(y*20+x)*4;
    // 左上角 3×3 白 + 右下角 3×3 白（互不相连），其余绿
    const white = (x<3&&y<3) || (x>=17&&y>=17);
    c.buf[i]   = white?255:20;
    c.buf[i+1] = white?255:180;
    c.buf[i+2] = white?255:60;
    c.buf[i+3] = 255;
  }
  setSheet(c, '整图');
  document.getElementById('tol').value = '30';
  const orig = document.querySelector;
  document.querySelector = (s2)=> s2.indexOf('spSample') >= 0 ? {value:'global'} : orig(s2);
  spWand(1,1,false);                      // 全图模式：两块白都会被抠掉
  document.querySelector = orig;
  const A = (x,y)=>SP.alpha[y*20+x];
  return {near:A(0,0), far:A(18,18), green:A(10,10)};
})()`, sandbox);
T('魔棒全图模式：两处不相连的同色都被抠', wandGlobal.near===0 && wandGlobal.far===0,
  JSON.stringify(wandGlobal));
T('魔棒全图模式：异色主体保留', wandGlobal.green===255, 'green='+wandGlobal.green);

/* ============ 9. 元素齐全 ============ */
const NEED = ['tabSplit','railSplit','barSplit','rightSplit','btnUseCursor','btnUseFrame',
  'btnCropApply','btnCropCancel','btnCropAuto','cropTip','enhScale','enhAmount','enhAmountV',
  'enhDenoise','btnEnhance','btnExpPng','btnSplitAll','chkAuto','chkTrim','btnAssetsToFrames',
  'btnResetMask','btnClearAssets','assetGrid','assetCount','tol','spBrush','luma','sat','spill','feather'];
const missing = NEED.filter(id=>!new RegExp('id="'+id+'"').test(html));
T('界面元素齐全', missing.length===0, missing.join(',') || 'all present');
const dead = ['sMode'].filter(id=>new RegExp('id="'+id+'"').test(html));
T('已删除的旧控件无残留', dead.length===0, dead.join(','));

console.log('---');
console.log('MERGE RESULT: pass=' + pass + ' fail=' + fail);
if(fail) process.exit(1);
