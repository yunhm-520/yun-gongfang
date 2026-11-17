const fs=require('fs');
const html=fs.readFileSync('../指针工坊.html','utf8');
const h=html.indexOf('function u8('), e=html.indexOf('function u32v');
const helper=html.slice(h,e);
const a=html.indexOf('const CRC_T'), b=html.indexOf('const ROLES');
const factory=new Function(helper+html.slice(a,b)+'\nreturn {crc32,makeZip,u8};');
const {makeZip}=factory();
const enc=new TextEncoder();
const z=makeZip([
  {name:'files/test.cur', data:new Uint8Array([1,2,3,4,5])},
  {name:'安装指针.bat', data:enc.encode('hello 你好')},
  {name:'说明.txt', data:enc.encode('中文内容测试')},
]);
fs.writeFileSync('./js_test.zip', Buffer.from(z));
console.log('zip bytes', z.length);
