/**
 * スマホの向き(コンパス)の計算。ブラウザに依存しない純粋な関数だけを置く。
 * heading は「北=0、東=90 …」の時計回りの度数(0〜360未満)。
 */

export type OrientationLike = {
  alpha: number | null;
  absolute?: boolean;
  /** iPhone(Safari)だけが持つ、北からの角度 */
  webkitCompassHeading?: number;
};

export function normalizeDegrees(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

/**
 * deviceorientation(absolute) のイベントから、画面の上がどの方角を向いているかを出す。
 * 北が分からないイベント(相対値しかない Android の deviceorientation 等)は null。
 * @param screenAngle 画面の回転(縦向き=0、横向き=90/270)
 */
export function headingFromOrientation(event: OrientationLike, screenAngle = 0): number | null {
  let raw: number | null = null;
  if (typeof event.webkitCompassHeading === "number" && Number.isFinite(event.webkitCompassHeading) && event.webkitCompassHeading >= 0) {
    raw = event.webkitCompassHeading;
  } else if (event.absolute && typeof event.alpha === "number" && Number.isFinite(event.alpha)) {
    // alpha は反時計回りなので向きを反転
    raw = 360 - event.alpha;
  }
  if (raw === null) return null;
  return normalizeDegrees(raw + screenAngle);
}

/** a から b への最短の回り方(-180〜180) */
export function shortestDelta(from: number, to: number): number {
  return normalizeDegrees(to - from + 180) - 180;
}

/**
 * 手ぶれで扇形がぷるぷるしないように、なめらかにする。
 * 359°→1° のような北をまたぐ変化も最短で回る。
 */
export function smoothHeading(prev: number | null, next: number, factor = 0.35): number {
  if (prev === null) return normalizeDegrees(next);
  return normalizeDegrees(prev + shortestDelta(prev, next) * factor);
}
