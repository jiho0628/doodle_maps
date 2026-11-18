import type { LngLat } from "@/types";

/**
 * 現在地(GPS)の状態。
 *  - idle:        まだ取りに行っていない
 *  - locating:    取得中(許可ダイアログ表示中を含む)
 *  - ok:          取れている
 *  - denied:      位置情報の利用が許可されていない
 *  - unavailable: 許可はあるが取れない(電波・GPS・端末の位置情報サービスがオフ)
 *  - unsupported: このブラウザでは使えない
 */
export type LocationStatus = "idle" | "locating" | "ok" | "denied" | "unavailable" | "unsupported";

export type LocationState = {
  status: LocationStatus;
  /** 最後に取れた位置。一度も取れていなければ null */
  position: LngLat | null;
  /** 位置の誤差(メートル) */
  accuracyM: number | null;
  /** 最後に位置が更新された時刻(ms) */
  updatedAt: number | null;
};

export const INITIAL_LOCATION: LocationState = { status: "idle", position: null, accuracyM: null, updatedAt: null };

const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 };

type Listener = () => void;

/**
 * navigator.geolocation.watchPosition を1本だけ動かし、複数の部品で共有するストア。
 * 最初の購読で監視を始め、購読がなくなったら止める(電池の節約)。
 */
export function createLocationStore(getGeolocation: () => Geolocation | undefined) {
  let state: LocationState = INITIAL_LOCATION;
  let watchId: number | null = null;
  const listeners = new Set<Listener>();

  const set = (next: Partial<LocationState>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };

  const onSuccess = (pos: GeolocationPosition) => {
    set({
      status: "ok",
      position: { lng: pos.coords.longitude, lat: pos.coords.latitude },
      accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
      updatedAt: pos.timestamp || Date.now(),
    });
  };

  const onError = (err: GeolocationPositionError) => {
    if (err.code === 1 /* PERMISSION_DENIED */) {
      stop();
      set({ status: "denied" });
      return;
    }
    // 一度取れていれば、一時的に取れなくても最後の位置を出し続ける
    if (state.position) return;
    set({ status: "unavailable" });
  };

  function start() {
    if (watchId !== null) return;
    const geo = getGeolocation();
    if (!geo) {
      set({ status: "unsupported" });
      return;
    }
    if (state.status !== "ok") set({ status: "locating" });
    try {
      watchId = geo.watchPosition(onSuccess, onError, WATCH_OPTIONS);
    } catch {
      set({ status: "unsupported" });
    }
  }

  function stop() {
    if (watchId === null) return;
    getGeolocation()?.clearWatch(watchId);
    watchId = null;
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: Listener) {
      listeners.add(listener);
      start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    /** 設定を変えてもらったあとなどに、もう一度取りに行く */
    retry() {
      stop();
      start();
    },
  };
}

export type LocationStore = ReturnType<typeof createLocationStore>;

export const locationStore = createLocationStore(() =>
  typeof navigator !== "undefined" && "geolocation" in navigator ? navigator.geolocation : undefined,
);
