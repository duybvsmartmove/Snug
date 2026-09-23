// Đọc / ghi PNG RGBA 8 bit bằng Node thuần, không cần thư viện ảnh.
// Công cụ art (import_items, build_colliders) dùng chung.
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

/** Đọc PNG RGBA 8 bit không xen dòng → { w, h, px } với px là Buffer RGBA */
export function docPNG(duongDan) {
  const b = readFileSync(duongDan);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('không phải PNG');
  let i = 8, w = 0, h = 0, sauBit = 0, kieuMau = 0, xenDong = 0;
  const idat = [];
  while (i < b.length) {
    const len = b.readUInt32BE(i), ten = b.toString('ascii', i + 4, i + 8);
    const data = b.subarray(i + 8, i + 8 + len);
    if (ten === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      sauBit = data[8]; kieuMau = data[9]; xenDong = data[12];
    } else if (ten === 'IDAT') idat.push(data);
    else if (ten === 'IEND') break;
    i += 12 + len;
  }
  if (sauBit !== 8 || kieuMau !== 6 || xenDong !== 0)
    throw new Error(`chỉ đọc được RGBA 8 bit không xen dòng (nhận được sâu=${sauBit} kiểu=${kieuMau} xen=${xenDong})`);

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4, buocDong = w * bpp;
  const px = Buffer.alloc(w * h * bpp);
  let o = 0;
  for (let y = 0; y < h; y++) {
    const loc = raw[o++];
    const dong = raw.subarray(o, o + buocDong); o += buocDong;
    const ra = px.subarray(y * buocDong, (y + 1) * buocDong);
    const tren = y ? px.subarray((y - 1) * buocDong, y * buocDong) : null;
    for (let x = 0; x < buocDong; x++) {
      const A = x >= bpp ? ra[x - bpp] : 0;
      const B = tren ? tren[x] : 0;
      const C = tren && x >= bpp ? tren[x - bpp] : 0;
      let v = dong[x];
      if (loc === 1) v += A;
      else if (loc === 2) v += B;
      else if (loc === 3) v += (A + B) >> 1;
      else if (loc === 4) {
        const p = A + B - C, pa = Math.abs(p - A), pb = Math.abs(p - B), pc = Math.abs(p - C);
        v += (pa <= pb && pa <= pc) ? A : (pb <= pc ? B : C);
      }
      ra[x] = v & 255;
    }
  }
  return { w, h, px };
}

const BANG_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = BANG_CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function khoi(ten, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(ten, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Ghi PNG RGBA 8 bit. Mỗi dòng chọn bộ lọc cho tổng trị tuyệt đối nhỏ nhất (cách của libpng). */
export function ghiPNG(duongDan, { w, h, px }) {
  const bpp = 4, buocDong = w * bpp;
  const raw = Buffer.alloc(h * (buocDong + 1));
  const thu = Array.from({ length: 5 }, () => Buffer.alloc(buocDong));
  for (let y = 0; y < h; y++) {
    const dong = px.subarray(y * buocDong, (y + 1) * buocDong);
    const tren = y ? px.subarray((y - 1) * buocDong, y * buocDong) : null;
    let tot = 0, diemTot = Infinity;
    for (let loc = 0; loc < 5; loc++) {
      const ra = thu[loc];
      let diem = 0;
      for (let x = 0; x < buocDong; x++) {
        const A = x >= bpp ? dong[x - bpp] : 0, B = tren ? tren[x] : 0, C = tren && x >= bpp ? tren[x - bpp] : 0;
        let du = 0;
        if (loc === 1) du = A;
        else if (loc === 2) du = B;
        else if (loc === 3) du = (A + B) >> 1;
        else if (loc === 4) {
          const p = A + B - C, pa = Math.abs(p - A), pb = Math.abs(p - B), pc = Math.abs(p - C);
          du = (pa <= pb && pa <= pc) ? A : (pb <= pc ? B : C);
        }
        const v = (dong[x] - du) & 255;
        ra[x] = v; diem += v < 128 ? v : 256 - v;
      }
      if (diem < diemTot) { diemTot = diem; tot = loc; }
    }
    const o = y * (buocDong + 1);
    raw[o] = tot; thu[tot].copy(raw, o + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync(duongDan, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    khoi('IHDR', ihdr), khoi('IDAT', deflateSync(raw, { level: 9 })), khoi('IEND', Buffer.alloc(0)),
  ]));
}
