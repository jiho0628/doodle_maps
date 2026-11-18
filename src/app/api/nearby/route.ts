import { findCategory } from "@/features/search/categories";
import { fetchNearbyFromOverpass } from "@/features/search/nearby";

/**
 * 近くのカフェ・コンビニ・駅・トイレ(OpenStreetMap / Overpass API の中継)。
 * ブラウザから直接呼ぶと混雑で失敗しやすいので、ここで予備サーバーへの切り替えと
 * キャッシュ(同じ場所・同じカテゴリは5分間使い回す)をする。
 *
 * GET /api/nearby?category=convenience&lat=35.68&lng=139.76
 *  200 { places: Place[] }(近い順)
 *  400 { error: "bad_request" }
 *  502 { error: "upstream" }
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
    const places = await fetchNearbyFromOverpass(category, center);
    return Response.json(
      { places },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (error) {
    console.warn("[api/nearby] Overpass error", error instanceof Error ? error.message : error);
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
