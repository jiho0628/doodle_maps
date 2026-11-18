import { getServerEnv } from "@/lib/config/env";
import { findCategory } from "@/features/search/categories";
import { hereBrowse, hereDiscover } from "@/features/search/server/here";

/**
 * HERE Geocoding & Search の中継(キーをブラウザに出さないため)。
 *
 * GET /api/here?q=六角ace&lat=35.0&lng=135.7       名前・住所でさがす(近くを優先)
 * GET /api/here?category=cafe&lat=35.0&lng=135.7   近くのカフェなど(近い順)
 *  200 { places: Place[], source: "here" }
 *  400 { error: "bad_request" }
 *  503 { error: "not_configured" }(HERE_API_KEY 未設定。ブラウザは MapTiler / OpenStreetMap を使う)
 *  502 { error: "upstream", detail }
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const categoryParam = url.searchParams.get("category");
  const category = categoryParam ? findCategory(categoryParam) : undefined;
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const validCenter =
    !!url.searchParams.get("lat") && !!url.searchParams.get("lng") && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if (!validCenter || (categoryParam ? !category : !q)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const key = getServerEnv().hereApiKey;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });

  // 約10mに丸める(CDN のキャッシュが効くように)
  const center = { lat: Math.round(lat * 1e4) / 1e4, lng: Math.round(lng * 1e4) / 1e4 };
  try {
    const places = category ? await hereBrowse(category, center, key) : await hereDiscover(q, center, key);
    // 日本の結果は 24 時間より長くためられないので、CDN には数分だけ置く
    return Response.json(
      { places, source: "here" },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn("[api/here] HERE error", detail);
    return Response.json({ error: "upstream", detail }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
