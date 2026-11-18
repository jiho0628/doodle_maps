import { afterEach, describe, expect, it, vi } from "vitest";
import { createHeadingStore } from "./headingStore";

type FakeWindow = EventTarget & {
  DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
  ondeviceorientationabsolute?: null;
  screen: { orientation: { angle: number } };
};

function fakeWindow(opts: { requestPermission?: () => Promise<string>; absolute?: boolean; noSensor?: boolean } = {}) {
  const win = new EventTarget() as FakeWindow;
  if (!opts.noSensor) win.DeviceOrientationEvent = opts.requestPermission ? { requestPermission: opts.requestPermission } : {};
  if (opts.absolute) win.ondeviceorientationabsolute = null;
  win.screen = { orientation: { angle: 0 } };
  return win;
}

function orientationEvent(type: string, fields: Record<string, unknown>) {
  return Object.assign(new Event(type), fields);
}

function storeFor(win: FakeWindow) {
  return createHeadingStore(() => ({ window: win as unknown as Window & typeof globalThis }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createHeadingStore", () => {
  it("Android: deviceorientationabsolute から向きが取れる", () => {
    const win = fakeWindow({ absolute: true });
    const store = storeFor(win);
    store.subscribe(() => {});
    win.dispatchEvent(orientationEvent("deviceorientationabsolute", { alpha: 270, absolute: true }));
    expect(store.getSnapshot()).toEqual({ status: "active", heading: 90 });
  });

  it("iPhone: 許可をもらうまでは needs-permission、許可後に向きが取れる", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    const win = fakeWindow({ requestPermission, absolute: true }); // absolute 版のイベントがある端末でも通常版を聞く
    const store = storeFor(win);
    store.subscribe(() => {});
    expect(store.getSnapshot().status).toBe("needs-permission");

    await expect(store.requestPermission()).resolves.toBe(true);
    win.dispatchEvent(orientationEvent("deviceorientation", { alpha: 0, webkitCompassHeading: 45 }));
    expect(store.getSnapshot()).toEqual({ status: "active", heading: 45 });
  });

  it("iPhone: 許可されなければ denied", async () => {
    const win = fakeWindow({ requestPermission: () => Promise.resolve("denied") });
    const store = storeFor(win);
    store.subscribe(() => {});
    await expect(store.requestPermission()).resolves.toBe(false);
    expect(store.getSnapshot().status).toBe("denied");
  });

  it("センサーのない端末は unsupported", () => {
    const store = storeFor(fakeWindow({ noSensor: true }));
    store.subscribe(() => {});
    expect(store.getSnapshot().status).toBe("unsupported");
  });

  it("北の分かる値がしばらく来なければ unsupported(パソコンなど)", () => {
    vi.useFakeTimers();
    const win = fakeWindow();
    const store = storeFor(win);
    store.subscribe(() => {});
    win.dispatchEvent(orientationEvent("deviceorientation", { alpha: null, absolute: false }));
    expect(store.getSnapshot().status).toBe("unknown");
    vi.advanceTimersByTime(5000);
    expect(store.getSnapshot().status).toBe("unsupported");
  });

  it("北をまたぐ変化はなめらかに最短で回る", () => {
    const win = fakeWindow({ absolute: true });
    const store = storeFor(win);
    store.subscribe(() => {});
    win.dispatchEvent(orientationEvent("deviceorientationabsolute", { alpha: 2, absolute: true })); // 358°
    win.dispatchEvent(orientationEvent("deviceorientationabsolute", { alpha: 358, absolute: true })); // 2°
    const h = store.getSnapshot().heading!;
    expect(h > 358 || h < 2).toBe(true);
  });
});
