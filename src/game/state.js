// Trạng thái dùng chung giữa các module. Mọi thứ thay đổi trong lúc chơi nằm ở đây.
import { bbox } from '../util/geom.js';

// Kích thước logic của màn chơi (canvas được scale để vừa màn hình)
export const W = 420;
export const H = 760;
export const TABLE_Y = 452;        // mép sàn (đồ nằm rải bên dưới)
export const FLOOR_Y = H - 140;    // sàn vật lý, cách thanh booster một khoảng (thanh cozy cao 5em, đỉnh ở ~H-117)
export const PAD = 14;             // độ dày thành túi

// Túi. Lòng túi là POLYGON (BAG.poly, toạ độ tuyệt đối). left/right/top/bottom là bbox của polygon.
// Toạ độ cục bộ của level: gốc tại (cx, bottom) = giữa đáy lòng túi, y âm hướng lên.
export const BAG = {
  cx: 210, bottom: 404, kind: 'pouch', wall: PAD,
  poly: [], blocks: [],
  left: 0, right: 0, top: 0, innerW: 0, innerH: 0,
  BL: 0, BR: 0, BT: 0, BB: 0,
};

/** Đặt túi từ level.container */
export function setContainer(c) {
  BAG.cx = c.cx ?? 210; BAG.bottom = c.bottom ?? 404; BAG.kind = c.skin || 'pouch';
  BAG.oy = BAG.bottom;   // gốc toạ độ level (giữa đáy lòng túi), túi dáng cố định neo ảnh vào đây
  const shape = c.shape && c.shape.length >= 3 ? c.shape : [[-130, -210], [130, -210], [130, 0], [-130, 0]];
  BAG.poly = shape.map(([x, y]) => [BAG.cx + x, BAG.bottom + y]);
  BAG.blocks = (c.blocks || []).map(b => ({ ...b, x: BAG.cx + b.x, y: BAG.bottom + b.y }));
  // Túi dáng cố định kín bốn bề (miệng túi là đường khoá kéo cong), túi cũ để hở cạnh trên
  BAG.closed = !!c.closed; BAG.scale = c.scale || 1;
  const bb = bbox(BAG.poly);
  BAG.left = bb.minX; BAG.right = bb.maxX; BAG.top = bb.minY; BAG.bottom = bb.maxY;
  BAG.innerW = bb.w; BAG.innerH = bb.h;
  BAG.BL = BAG.left - PAD; BAG.BR = BAG.right + PAD; BAG.BT = BAG.top - 12; BAG.BB = BAG.bottom + PAD + 6;
}
setContainer({});

/** Đổi toạ độ cục bộ level ↔ tuyệt đối */
export const toAbs = (x, y) => ({ x: BAG.cx + x, y: BAG.bottom + y });
export const toLocal = (x, y) => ({ x: x - BAG.cx, y: y - BAG.bottom });

export const S = {
  // level / map
  mapId: 'pack-and-go', map: null, levelIdx: 0, LEVEL: null, ITEMS: [], preview: false,
  // physics
  engine: null, world: null, bodies: [], staticBodies: [],
  // cầm đồ
  drag: null, selected: null,
  // cơ chế
  tethers: [], gone: new Set(), unlockFrames: 0, unlockHinted: false,
  // booster
  boosts: { freeze: 1, resize: 1, throw: 1 }, freezeUntil: 0,
  // Túi: lúc mở màn ẩn đi cho đồ mưa xuống trước, đồ nằm yên hết thì túi mới hiện ra (level.js)
  tuiDaDung: false, tuiWalls: [], tuiHienLuc: 0,
  // tiến độ
  checked: new Set(), winFrames: 0, won: false, lost: false, paused: false,
  // thời gian
  timeLeft: 0, timerOn: true,
  // Đồng hồ game (mili giây), chỉ chạy khi ván đang diễn và chạy theo timeScale.
  // timeScale < 1 là quay chậm, > 1 là tua nhanh — Creative Tool điều khiển.
  clock: 0, timeScale: 1,
  // Ngón tay giả vẽ lên canvas khi máy tự chơi ở Creative Tool: { x, y, down }
  finger: null, showFinger: false,
  // hiệu ứng
  puffs: [], startTime: 0, shownSec: -1,
  // thế xếp trong túi ngay trước lần thả gần nhất, để hoàn tác nếu lần thả đó hỏng
  luuTui: null,
};

/** Món đã thả vào sân chưa. Đầu màn đồ vào lần lượt nên có lúc body chưa nằm trong thế giới vật lý. */
export const daVao = b => !b.chuaVao;
export const partsOf = b => (b.parts.length > 1 ? b.parts.slice(1) : [b]);
export const isHeld = b => !!(S.drag && (S.drag.group ? S.drag.group.includes(b) : S.drag.body === b));
