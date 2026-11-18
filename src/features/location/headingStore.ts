import { headingFromOrientation, shortestDelta, smoothHeading, type OrientationLike } from "./heading";

/**
 * 向き(コンパス)の状態。
 *  - unknown:          まだ値が来ていない(Android で待っている間など)
 *  - needs-permission: iPhone で、ボタンを押して許可をもらう必要がある
 *  - active:           向きが取れている
 *  - denied:           許可されなかった
 *  - unsupported:      この端末では取れない(パソコンなど)
 */
export type CompassStatus = "unknown" | "needs-permission" | "active" | "denied" | "unsupported";

export type HeadingState = {
  status: CompassStatus;
  /** 北=0 の時計回りの度数。取れていなければ null */
  heading: number | null;
};

export const INITIAL_HEADING: HeadingState = { status: "unknown", heading: null };

/** この時間内に北の分かる値が来なければ「この端末では取れない」とみなす */
const NO_SENSOR_TIMEOUT_MS = 4_000;
/** これより小さい変化は描き直さない */
const MIN_CHANGE_DEG = 1;

type PermissionRequester = () => Promise<"granted" | "denied" | string>;

type OrientationEventCtor = { requestPermission?: PermissionRequester };

type Env = {
  window: (Window & typeof globalThis) | undefined;
};

type Listener = () => void;

function screenAngle(win: Window): number {
  const angle = win.screen?.orientation?.angle;
  if (typeof angle === "number") return angle;
  const legacy = (win as unknown as { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
}

export function createHeadingStore(getEnv: () => Env) {
  let state: HeadingState = INITIAL_HEADING;
  let initialized = false;
  let detach: (() => void) | null = null;
  let noSensorTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<Listener>();

  const set = (next: Partial<HeadingState>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };

  const ctor = (): OrientationEventCtor | undefined => {
    const win = getEnv().window;
    return win && "DeviceOrientationEvent" in win ? (win.DeviceOrientationEvent as unknown as OrientationEventCtor) : undefined;
  };

  function attach() {
    const win = getEnv().window;
    if (!win || detach) return;
    // Android Chrome は absolute 版に北基準の値が来る。iPhone は通常版に webkitCompassHeading が来る。
    // 端末によって来るほうが違うので両方を聞き、北の分かる値だけを使う。
    const types = ["deviceorientationabsolute", "deviceorientation"];
    const handler = (event: Event) => {
      const heading = headingFromOrientation(event as unknown as OrientationLike, screenAngle(win));
      if (heading === null) return;
      clearTimeout(noSensorTimer);
      if (state.status === "active" && state.heading !== null && Math.abs(shortestDelta(state.heading, heading)) < MIN_CHANGE_DEG) {
        return;
      }
      set({ status: "active", heading: smoothHeading(state.status === "active" ? state.heading : null, heading) });
    };
    types.forEach((t) => win.addEventListener(t, handler));
    detach = () => types.forEach((t) => win.removeEventListener(t, handler));
    clearTimeout(noSensorTimer);
    noSensorTimer = setTimeout(() => {
      if (state.status === "unknown") set({ status: "unsupported" });
    }, NO_SENSOR_TIMEOUT_MS);
  }

  function init() {
    if (initialized) return;
    initialized = true;
    const c = ctor();
    if (!c) {
      set({ status: "unsupported" });
      return;
    }
    if (typeof c.requestPermission === "function") {
      set({ status: "needs-permission" });
      return;
    }
    attach();
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: Listener) {
      listeners.add(listener);
      init();
      return () => {
        listeners.delete(listener);
      };
    },
    /**
     * iPhone で向きの許可をもらう。必ずボタンを押したときの処理の中で呼ぶこと
     * (タップ直後でないと Safari が許可ダイアログを出さない)。
     * 許可が要らない端末では何もせず true。
     */
    async requestPermission(): Promise<boolean> {
      init();
      const c = ctor();
      if (!c) return false;
      if (typeof c.requestPermission !== "function") return state.status !== "unsupported" && state.status !== "denied";
      if (state.status === "active") return true;
      try {
        const result = await c.requestPermission();
        if (result === "granted") {
          set({ status: "unknown" });
          attach();
          return true;
        }
        set({ status: "denied" });
        return false;
      } catch {
        // タップ以外から呼ばれた等。状態は変えずにもう一度押してもらえるようにする
        return false;
      }
    },
  };
}

export type HeadingStore = ReturnType<typeof createHeadingStore>;

export const headingStore = createHeadingStore(() => ({
  window: typeof window === "undefined" ? undefined : window,
}));
