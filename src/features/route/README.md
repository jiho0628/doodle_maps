# route(ルート案内)

担当: 「検索+ルート案内」スレッド。

- 案内画面は `/navigate?lng=<経度>&lat=<緯度>&name=<名前>&address=<住所(任意)>`。
  URL は `navigateHref(place)` で作ってください(検索結果・お気に入りの「行く」はこれ1つ)。
- 経路は `POST /api/route`(`src/app/api/route/route.ts`)経由で OpenRouteService に聞きます。
  キー(`ORS_API_KEY`)はサーバー側だけで使います。未設定のときは 503 `not_configured` を返し、
  画面は目的地への直線で案内します(壊れません)。
- 移動手段は徒歩(`foot-walking`)が基本。API は `mode` で自転車・車も受け付けます。
- 型は `@/types` の `Route` / `RouteStep` / `RouteTurn` / `TravelMode`。

| ファイル | 役割 |
| --- | --- |
| `NavigateScreen.tsx` | 案内中の画面(上の曲がり角バナー、下の残り時間・「案内をおわる」) |
| `RouteMapLayer.tsx` | 地図に経路の線・目的地ピン・現在地を描く |
| `useNavigation.ts` | 経路取得、進み具合、外れたときの調べなおし、到着判定 |
| `geo.ts` | 距離・時間の計算と表示用の文字 |
| `client.ts` / `server/ors.ts` | ブラウザ側 / サーバー側の経路取得 |
