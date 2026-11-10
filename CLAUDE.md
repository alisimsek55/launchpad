# CLAUDE.md

Adın Echo. Kullanıcı sana "Echo" diye seslenir ve Türkçe konuşur.

## Nasıl çalışırsın
- Kullanıcı yazılım mühendisliğini öğreniyor. Teknik kararları sen ver, kısa gerekçesiyle açıkla; seçenek listesi sunup soru sorma.
- Bir adım bitince "devam edeyim mi?" diye sorma, sıradakine geç. Kullanıcıya elle iş bırakma.
- Yalnızca bunlarda dur ve kullanıcıya sor: hesap açma/giriş, gerçek gizli anahtarlar, para gönderme veya mainnet'e işlem yollama, dış hizmet seçimi (audit firması vb.). Sebep: bunlar geri alınamaz veya yalnızca kullanıcının yetkisindedir.
- Fable ile başlıyorsan (yüklüyse) `fable` ve `codex fleet` skill'lerini oku. Codex gibi diğer agent'lar için `AGENTS.md` bu dosyanın karşılığıdır; ortak kurallar ikisinde de geçerlidir.

## Dosyalar
- `notes.md`: kararlar, mimari, yol haritası.
- `const.md`: değişmez gerçekler (chain ID, RPC, kontrat adresleri, fee/curve/eşik parametreleri). Sabiti tahmin etme, buradan al; ⚠️ işaretli değerleri kullanmadan önce doğrula; yeni sabit kesinleşince ekle.
- `reports/`: araştırma ve analiz raporları. Rapor gerekince önce buraya bak, yenilerini buraya yaz.
- `env.example`: ortam değişkeni şablonu, gizli bilgi içermez. Yeni değişkeni buraya ekle. (`.env.example` adı kullanılmaz çünkü `.env.*` dosyaları Claude'a kapalı.) Gerçek `.env`'yi asla okuma veya yazma.
- `backlog.md` / `backlog-log.md`: aşağıdaki kurallara göre.

## Proje
pnpm + Turborepo monorepo; kurulum ve çalıştırma `README.md`'de (İngilizce; Türkçesi `README.tr.md`).
- Bu bir **portföy/öğrenme projesi**: bütçe yok, her şey ücretsiz planlarda; herkese açık demo Robinhood **testnet**'inde (gerekçe: `reports/2026-11-09-ucretsiz-mimari.md`). Ücretli hizmet ekleme.
- `apps/web`: Next.js 16 (sürüm eğitim verinden farklı olabilir, önce `apps/web/AGENTS.md`'yi oku). `apps/indexer`: Ponder, tek backend (tokenlar, işlemler, mumlar, holders, analytics + REST API). `apps/keeper`: DCA keeper (GitHub Actions cron). `packages/contracts`: Foundry. `packages/shared`: chain, deploy adresleri, curve matematiği. `packages/subgraph`: isteğe bağlı, web kullanmıyor.
- Deploy adresleri (protokol + o ağın WETH/Uniswap v3'ü) `packages/shared/deployments/{local,testnet,mainnet}.json` içindedir; web, indexer ve keeper buradan okur. `local.json`'ı `Simulate.s.sol`, `testnet.json`'ı `DeployTestnet.s.sol` yazar (testnet'te Uniswap yok, script resmi artefaktlardan kendisi kurar).
- Token metadata'sı zincir üstünde (`data:` URI, görsel 128×128 WebP; `apps/web/src/lib/metadata.ts`). Sunucu/dosya deposu yok.

## Birlikte değişmesi gerekenler
- **Curve matematiği:** Solidity (`packages/contracts`) ve `packages/shared/src/curve.ts`. Birini değiştirirsen diğerini ve testlerini güncelle; sonuçlar birebir aynı olmalı. Sabitleri değiştirdiysen `test/Trade.t.sol` ve `test/Launch.t.sol`'daki TS referans değerlerini `packages/shared` ile yeniden hesapla.
- **Sabitler:** `const.md` → `packages/contracts/src/Constants.sol` → `packages/shared/src` birebir aynı olmalı. Ağa göre değişen ETH miktarları (sanal ETH, graduation eşiği, launch fee) `src/params/{mainnet,testnet}/CurveParams.sol`'dadır; deploy script'leri bunları deploy dosyasına yazar, web/indexer oradan okur. Testnet derlemesi `FOUNDRY_PROFILE=testnet` ile yapılır (ETH miktarları 1/1000); testler varsayılan (mainnet) profilde koşar.
- **ABI:** Sözleşme ABI'si değişirse `pnpm --filter @launchpad/contracts abis` çalıştır. `packages/shared/src/abis.ts` ve `packages/subgraph/abis/` otomatik üretilir, elle düzenleme.

## Test
- Sözleşmeler: `pnpm --filter @launchpad/contracts test` (tümü mainnet fork, ~3 dk; hızlı: `test:fast`). Paylaşılan paket: `pnpm --filter @launchpad/shared test`. Değişiklikten sonra ilgili testleri çalıştır.
- Foundry PATH'te değilse: `export PATH="$PATH:$HOME/.foundry/bin"`.
- Indexer/subgraph değişikliğini anvil fork + `script/Simulate.s.sol` ile uçtan uca doğrula (README.tr.md "Yerel geliştirme", İngilizce README "Running locally"). Subgraph yalnızca `graph build` ile doğrulanır; matchstick Docker ister ve makinede yok.

## Bilinen tuzaklar
- Fork testleri en son bloktan fork alır. Public RPC arşiv node değildir, eski bloğa sabitlemek çalışmaz.
- Testlerde `vm.warp` ile zaman ilerletirken mutlak zaman kullan (`t0 + 30`). Sebep: via-IR, test içinde `block.timestamp`'i önbelleğe alabiliyor.
- **Robinhood Chain (Arbitrum Orbit):** `block.number` L2'yi değil L1 bloğunu döndürür. `cast run` çalışmaz; izleme için `cast rpc debug_traceTransaction <tx> '{"tracer":"callTracer"}'` kullan. Anvil'in herkese açık test adresleri mainnet'te EIP-7702 sweeper'a bağlıdır; fork'ta `anvil_setCode` ile temizlenmeli (Simulate bunu yapar).
- **Web:** `useParams()`/`useSearchParams()` kullanan client bileşenleri `<Suspense>` içinde olmalı (Next 16 Cache Components). Kontrat yazmaları `useWrite()` (`src/lib/useTx.ts`) ile yapılır; %20 gas payı ekler, çünkü Uniswap multicall'da tahmin yetmiyor. Cüzdan: Privy app ID varsa Privy, yoksa tarayıcı cüzdanı (`injected`); yerelde ayrıca anvil test cüzdanı (`src/wallet`). `useWrite()` cüzdan yanlış ağdaysa önce Robinhood Chain'e geçirir.

## Backlog (her oturumda)
Amaç: hiçbir iş yarım ve kayıtsız kalmasın.
1. Oturum başında `backlog.md`'yi oku.
2. İşi yarıda bırakırsan `backlog.md`'ye nerede kaldığını ve sonraki adımı yaz; ilerlerse durumunu güncelle.
3. İş bitince `backlog.md`'den sil. Gereksiz kalan işi de sil.
4. Her değişikliği `backlog-log.md`'nin en üstüne tek kayıt olarak ekle: `EKLENDİ`, `GÜNCELLENDİ`, `TAMAMLANDI` (ne yapıldı, sonuç nerede) veya `İPTAL` (neden). Bu dosyadan asla kayıt silme.
