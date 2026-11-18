# location(現在地・向き)

担当: 「現在地+向き表示+アバター」スレッド。

## 使い方

```tsx
import { LocationLayer, UserLocationMarker, LocateButton, useCurrentLocation, useHeading } from "@/features/location";
```

| export | 内容 |
| --- | --- |
| `<LocationLayer />` | 地図ホーム用の一式(アバター+扇形、ついていくモード、右下のアバター/現在地ボタン、位置情報が使えないときの案内、iPhone の向きの許可カード) |
| `<UserLocationMarker />` | `<MapView>` の子に置くと、現在地にアバター+向きの扇形を出す(案内画面などで単体利用可) |
| `<LocateButton />` | 「現在地にもどる」ボタンだけ。`<MapOverlay position="bottom-right">` の中に置く |
| `useCurrentLocation()` | `{ status, position, accuracyM, updatedAt }`。GPS の監視は全部品で1本だけ共有 |
| `useHeading()` | `{ status, heading }`。北=0 の時計回りの度数(画面の回転も補正済み) |
| `retryLocation()` / `requestCompassPermission()` | 取り直し / iPhone の向きの許可(ボタンのタップ処理の中で呼ぶ) |

## 仕組みのメモ

- 地図は北が上で固定なので、扇形だけを heading の分回す。アバターは回さない。
- 向きは `deviceorientationabsolute`(Android)と `deviceorientation` の `webkitCompassHeading`(iPhone)を両方聞き、北の分かる値だけ使う。4秒来なければ「この端末では取れない」扱い。
- iPhone は初回だけホームでカードを出して許可をもらう(`STORAGE_KEYS.compassPrompted`)。「はい」と答えた人(`compassEnabled`)は、次回から最初のタップで自動的に許可を取り直す。
- 開いたときと「現在地にもどる」を押したあとは、歩くと地図がついてくる。指で地図を動かすとやめる。
