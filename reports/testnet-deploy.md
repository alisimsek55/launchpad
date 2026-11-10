# Testnet'e Ücretsiz Yayın Rehberi

Tüm hizmetler ücretsiz planlarda; kredi kartı gerekmez. **[SEN]** işaretli adımlar hesap/anahtar gerektirir, gerisini Echo yapar.
Mimari gerekçesi: [2026-11-09-ucretsiz-mimari.md](2026-11-09-ucretsiz-mimari.md).

## 1. Cüzdanlar ve test ETH'si **[SEN]** — ✅ 2026-11-10
1. Tarayıcına **MetaMask** veya **Rabby** kur, yeni bir cüzdan oluştur (bu proje için ayrı, sadece testnet).
2. İki hesap kullan:
   - **Deployer**: sözleşmeleri deploy eder (≈0.01 test ETH yeter).
   - **Keeper**: DCA alımlarını yapar (≈0.01 test ETH).
3. Faucet'ten test ETH al (ücretsiz): resmi faucet `faucet.testnet.chain.robinhood.com`, alternatifler Chainlink, QuickNode, Alchemy faucet'leri (bazıları mainnet'te az bakiye ister).
4. Deployer anahtarını Foundry'ye şifreli olarak ekle (anahtar dosyada durmaz, terminal şifre sorar):
```bash
cast wallet import deployer --interactive
```

## 2. Sözleşmeleri deploy et (Echo, sen sadece şifreyi girersin) — ✅ 2026-11-10

`FOUNDRY_PROFILE=testnet`: ETH miktarları 1/1000 (graduation 0.0042 ETH), faucet'in günlük 0.01 ETH'siyle graduation görülebilsin diye.
```bash
cd packages/contracts
FOUNDRY_PROFILE=testnet KEEPER=<keeper cüzdan adresi> forge script script/DeployTestnet.s.sol --rpc-url robinhood_testnet --broadcast --account deployer
```
- Script önce **kendi Uniswap v3'ümüzü** (resmi bytecode) kurar, sonra protokolü deploy eder, keeper'ı yetkilendirir ve adresleri `packages/shared/deployments/testnet.json`'a yazar.
- Yerel testnet kopyasında denendi: deploy + graduation + Uniswap swap çalışıyor.
- Sonra: `testnet.json` commit'lenir; `const.md`'ye adresler eklenir.

## 3. Veritabanı: Neon **[SEN: hesap]** — ✅ 2026-11-10
1. neon.com → GitHub ile giriş → **New project** (bölge: Avrupa).
2. **Connection string**'i kopyala (`postgresql://...`). Gizli değer: sadece Render paneline girilecek.

## 4. Indexer: Render **[SEN: hesap]** — ✅ https://launchpad-indexer-nzgy.onrender.com
1. render.com → GitHub ile giriş → **New → Blueprint** → bu repoyu seç (`render.yaml` otomatik okunur).
2. `DATABASE_URL` alanına Neon adresini yapıştır → **Apply**.
3. Servis adresini not al (ör. `https://launchpad-indexer.onrender.com`). Kontrol: `/protocol` uç noktası JSON dönmeli.
- Ücretsiz servis 15 dk trafik yoksa uyur; ilk istekte ~1 dk'da uyanır.

## 5. Web: Vercel **[SEN: hesap]** — ✅ https://launchpad-cyan-nu.vercel.app

Ek ortam değişkeni: `ENABLE_EXPERIMENTAL_COREPACK=1` (Vercel'in pnpm 12 kullanması için).
1. vercel.com → GitHub ile giriş → **Add New → Project** → bu repo.
2. **Root Directory:** `apps/web`. Ortam değişkenleri:
   - `NEXT_PUBLIC_NETWORK` = `testnet`
   - `NEXT_PUBLIC_INDEXER_URL` = Render adresi
3. **Deploy**. Hobby planı kişisel, ticari olmayan projeler için ücretsiz.

## 6. Keeper: GitHub Actions **[SEN: secret]**
1. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Ad: `KEEPER_PRIVATE_KEY`, değer: keeper cüzdanının özel anahtarı (sadece testnet ETH'si olan cüzdan!).
3. `.github/workflows/keeper.yml` 30 dakikada bir çalışır; **Actions** sekmesinden elle de tetiklenebilir. Secret yoksa iş kendini atlar.
- Private repoda ayda 2000 dk ücretsiz; 30 dk aralık ≈1440 dk/ay. Repo public olursa sınırsız.

## 7. Kontrol
- Siteden MetaMask ile bağlan (site ağı eklemeyi önerir) → token oluştur → al → sat.
- Analytics ve holders verisi geliyor mu (indexer uyanık mı)?
- Küçük bir DCA planı aç; en geç 30 dk içinde keeper ilk alımı yapmalı.

## Maliyet
Hepsi ücretsiz. Tek "gider" faucet'ten alınan test ETH'si (değersiz). Ücretli plana geçmek gerekmiyor.
