# ゆる地図(doodle_maps)

スマホ操作に慣れていない人でも迷わず使える、やさしい地図Webアプリです。
大きなボタン(高さ60px以上)・大きな文字・下タブは「地図」「お気に入り」の2つだけ。
デザインはA案「ミルクティー」(クリーム×コーラル、丸ゴシック Zen Maru Gothic)。

## 技術スタック

| 用途 | 使うもの |
| --- | --- |
| フレームワーク | Next.js 16(App Router)+ TypeScript + Tailwind CSS v4 |
| 地図 | MapLibre GL JS + MapTiler のタイル(キー未設定時は OpenFreeMap) |
| 場所検索 | MapTiler Geocoding API |
| ルート | OpenRouteService(サーバー側の Route Handler 経由) |
| 保存 | localStorage(ログインなし) |
| アプリ化 | PWA(`src/app/manifest.ts` + `public/sw.js`) |
| テスト | Vitest + Testing Library |
| CI / デプロイ | GitHub Actions / Vercel |

## はじめかた

```bash
npm install
cp .env.example .env.local   # キーを入れる(なくても地図は出ます)
npm run dev                  # http://localhost:3000
```

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` / `npm start` | 本番ビルド / 起動 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript の型チェック |
| `npm test` | 単体テスト(Vitest) |
| `npm run check` | lint + 型 + テストをまとめて |

CI(`.github/workflows/ci.yml`)は PR と main への push で lint・型チェック・テスト・ビルドを実行します。

### 環境変数

| 名前 | 用途 | 公開範囲 |
| --- | --- | --- |
| `NEXT_PUBLIC_MAPTILER_KEY` | 地図タイル・場所検索 | ブラウザに出る(MapTiler 側で許可ドメインを設定すること) |
| `NEXT_PUBLIC_MAPTILER_STYLE` | 地図の見た目(既定 `streets-v2`) | ブラウザ |
| `ORS_API_KEY` | ルート検索 | サーバーのみ |
| `HERE_API_KEY` | 店・施設の検索(任意。未設定なら MapTiler / OpenStreetMap) | サーバーのみ |

読むときは必ず `src/lib/config/env.ts` を通してください。

## フォルダ構成

画面(ルーティング)は `src/app`、機能のロジックと部品は `src/features/<機能>` に分けています。
機能ごとにフォルダが分かれているので、並行して作業しても衝突しにくい構成です。

```
src/
├─ app/                         … ルーティング(薄く保つ。中身は features から import)
│  ├─ layout.tsx                … <html>、フォント、PWA 登録
│  ├─ globals.css               … デザイントークン(色・フォント・影)
│  ├─ manifest.ts               … PWA マニフェスト
│  ├─ (tabs)/                   … 下タブ付きの画面
│  │  ├─ layout.tsx             … 下タブ(BottomTabBar)
│  │  ├─ page.tsx               … / 地図ホーム
│  │  └─ favorites/page.tsx     … /favorites お気に入り
│  ├─ search/page.tsx           … /search 検索(下タブなし・全画面)
│  └─ api/                      … (予定)Route Handler。ORS などキーを隠す API
├─ components/
│  ├─ ui/                       … 共通部品 Button / ButtonLink / IconButton / Card / ScreenHeader / アイコン
│  ├─ layout/BottomTabBar.tsx   … 下タブ(「地図」「お気に入り」の2つだけ)
│  └─ pwa/                      … Service Worker 登録
├─ features/                    … 機能ごとのフォルダ(担当ごとに分ける)
│  ├─ map/                      … 地図本体 MapView / useMap() / MapOverlay
│  ├─ search/                   … 検索(「どこへ行く？」ボタン、検索画面)
│  ├─ route/                    … ルート案内
│  ├─ location/                 … 現在地・向き表示
│  ├─ avatar/                   … アバター選び(動物5種+写真)
│  └─ favorites/                … お気に入り
├─ lib/
│  ├─ config/                   … env.ts(環境変数)、app.ts(アプリ名)
│  └─ storage/                  … localStorage ラッパーと useStoredState、キー一覧 keys.ts
├─ types/                       … 機能をまたいで使う型(LngLat, Place, Route, Favorite, AvatarChoice)
└─ test/setup.ts                … テスト共通設定
```

各機能フォルダは `index.ts` から外に出すものだけを export します。他の機能からは `@/features/<機能>` で import してください。

### 担当の分け方

| 機能 | 主に触る場所 | 共通部分との接点 |
| --- | --- | --- |
| 検索+ルート案内 | `features/search`, `features/route`, `app/search`, `app/api/route`(新規), 案内中画面 `app/navigate`(新規) | 型 `Place` / `Route`、地図への線は `useMap()` |
| 現在地+向き+アバター | `features/location`, `features/avatar`, アバター画面 `app/avatar`(新規) | `STORAGE_KEYS.avatar` / `compassPrompted`、型 `AvatarChoice` |
| お気に入り | `features/favorites` | `STORAGE_KEYS.favorites`、型 `Favorite` |

共通部分(`components/ui`、`lib`、`types`、`globals.css`、`app/(tabs)/page.tsx`)を変えるときは、追加だけにとどめ、既存の名前や意味は変えないでください。

### 地図の上に部品を置く

地図ホーム(`src/app/(tabs)/page.tsx`)では、`<MapView>` の子として部品を並べます。

```tsx
<MapView>
  <SearchLauncher />      {/* features/search */}
  <LocateButton />        {/* features/location(例) */}
