import { afterEach, describe, expect, it, vi } from "vitest";
import { ORS_SAMPLE } from "@/features/route/server/orsSample.fixture";
import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const from = { lng: 139.7, lat: 35.7 };
const to = { lng: 139.701, lat: 35.701 };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/route", () => {
  it("おかしな値は 400", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post({ from, to: { lng: 999, lat: 0 } })).status).toBe(400);
    expect((await post({ from, to, mode: "rocket" })).status).toBe(400);
  });

  it("キー未設定なら 503 not_configured(外部には問い合わせない)", async () => {
    vi.stubEnv("ORS_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await post({ from, to });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("遠すぎる目的地は 422 too_far", async () => {
    vi.stubEnv("ORS_API_KEY", "k");
    const res = await post({ from, to: { lng: 135.5, lat: 34.7 } });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "too_far" });
  });

  it("キーがあれば ORS に聞いて経路を返す(キーは返さない)", async () => {
    vi.stubEnv("ORS_API_KEY", "server-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(ORS_SAMPLE)));
    const res = await post({ from, to });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("server-secret");
    const json = JSON.parse(text);
    expect(json.route.steps).toHaveLength(3);
    expect(json.approximate).toBe(false);
  });

  it("ORS の不調は 502", async () => {
    vi.stubEnv("ORS_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await post({ from, to })).status).toBe(502);
  });
});
