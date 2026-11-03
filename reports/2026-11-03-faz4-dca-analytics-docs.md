# Faz 4 Raporu — DCA, Analytics, Docs (2026-11-03)

## Özet
DCA (periyodik alım) sözleşmesi, keeper servisi, web'de DCA sekmesi, Analytics ve Docs sayfaları yazıldı. DCA akışı yerel fork'ta **tarayıcıdan uçtan uca** test edildi: plan oluşturma → keeper'ın otomatik alımı → zaman ilerletince ikinci alım → iptal ve iade. Tüm sözleşme testleri (39, invariant dahil) geçiyor.

## DCAVault (`packages/contracts/src/DCAVault.sol`)
- `createPlan(token, ethPerBuy, interval, count, maxPrice)`: toplam ETH yatırılır. Sadece launchpad token'ları, aralık ≥ 5 dk, en fazla 1000 alım.
- `execute(planId, minTokensOut)`: **sadece izinli keeper**. Token curve'deyse `BondingCurve.buy`, graduate olduysa Uniswap `SwapRouter02`. Token'lar doğrudan plan sahibine gider.
- `maxPrice` (token başına ETH) zincirde uygulanır; keeper'ın verdiği alt sınırdan bağımsız kullanıcı koruması.
- Graduation'ı tetikleyen alımda curve'ün iade ettiği ETH plana geri yazılır; son alım küsuratı da harcar.
- `cancelPlan`: kalan ETH anında iade.
- **Testler (7):** zamanlama, yetkisiz keeper, iptal/iade, maxPrice koruması, geçersiz plan, graduation sonrası Uniswap'ten alım, graduation iadesinin plana dönmesi.

**Plandan sapma:** notes.md'de graduation sonrası "5 dk TWAP kontrolü" vardı. v1'de keeper izinli (bizim servisimiz) ve kullanıcı `maxPrice` koyabildiği için TWAP eklenmedi; permissionless keeper'a geçilirken (faz 2.0) TWAP şart.

## Keeper (`apps/keeper`)
- Her turda `isDue` ile planları tarar (Multicall3), güncel teklifi (curve `quoteBuy` / Uniswap `QuoterV2`) %3 slippage ile `minTokensOut` yapar, `%20` gas payıyla `execute` gönderir.
- Başarısız plan (ör. fiyat maxPrice'ın üstünde) 10 dk dinlenir.
- `--once` modu ile tek tur.
- Env: `LAUNCHPAD_NETWORK`, `KEEPER_PRIVATE_KEY`, `KEEPER_RPC_URL`, `POLL_MS`, `SLIPPAGE_BPS`.

## Web
- **DCA sekmesi** (trade panelinde Market | DCA): alım başına ETH, sayı, aralık (1s/4s/1g/1h), isteğe bağlı en yüksek fiyat; kullanıcının o token'daki planları, ilerleme ve iptal.
- **Analytics** (`/analytics`): 24h/7d/30d/All özet (hacim, launch, fee, protokol geliri), son 56 günün günlük grafiği (Volume/Launches/Fees/Revenue/Graduations/Trades), ortalama işlem, son 30 günün top token'ları.
- **Docs** (`/docs`): nasıl çalışır, curve matematiği, graduation, fee'ler, sniper koruması, creator kazancı, DCA, güvenlik/riskler, kontrat adresleri.

## Bulunan ve düzeltilen hatalar
1. **Multicall3 zincir tanımında yoktu** → keeper (ve web'in toplu okumaları) çalışmıyordu. Robinhood Chain'de standart adreste (`0xcA11…CA11`) olduğu zincirde doğrulandı, `packages/shared` zincir tanımına ve const.md'ye eklendi.
2. **Next 16: Analytics'te `Date.now()` prerender sırasında** → Suspense ile sarıldı.

## Bilinen sınırlamalar
- Keeper tüm planları her turda tarıyor; plan sayısı binleri geçince event tabanlı indekse geçilmeli.
- Graduation sonrası DCA alımlarında subgraph'taki trader, `tx.from` = keeper olarak görünür (curve alımlarında doğru sahip görünüyor).