</MapView>
```

部品の中では `MapOverlay` で置き場所を決め、`useMap()` で地図を操作します。

```tsx
"use client";
import { MapOverlay, useMap } from "@/features/map";
import { IconButton, LocateIcon } from "@/components/ui";

export function LocateButton() {
  const { map } = useMap(); // 読みこみ前・失敗時は null
  return (
    <MapOverlay position="bottom-right">
      <IconButton label="現在地にもどる" onClick={() => map?.flyTo({ center: [139.76, 35.68] })}>
        <LocateIcon size={30} />
      </IconButton>
    </MapOverlay>
  );
}
```

置き場所は `top`(検索ボタン・曲がり角の表示)、`bottom-right`(丸いボタン)、`bottom`(案内カード)の3つ。同じ場所に置いた部品は縦に積まれます。

地図は北が常に上(回転・傾きなし)。最後に見ていた位置は `STORAGE_KEYS.mapCamera` に保存され、次に開いたときに復元されます。

### 保存(localStorage)

```tsx
import { STORAGE_KEYS, useStoredState } from "@/lib/storage";

const EMPTY: Favorite[] = []; // fallback は毎回同じ参照を渡す
const [favorites, setFavorites] = useStoredState(STORAGE_KEYS.favorites, EMPTY, isFavoriteList);
```

- 保存名には `doodle_maps:` が付きます。新しいキーは `src/lib/storage/keys.ts` に追加してください。
- 保存に失敗(容量オーバー等)すると setter が `false` を返します。写真アバターは縮小してから保存してください。
- 別タブや同じ画面の別コンポーネントの変更も自動で反映されます。

### デザイン

色は `globals.css` の `@theme` で定義した名前を Tailwind クラスで使います。

| トークン | 色 | 例 |
| --- | --- | --- |
| `primary` / `primary-strong` / `primary-soft` | コーラル #C8524C / #9E3B36 / #F8DCD6 | 主ボタン / 選択中タブの文字 / 選択中タブの背景 |
| `ink` / `ink-soft` | #4A3A33 / #7A6359 | 本文 / 補足 |
| `surface` / `cream` / `card` | #FFF7EF / #FBEFE3 / #FFFFFF | 画面背景 / 地図の地色 / カード |
| `leaf*` `sky*` `honey*` | 緑・青・黄の淡色/濃色 | カテゴリのアイコン |

ボタンは `Button`(`primary` `soft` `white` `dashed`、サイズ `md`=60px / `lg`=64px)、丸いアイコンボタンは `IconButton`(68px、`label` 必須)。

### アニメーション

控えめに使います。短く(150〜300ms)、操作を待たせず、出てくるときだけ動かします(消えるときはすぐ消す)。
`globals.css` に用意したクラスを使ってください。端末の「視差効果を減らす」(`prefers-reduced-motion`)が有効なときは、すべてまとめて止まります。地図の移動(`flyTo` など)は MapLibre が同じ設定を見て自動で止めます。

| クラス | 動き | 使いどころ |
| --- | --- | --- |
| `animate-fade-in` | ふわっと出る(200ms) | 画面・タブの切りかえ(`template.tsx` で適用ずみ)、読みこみ中の表示 |
| `animate-rise-in` | 少し下から出る(220ms) | お知らせ、地図の上に出るカード、エラー表示 |
| `animate-sheet-up` | 下からせり出す(260ms) | シート(`Sheet`) |
| `animate-pop` | 小さく弾む(260ms) | ハートを入れたときなど、押した結果の合図 |

ボタン(`Button` / `IconButton` / 下タブ)は押すと少し縮みます(部品側で対応ずみ)。同じ要素で動きを出し直したいときは `key` を変えます。

## デプロイ

Vercel にこのリポジトリをインポートし、環境変数(上の表)を設定するだけで動きます。
