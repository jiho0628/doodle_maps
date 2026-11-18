import { LocationLayer } from "@/features/location";
import { MapView } from "@/features/map";
import { SearchLauncher } from "@/features/search";

/**
 * 地図ホーム。
 * 地図の上に浮かせる部品は <MapView> の子として並べます。
 * 各機能(現在地ボタン、向きの案内など)はここに1行ずつ足してください。
 */
export default function MapHomePage() {
  return (
    <MapView>
      <SearchLauncher />
      <LocationLayer />
    </MapView>
  );
}
