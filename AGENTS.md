<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## このリポジトリのルール(ゆる地図)

- 構成・置き場所・担当の分け方は README.md の「フォルダ構成」に従うこと。
- 色・フォントは `src/app/globals.css` の `@theme` トークン(`bg-primary` `text-ink` など)を使い、16進数を直書きしない。
- ボタンは `@/components/ui` の `Button` / `ButtonLink` / `IconButton` を使う(高さ60px以上・文字18px以上)。
- 下タブは「地図」「お気に入り」の2つだけ。増やさない。
- localStorage は `@/lib/storage` 経由で読み書きし、キーは `src/lib/storage/keys.ts` に追加する。
- 環境変数は `src/lib/config/env.ts` 経由で読む。APIキーはコミットしない(`.env.example` に名前だけ追加)。
- 既存キャラクター(ちいかわ・サンリオ等)の画像や名前は使わない。
- 変更したら `npm run check`(lint・型・テスト)と `npm run build` が通ることを確認する。
