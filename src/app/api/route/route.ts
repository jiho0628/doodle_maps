import { getServerEnv } from "@/lib/config/env";
import { MAX_STRAIGHT_DISTANCE_M, parseRouteRequest } from "@/features/route/navRoute";
import { distanceM } from "@/features/route/geo";
import { fetchOrsRoute } from "@/features/route/server/ors";

/**
 * 経路検索 API(OpenRouteService の中継)。
 * ORS_API_KEY をブラウザに出さないため、ここを経由して呼びます。
 *
 * POST /api/route  { from: {lng,lat}, to: {lng,lat}, mode?: "foot-walking" }
 *  200 { route, stepIndices, approximate: false }
 *  400 { error: "bad_request" }      … 送られてきた値がおかしい
 *  422 { error: "too_far" | "no_route" }
 *  503 { error: "not_configured" }   … ORS_API_KEY が未設定(ブラウザ側は直線で案内する)
 *  502 { error: "upstream" }         … ORS の不調
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = parseRouteRequest(body);
  if (!parsed) return Response.json({ error: "bad_request" }, { status: 400 });

  if (distanceM(parsed.from, parsed.to) > MAX_STRAIGHT_DISTANCE_M) {
    return Response.json({ error: "too_far" }, { status: 422 });
  }

  const { orsApiKey } = getServerEnv();
  if (!orsApiKey) return Response.json({ error: "not_configured" }, { status: 503 });

  const result = await fetchOrsRoute(parsed, orsApiKey);
  if (result.ok) {
    return Response.json(result.body, { headers: { "Cache-Control": "no-store" } });
  }
  if (result.reason === "no_route") return Response.json({ error: "no_route" }, { status: 422 });
  console.warn("[api/route] OpenRouteService error", result.status);
  return Response.json({ error: "upstream" }, { status: 502 });
}
