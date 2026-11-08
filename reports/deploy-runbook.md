# Mainnet Deploy Runbook

> Bu rehber **mainnet** (gerçek para) içindir ve audit gerektirir. Proje şu an ücretsiz testnet demosu olarak ilerliyor: [testnet-deploy.md](testnet-deploy.md).

Sırayla uygulanacak adımlar. **[SEN]** işaretli adımlar hesap/anahtar/para gerektirir ve senin yapman gerekir; diğerlerini Echo yapar.

## 0. Ön koşullar
- [ ] Bağımsız audit tamamlandı, bulgular kapatıldı (bkz. `reports/audit-scope.md`). **[SEN: firma seçimi ve ödeme]**
- [ ] CI yeşil (GitHub Actions).

## 1. Hesaplar ve anahtarlar **[SEN]**
| Ne | Neden | Nereye |
|---|---|---|
| **Safe multisig** (Robinhood Chain) | Sözleşme owner'ı: pause, fee çekme, keeper atama | safe.global (zinciri destekliyorsa) — en az 2/3 imza önerilir |
| **Deployer cüzdanı** (donanım cüzdan önerilir) | Deploy işlemlerini imzalar (simülasyon: 8.1M gas ≈ 0.0003 ETH; 0.01 ETH yeter) | Ledger + `forge script --ledger` |
| **Treasury adresi** | LP fee'lerinin token tarafındaki protokol payı | Safe'in kendisi olabilir |
| **Keeper cüzdanı** | DCA execute; sadece gas için az ETH | Yeni, ayrı bir anahtar |
| **Alchemy (veya benzeri) RPC** | Public RPC rate-limit'li | alchemy.com — Robinhood Chain |
| **Privy** | Cüzdan girişi | privy.io → App ID |
| **Goldsky** | Subgraph barındırma | goldsky.com → API key |
| **Cloudflare R2** | Token görselleri | Bucket + public URL + erişim anahtarları |
| **Hosting** | web: Vercel; api/indexer/keeper: Railway veya Fly.io; Postgres: Neon/Railway | — |

Tüm gizli değerler sadece `.env`'ye ve hosting panellerine girilir; repoya asla.

## 2. Sözleşmeleri deploy et
```bash
cd packages/contracts
OWNER=<safe adresi> TREASURY=<treasury adresi> forge script script/Deploy.s.sol --rpc-url robinhood --ledger --broadcast --verify --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/
```
- Script sadece chain ID 4663'te çalışır.
- Çıktıdaki 6 adresi (`FeeVault`, `BondingCurve`, `LPLocker`, `Graduator`, `TokenFactory`, `DCAVault`) ve deploy bloğunu not al.

## 3. Deploy sonrası (Echo)
- [ ] `packages/shared/deployments/mainnet.json`'a adresleri ve `startBlock`'u yaz; `const.md`'ye ekle.
- [ ] `packages/subgraph/subgraph.yaml`'a adresleri ve `startBlock`'u yaz.
- [ ] Doğrulama: `cast call` ile `BondingCurve.factory()`, `LPLocker.graduator()`, owner'lar = Safe.
- [ ] Testnet'te Uniswap olmadığı için: mainnet fork'unda deploy script'ini kuru çalıştır (`--broadcast` olmadan) ve Simulate benzeri bir senaryo koş.

## 4. Safe'ten yapılacak işlemler **[SEN: imza]**
- [ ] `DCAVault.setKeeper(<keeper adresi>, true)`
- [ ] (`Ownable2Step` kullanıldığı için owner Safe olarak verildiyse ek adım yok.)

## 5. Servisler
- [ ] **Subgraph:** `pnpm --filter @launchpad/subgraph build` → `goldsky subgraph deploy launchpad/1.0.0 --path packages/subgraph` (GOLDSKY_API_KEY).
- [ ] **Indexer:** Railway'de `apps/indexer`, env: `LAUNCHPAD_NETWORK=mainnet`, `DATABASE_URL`, `PONDER_RPC_URL_4663`. Komut: `pnpm --filter @launchpad/indexer start`.
- [ ] **API:** `apps/api`, env: R2 değişkenleri, `R2_PUBLIC_URL`, `API_PUBLIC_URL`, `WEB_ORIGIN`.
- [ ] **Keeper:** `apps/keeper`, env: `LAUNCHPAD_NETWORK=mainnet`, `KEEPER_PRIVATE_KEY`, `KEEPER_RPC_URL`.
- [ ] **Web:** Vercel, env: `NEXT_PUBLIC_NETWORK=mainnet`, `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_SUBGRAPH_URL`, `NEXT_PUBLIC_INDEXER_URL`, `NEXT_PUBLIC_API_URL`.
- [ ] Privy panelinde: izinli domain(ler), Robinhood Chain (4663) custom chain.

## 6. Canlıya alma kontrolü
- [ ] Küçük tutarla: token oluştur → al → sat → profilde claim.
- [ ] Subgraph ve indexer yeni token'ı ve işlemleri gösteriyor.
- [ ] DCA: küçük bir plan, keeper ilk alımı yapıyor.
- [ ] İzleme: keeper/indexer/api için uptime + hata alarmı; Safe'te FeeVault bakiyesi takibi.

## Acil durum
- Yeni launch'ları durdur: Safe'ten `TokenFactory.pause()`. (Mevcut token'ların alım-satımı ve çekimler durdurulamaz — bu bilinçli bir tasarım.)
- Keeper'ı kapat: `DCAVault.setKeeper(keeper, false)`; kullanıcılar planlarını her zaman iptal edebilir.
