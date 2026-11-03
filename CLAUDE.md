# CLAUDE.md

Senin adın Echo. Kullanıcı sana "Echo" diye seslenecek.

## Agent başlangıç kuralları
- **Başlangıç agent'ı Fable ise:** işe başlamadan önce `fable` ve `codex fleet` skill'lerini oku ve onlara göre çalış.
- **Başlangıç agent'ı Codex ise:** `AGENTS.md`'ye bak. Codex, codex fleet kullanmak zorunda değil; kendi harness'ındaki varsayılan araçları kullanabilir.
- `AGENTS.md`, diğer agent'lar (Codex vb.) için bu dosyanın karşılığıdır; ortak kurallar (dosya yapısı, backlog, const.md) her ikisinde de geçerlidir.

## Dosya yapısı
- `notes.md` — Proje notları, kararlar, mimari ve yol haritası.
- `const.md` — Projenin değişmez gerçekleri: chain ID, RPC, explorer, kontrat adresleri, protokol parametreleri (fee, curve, eşikler). Kodda bir sabit gerektiğinde değeri tahmin etme, buradan al. ⚠️ ile işaretli değerleri kullanmadan önce doğrula. Yeni bir sabit kesinleşince buraya ekle.
- `reports/` — Ek raporlar (araştırmalar, analizler, karşılaştırmalar). Kullanıcı bir rapordan bahsettiğinde veya rapor araması gerektiğinde önce bu klasöre bak. Yeni raporları da buraya yaz.
- `env.example` — Ortam değişkenleri şablonu (gizli bilgi yok). `.env.example` adı kullanılmaz çünkü `.env.*` dosyaları Claude'a kapalı; yeni bir değişken eklendiğinde bu dosyayı güncelle. Gerçek `.env`'yi asla okuma veya yazma.
- `backlog.md` — Açık ve yarıda kalan işler.
- `backlog-log.md` — Backlog'un değişiklik geçmişi (sadece ekleme yapılır).

## Kod yapısı ve komutlar
pnpm + Turborepo monorepo. Ayrıntılar `README.md`'de.
- `apps/web` (Next.js 16 — sürüm eğitim verisinden farklı olabilir, `apps/web/AGENTS.md`'ye bak), `apps/api` (Hono), `packages/contracts` (Foundry), `packages/shared` (chain, adres, curve matematiği).
- Curve matematiği iki yerde yaşar: `packages/contracts` (Solidity) ve `packages/shared/src/curve.ts` (TS). Birini değiştirirsen diğerini ve testlerini de güncelle; sonuçlar birebir aynı olmalı.
- Sabitler üç yerde birebir aynı olmalı: `const.md` → `packages/contracts/src/Constants.sol` → `packages/shared/src`.
- Foundry PATH'te değilse: `export PATH="$PATH:$HOME/.foundry/bin"`.
- Test: `pnpm --filter @launchpad/contracts test` (tümü mainnet fork üzerinde, ~3 dk; hızlı tur için `test:fast`), `pnpm --filter @launchpad/shared test`. Değişiklikten sonra ilgili testleri çalıştır.
- Sözleşme testlerinde `vm.warp` ile zaman ilerletirken mutlak zaman kullan (`t0 + 30`): via-IR, test içinde `block.timestamp`'i önbelleğe alabiliyor.
- Curve sabitlerini değiştirirsen `test/Trade.t.sol` ve `test/Launch.t.sol`'daki TS referans değerlerini `packages/shared` ile yeniden hesapla.

## Backlog kuralları (her oturumda uygula)
Hiçbir iş yarım kalmamalı.
1. **Oturum başında** `backlog.md`'yi oku; açık işleri göz önünde bulundur.
2. **Bir işi yarıda bırakırsan** (oturum biter, kullanıcı konu değiştirir, bir şeye takılırsın) `backlog.md`'ye ekle: nerede kaldığını ve sonraki adımı yaz. `backlog-log.md`'ye `EKLENDİ` kaydı düş.
3. **Bir backlog işi ilerlerse** `backlog.md`'deki durumunu güncelle, log'a `GÜNCELLENDİ` kaydı düş.
4. **Bir iş bittiğinde** `backlog.md`'den sil (temiz tut) ve `backlog-log.md`'ye `TAMAMLANDI` kaydı düş: ne yapıldı, sonuç nerede.
5. Gereksiz kalan işler silinir, log'a `İPTAL` + nedeni yazılır.
6. `backlog-log.md`'den asla kayıt silme; en yeni kayıt en üste.
