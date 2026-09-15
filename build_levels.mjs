// Dựng lại 10 level chương School Day từ template. Chạy: node build_levels.mjs

// Sinh 10 level School Day: đặt túi, chọn món theo chủ đề, rải đồ, tính density + difficulty + solver.
import { readFileSync, writeFileSync } from 'node:fs';

// Đọc định nghĩa món: id là SỐ, slug chỉ để viết template cho dễ đọc
const ITEMS = {}, SLUG2ID = {};
{
  const src = readFileSync('src/data/items.js', 'utf8');
  const re = /\{ id: (-?\d+), slug: '(\w+)',[\s\S]*?box: \[(-?\d+), (-?\d+), (-?\d+), (-?\d+)\]/g;
  let m;
  while ((m = re.exec(src))) {
    const [, id, slug, x0, y0, x1, y1] = m;
    SLUG2ID[slug] = +id;
    ITEMS[slug] = { id: +id, w: +x1 - +x0, h: +y1 - +y0, area: (+x1 - +x0) * (+y1 - +y0) };
  }
}
// hệ số diện tích thực so với khung, theo hình dáng
const FILL = { socks: .79, apple: .72, earbuds: .79, sandwich: .5, banana: .6, sneaker: .62,
  cap: .6, keyring: .55, pencil: .85, milk: .82, waterbottle: .7, umbrella: .72, sanitizer: .78 };
const area = id => ITEMS[id].area * (FILL[id] ?? .95);

// ---------- túi ----------
const BAGS = {
  lunchbox: { skin: 'lunchbox', cx: 210, bottom: 392, w: 196, h: 140 },
  tote:     { skin: 'tote',     cx: 210, bottom: 400, w: 238, h: 196 },
  backpack: { skin: 'backpack', cx: 210, bottom: 404, w: 254, h: 236 },
};
function shapeRect(w, h) { return [[-w/2, -h], [w/2, -h], [w/2, 0], [-w/2, 0]]; }
function shapeNotch(w, h) {            // khuyết một góc dưới phải
  const nx = Math.round(w * .3), ny = Math.round(h * .34);
  return [[-w/2, -h], [w/2, -h], [w/2, -ny], [w/2 - nx, -ny], [w/2 - nx, 0], [-w/2, 0]];
}
function shapeTrapezoid(w, h) {        // miệng rộng, đáy hẹp (tote)
  const inset = Math.round(w * .08);
  return [[-w/2, -h], [w/2, -h], [w/2 - inset, 0], [-w/2 + inset, 0]];
}
function shapeTwoCells(w, h) {         // vách ngăn giữa tạo bằng block, shape vẫn chữ nhật
  return shapeRect(w, h);
}

// ---------- rải đồ trên sàn ----------
const TRAY = { x0: 44, x1: 376, y0: 500, y1: 616 };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function layout(ids, seed) {
  const rand = mulberry32(seed);
  const cols = ids.length > 10 ? 5 : 4;
  return ids.map((id, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    return {
      id,
      x: Math.round(TRAY.x0 + col * ((TRAY.x1 - TRAY.x0) / (cols - 1)) + (rand() - .5) * 18),
      y: Math.round(TRAY.y0 + row * 54 + rand() * 10),
      angle: Math.round((rand() - .5) * 1.4 * 100) / 100,
    };
  });
}

// ---------- 10 level ----------
const L = [
  { id:'sd-01', density:0.46, name:'Giờ ăn trưa',        bag:'lunchbox', shape:'rect',  timer:120, coin:20,
    items:['apple','milk','granola','banana'], hint:'Kéo đồ vào hộp cơm' },
  { id:'sd-02', density:0.54, name:'Thêm chai nước',      bag:'lunchbox', shape:'rect',  timer:110, coin:20,
    items:['apple','milk','granola','banana','waterbottle'] },
  { id:'sd-03', density:0.6, name:'Hộp cơm đầy',         bag:'lunchbox', shape:'notch', timer:100, coin:25,
    items:['sandwich','apple','milk','granola','banana','waterbottle'] },
  { id:'sd-04', density:0.64, name:'Chuẩn bị đồ dùng',    bag:'tote',     shape:'trap',  timer:100, coin:30,
    items:['notebook','ruler','pencil','gluestick','calculator','tissue','studentcard'] },
  { id:'sd-05', density:0.68, name:'Đôi tất đi kèm',      bag:'tote',     shape:'trap',  timer:95,  coin:30,
    items:['notebook','paintbox','ruler','pencil','gluestick','socks','handtowel','wetwipes'],
    link:['socks','handtowel'] },
  { id:'sd-06', density:0.72, name:'Túi hơi chật',        bag:'tote',     shape:'notch', timer:90,  coin:35,
    items:['textbook','notebook','ruler','pencil','gluestick','calculator','earbuds','charger','tissue'] },
  { id:'sd-07', density:0.76, name:'Hộp bí ẩn',           bag:'backpack', shape:'rect',  timer:90,  coin:40,
    items:['tablet','notebook','tshirt','socks','lipbalm','wetwipes','pencil','ruler','apple','granola'],
    locked:'tablet' },
  { id:'sd-08', density:0.79, name:'Vướng ngăn máy tính', bag:'backpack', shape:'rect',  timer:85,  coin:45,
    items:['textbook','notebook','sneaker','cap','socks','earbuds','pencil','gluestick','milk','granola','tissue'],
    blocks:[{ x:-46, y:-236, w:92, h:26 }] },
  { id:'sd-09', density:0.83, name:'Sát giờ vào lớp',     bag:'backpack', shape:'rect' , timer:80,  coin:50,
    items:['textbook','paintbox','raincoat','umbrella','socks','handtowel','calculator','apple','banana','studentcard'],
    link:['socks','handtowel'], locked:'paintbox' },
  { id:'sd-10', density:0.87, name:'Balo cuối tuần học',  bag:'backpack', shape:'notch', timer:80,  coin:60,
    items:['tablet','textbook','sneaker','cap','waterbottle','umbrella','socks','lipbalm','pencil','granola'],
    link:['socks','lipbalm'], locked:'cap',
    blocks:[{ x:-52, y:-238, w:104, h:24 }] },
];

const SHAPES = { rect: shapeRect, notch: shapeNotch, trap: shapeTrapezoid, two: shapeTwoCells };
const polyArea = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1,y1]=pts[i], [x2,y2]=pts[(i+1)%pts.length]; a += x1*y2 - x2*y1; } return Math.abs(a)/2; };

