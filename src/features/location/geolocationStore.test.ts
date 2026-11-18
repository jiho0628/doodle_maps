import { describe, expect, it, vi } from "vitest";
import { createLocationStore } from "./geolocationStore";

function fakeGeolocation() {
  let success: PositionCallback | undefined;
  let failure: PositionErrorCallback | null | undefined;
  const geo = {
    watchPosition: vi.fn((s: PositionCallback, e?: PositionErrorCallback | null) => {
      success = s;
      failure = e;
      return 7;
    }),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  };
  return {
    geo: geo as unknown as Geolocation,
    raw: geo,
    emit(lng: number, lat: number, accuracy = 12) {
      success?.({ coords: { longitude: lng, latitude: lat, accuracy }, timestamp: 1000 } as GeolocationPosition);
    },
    fail(code: number) {
      failure?.({ code } as GeolocationPositionError);
    },
  };
}

describe("createLocationStore", () => {
  it("購読すると監視を始め、位置が届いたら ok になる", () => {
    const f = fakeGeolocation();
    const store = createLocationStore(() => f.geo);
    const unsubscribe = store.subscribe(() => {});
    expect(store.getSnapshot().status).toBe("locating");
    f.emit(139.7, 35.6);
    expect(store.getSnapshot()).toMatchObject({ status: "ok", position: { lng: 139.7, lat: 35.6 }, accuracyM: 12 });
    unsubscribe();
    expect(f.raw.clearWatch).toHaveBeenCalledWith(7);
  });

  it("何人が購読しても監視は1本", () => {
    const f = fakeGeolocation();
    const store = createLocationStore(() => f.geo);
    const a = store.subscribe(() => {});
    const b = store.subscribe(() => {});
    expect(f.raw.watchPosition).toHaveBeenCalledOnce();
    a();
    expect(f.raw.clearWatch).not.toHaveBeenCalled();
    b();
    expect(f.raw.clearWatch).toHaveBeenCalledOnce();
  });

  it("拒否されたら denied", () => {
    const f = fakeGeolocation();
    const store = createLocationStore(() => f.geo);
    store.subscribe(() => {});
    f.fail(1);
    expect(store.getSnapshot().status).toBe("denied");
  });

  it("一度取れたあとの一時的な失敗では最後の位置を出し続ける", () => {
    const f = fakeGeolocation();
    const store = createLocationStore(() => f.geo);
    store.subscribe(() => {});
    f.emit(139.7, 35.6);
    f.fail(3);
    expect(store.getSnapshot().status).toBe("ok");
  });

  it("位置が一度も取れずに失敗したら unavailable", () => {
    const f = fakeGeolocation();
    const store = createLocationStore(() => f.geo);
    store.subscribe(() => {});
    f.fail(2);
    expect(store.getSnapshot().status).toBe("unavailable");
  });

  it("geolocation がなければ unsupported", () => {
    const store = createLocationStore(() => undefined);
    store.subscribe(() => {});
    expect(store.getSnapshot().status).toBe("unsupported");
  });

  it("retry で監視をやり直す", () => {
    const f = fakeGeolocation();
    const store = createLocationStore(() => f.geo);
    store.subscribe(() => {});
    f.fail(1);
    store.retry();
    expect(f.raw.watchPosition).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().status).toBe("locating");
  });
});
