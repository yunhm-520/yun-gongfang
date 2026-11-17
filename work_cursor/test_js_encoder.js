// Validate the JS .cur/.ani encoders byte-for-byte against the Python reference.
const fs = require('fs');

// ---- pull the encoder code out of the HTML ----
const html = fs.readFileSync('../指针工坊.html', 'utf8');
const grab = (start, end) => {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('snippet not found: ' + start);
  return html.slice(a, b);
};
const code = [
  grab('function u8(', 'function dibFrom'),
  grab('function dibFrom(cv)', 'function curBlob(cv'),
  grab('function curBlob(cv,hx,hy)', 'function makeCur(list)'),
  grab('function makeCur(list)', 'function chunk(id, payload)'),
  grab('function chunk(id, payload)', 'function makeAni(framesIn, name)'),
  grab('function makeAni(framesIn, name)', 'function scaleCv(cv,size){'),
].join('\n');
// provide minimal helpers used by the grabbed snippets
const factory = new Function('scaleCv', code + `
  return {u8,u16v,u32v,ascii,utf16,dibFrom,curBlob,makeCur,chunk,makeAni};`);
const { u8, u16v, u32v, ascii, utf16, dibFrom, curBlob, makeCur, chunk, makeAni } =
  factory(()=>{ throw new Error('scaleCv not needed in test'); });

// ---- fake canvas: 8x8, opaque navy square with transparent corner ----
function fakeCv(size){
  const data = new Uint8ClampedArray(size*size*4);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    if(x===0 && y===0){ data[i]=data[i+1]=data[i+2]=data[i+3]=0; continue; }
    data[i]=22; data[i+1]=50; data[i+2]=92; data[i+3]=255;
  }
  return { width:size, height:size, getContext:()=>({ getImageData:()=>({data}) }) };
}

// ---- .cur single ----
const cur = curBlob(fakeCv(8), 1, 2);
fs.writeFileSync('./js_test.cur', Buffer.from(cur));

// ---- .cur multi-size ----
const multi = makeCur([{cv:fakeCv(32),hx:3,hy:4},{cv:fakeCv(48),hx:5,hy:6}]);
fs.writeFileSync('./js_multi.cur', Buffer.from(multi));

// ---- .ani ----
const frames = [0,1,2].map(k=>({cv:fakeCv(16), ms:90, hx:1, hy:1}));
const ani = makeAni(frames, '测试指针');
fs.writeFileSync('./js_test.ani', Buffer.from(ani));
console.log('sizes cur=%d multi=%d ani=%d', cur.length, multi.length, ani.length);