// Giới hạn kích thước lòng túi để vừa khung màn 420×760
const LIMIT = { lunchbox: { w:[150,210], h:[110,150] }, tote: { w:[180,250], h:[150,196] }, backpack: { w:[200,268], h:[170,214] } };

const report = [];
for (const lv of L) {
  const bag = BAGS[lv.bag];
  const blocks = lv.blocks || [];
  const itemAreaTmp = lv.items.reduce((s,id)=>s+area(id),0);

  // Co giãn lòng túi để đạt đúng density mục tiêu, vẫn giữ tỉ lệ và nằm trong giới hạn
  const wantUsable = itemAreaTmp / lv.density + blocks.reduce((s,b)=>s+b.w*b.h,0);
  const base = polyArea(SHAPES[lv.shape](bag.w, bag.h));
  let k = Math.sqrt(wantUsable / base);
  const lim = LIMIT[lv.bag];
  k = Math.min(k, lim.w[1]/bag.w, lim.h[1]/bag.h);
  k = Math.max(k, lim.w[0]/bag.w, lim.h[0]/bag.h);
  const bw = Math.round(bag.w * k), bh = Math.round(bag.h * k);
  const shape = SHAPES[lv.shape](bw, bh);
  const usable = polyArea(shape) - blocks.reduce((s,b)=>s+b.w*b.h,0);
  // Căn túi vào giữa khoảng trống giữa timer (y≈196) và mép sàn (y=452)
  const bottom = Math.min(424, Math.round(200 + (252 + bh) / 2));
  const itemArea = lv.items.reduce((s,id)=>s+area(id),0);
  const density = itemArea / usable;

  const items = layout(lv.items, 7000 + L.indexOf(lv)).map(it => ({ ...it, id: SLUG2ID[it.id] }));
  if (lv.link) { items.find(i=>i.id===SLUG2ID[lv.link[0]]).link = SLUG2ID[lv.link[1]]; }
  if (lv.locked) { items.find(i=>i.id===SLUG2ID[lv.locked]).locked = true; items.push({ id:0, inBag:true, x:0, y:-26, angle:0 }); }

  // difficulty theo bảng GDD
  const dPct = density*100;
  let pts = dPct<65?0:dPct<75?1:dPct<83?2:dPct<=88?3:4;
  const n = lv.items.length;
  pts += n<=5?0:n<=7?1:n<=10?2:3;
  const metaSrc = readFileSync('src/data/items.js','utf8');
  const sizeOf = sl => (metaSrc.match(new RegExp(`slug: '${sl}'[\\s\\S]*?M\\('(\\w+)'`))||[])[1];
  const shapeOf = sl => (metaSrc.match(new RegExp(`slug: '${sl}'[\\s\\S]*?M\\('\\w+', '([\\w ]+)'`))||[])[1];
  const physOf = sl => (metaSrc.match(new RegExp(`slug: '${sl}'[\\s\\S]*?M\\('\\w+', '[\\w ]+', '(\\w+)'`))||[])[1];
  const large = lv.items.filter(id=>sizeOf(id)==='Large').length;
  const irreg = lv.items.filter(id=>['Irregular','L-shape','Curved','Triangle'].includes(shapeOf(id))).length;
  pts += (large>=3&&irreg>=3)?3:(large>=3||irreg>=3)?2:(large>=1||irreg>=1)?1:0;
  const rolling = lv.items.filter(id=>physOf(id)==='rolling').length;
  pts += Math.min(3, rolling);
  pts += lv.link?2:0;
  pts += lv.locked?2:0;
  pts += (lv.shape==='notch'||blocks.length)?(blocks.length&&lv.shape==='notch'?2:1):0;
  const tier = pts<=6?'Easy':pts<=10?'Medium':pts<=14?'Hard':pts<=17?'Very Hard':'Challenge';

  const json = {
    id: lv.id, name: lv.name, timer: lv.timer,
    background: lv.bag === 'lunchbox' ? 1 : lv.bag === 'tote' ? 2 : 3,   // 1 sáng · 2 trưa · 3 chiều
    container: { skin: bag.skin, cx: bag.cx, bottom, shape, blocks },
    mode: 'fixed', items,
    reward: { coin: lv.coin },
    difficulty: { points: pts, tier },
    ...(lv.hint ? { emptyText: lv.hint } : {}),
  };
  writeFileSync(`../snug_level_editor/content/draft/maps/school-day/levels/${lv.id}.json`, JSON.stringify(json, null, 2));
  report.push({ lv: lv.id, name: lv.name, bag: lv.bag, n, 'lòng túi': `${bw}×${bh}`, đáy: bottom, density: (density*100).toFixed(0)+'%', 'mục tiêu': (lv.density*100)+'%', pts, tier });
}
console.table(report);
