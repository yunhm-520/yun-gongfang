// 图片工坊.html 核心算法验证：桩 DOM + vm 加载脚本
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('../图片工坊.html', 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function fakeCtx() {
  const c = { canvas: null };
  ['drawImage','fillRect','clearRect','save','restore','beginPath','moveTo','lineTo',
   'stroke','fill','arc','rect','ellipse','translate','rotate','scale','setLineDash',
   'fillText','strokeRect'].forEach(k => c[k] = () => {});
  c.createPattern = () => ({});
  c.getImageData = (x, y, w, h) => ({ data: new Uint8ClampedArray(w*h*4), width: w, height: h });
  c.putImageData = () => {};
  return c;
}
function fakeEl() {
  return {
    style: {}, dataset: {}, classList: { toggle(){}, add(){}, remove(){} },
    addEventListener(){}, value: '0', textContent: '', innerHTML: '',
    disabled: false, hidden: false, click(){}, getBoundingClientRect(){ return {left:0,top:0}; },
    setPointerCapture(){}, appendChild(){},
    width: 800, height: 600, getContext(){ return fakeCtx(); },
    files: [],
  };
}
const sandbox = {
  console,
  document: {
    getElementById: () => fakeEl(),
    querySelectorAll: () => [],
    createElement: (t) => t === 'canvas' ? fakeEl() : fakeEl(),
  },
  window: { addEventListener(){} },
  Image: function(){ return { addEventListener(){}, onload:null }; },
  FileReader: function(){ this.readAsDataURL = () => {}; this.onload = null; },
  prompt: () => null, alert: () => {}, URL: { createObjectURL: ()=>'', revokeObjectURL: ()=>{} },
  Blob: function(){}, setTimeout: (f)=>{}, Uint8ClampedArray, Math, parseInt, parseFloat,
};
sandbox.window = sandbox; // window.addEventListener etc.
sandbox.addEventListener = () => {};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

let pass = 0, fail = 0;
function T(name, cond) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name); }
}

// 1) 调整：恒等
{
  const d = new Uint8ClampedArray([100,150,200,255, 10,20,30,0]);
  const snap = d.slice();
  sandbox.applyAdjToData(d, {bri:0,con:0,sat:0,hue:0,tmp:0});
  T('adj identity unchanged', d.every((v,i)=>v===snap[i]));
}
// 2) 亮度 +100*1.28=+128 → 50+128=178
{
  const d = new Uint8ClampedArray([50,50,50,255]);
  sandbox.applyAdjToData(d, {bri:100,con:0,sat:0,hue:0,tmp:0});
  T('brightness +128 -> 178', d[0]===178 && d[3]===255);
}
// 3) 灰度
{
  const d = new Uint8ClampedArray([255,0,0,255]);
  sandbox.fxGray(d);
  const v = Math.round(.299*255);
  T('gray red->lum', d[0]===v && d[1]===v && d[2]===v);
}
// 4) 反色
{
  const d = new Uint8ClampedArray([10,20,30,255]);
  sandbox.fxInvert(d);
  T('invert', d[0]===245 && d[1]===235 && d[2]===225);
}
// 5) sepia 红 → (100, 89, 34)（系数 .393/.349/.272 ×255）
{
  const d = new Uint8ClampedArray([255,0,0,255]);
  sandbox.fxSepia(d);
  T('sepia red->(100,89,69)', d[0]===100 && d[1]===89 && d[2]===69);
}
// 6) boxBlur 均值：3x1 图，中间像素 = (1+5+9)/3=5（r通道）
{
  // 3x1 image, r = 1,5,9
  const d = new Uint8ClampedArray([1,0,0,255, 5,0,0,255, 9,0,0,255]);
  sandbox.boxBlurData(d, 3, 1, 1);
  T('boxblur center avg=5', d[4]===5 && d[0]===3 && d[8]===7);
}
// 7) 锐化核在平坦区域不变
{
  const d = new Uint8ClampedArray(16*16*4);
  d.fill(128);
  sandbox.convolve3(d, 16, 16, [0,-1,0,-1,5,-1,0,-1,0], 0);
  T('sharpen flat unchanged', d[0]===128 && d[500]===128);
}
// 8) 边缘核: 平坦区 128+0 → 128
{
  const d = new Uint8ClampedArray(16*16*4);
  d.fill(200);
  sandbox.convolve3(d, 16, 16, [0,1,0,1,-4,1,0,1,0], 128);
  T('edge flat = 128', d[0]===128);
}
// 9) 马赛克：2x2 全图, r 值 0..3 → 平均 1.5 → 1(截断? Uint8Clamped round)
{
  const d = new Uint8ClampedArray(4*4);
  const vals=[0,1,2,3];
  for(let i=0;i<4;i++){ d[i*4]=vals[i]; d[i*4+3]=255; }
  sandbox.fxMosaic(d, 2, 2, 2);
  const avg = d[0];
  T('mosaic avg ~1.5', Math.abs(avg-1.5)<=0.51);
}
// 10) 暗角：中心不变（dist=0），角落被压暗
{
  const w=101,h=101, d=new Uint8ClampedArray(w*h*4);
  d.fill(200);
  sandbox.fxVignette(d, w, h, 0.5);
  const ctr = d[(50*w+50)*4];
  const corner = d[0];
  T('vignette center=200', ctr===200);
  T('vignette corner darker', corner < 200);
}
// 11) CSS hue-rotate 矩阵 @180°: 纯红 → 暗青 (0,109,109)
{
  const d = new Uint8ClampedArray([255,0,0,255]);
  sandbox.applyAdjToData(d, {bri:0,con:0,sat:0,hue:180,tmp:0});
  T('hue180 red->(0,109,109)', d[0]===0 && d[1]===109 && d[2]===109);
}
// 12) 饱和度 -100 → 灰
{
  const d = new Uint8ClampedArray([255,0,0,255]);
  sandbox.applyAdjToData(d, {bri:0,con:0,sat:-100,hue:0,tmp:0});
  const lum = Math.round(.299*255);
  T('sat-100 -> gray', Math.abs(d[0]-d[1])<=1 && Math.abs(d[1]-d[2])<=1 && Math.abs(d[0]-lum)<=2);
}
// 13) 色温：+100 暖 → r 升 b 降
{
  const d = new Uint8ClampedArray([100,100,100,255]);
  sandbox.applyAdjToData(d, {bri:0,con:0,sat:0,hue:0,tmp:100});
  T('temp warm r>b', d[0]===136 && d[2]===64);
}

console.log('---');
console.log('RESULT: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
