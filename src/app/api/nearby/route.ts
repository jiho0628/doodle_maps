import { findCategory } from "@/features/search/categories";
import { fetchNearbyFromOverpass, overpassServerHeaders } from "@/features/search/nearby";

/**
 * 近くのカフェ・コンビニ・駅・トイレ(OpenStreetMap / Overpass API の中継)。
 * ブラウザから直接呼ぶと混雑で失敗しやすいので、ここで予備サーバーへの切り替えと
 * キャッシュ(同じ場所・同じカテゴリは5分間使い回す)をする。
 *
 * GET /api/nearby?category=convenience&lat=35.68&lng=139.76
 *  200 { places: Place[] }(近い順)
 *  400 { error: "bad_request" }
 *  502 { error: "upstream", detail: "overpass-api.de: HTTP 406; …" }(サーバーごとの失敗理由)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = findCategory(url.searchParams.get("category") ?? "");
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!category || !url.searchParams.get("lat") || !url.searchParams.get("lng") || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  // 約10mに丸める(キャッシュが効くように)
  const center = { lat: Math.round(lat * 1e4) / 1e4, lng: Math.round(lng * 1e4) / 1e4 };

  try {
    // Overpass にはこのサイトの URL を連絡先として名乗る(名乗らないと 406 で断られる)
    const places = await fetchNearbyFromOverpass(category, center, { headers: overpassServerHeaders(url.origin) });
    return Response.json(
      { places },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    // Vercel の Logs で「[api/nearby]」と検索すると見られる
    console.warn("[api/nearby] Overpass error", detail);
    return Response.json({ error: "upstream", detail }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
