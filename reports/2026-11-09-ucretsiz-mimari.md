# Ücretsiz Mimari Kararı (2026-11-09)

## Bağlam
Proje bir **portföy / öğrenme projesi**; bütçe yok. Hedef: tamamen ücretsiz hizmetlerle, herkesin deneyebileceği canlı bir demo ve GitHub'da düzgün bir repo.

## Karar
| Önceki (ücretli/mainnet) | Yeni (ücretsiz) | Neden |
|---|---|---|
| Robinhood **mainnet** + audit | Robinhood **testnet** (chain 46630), audit yok | Testnet ETH ücretsiz (faucet), gerçek para riski yok → audit gerekmez. README'de "denetlenmemiş, sadece testnet" uyarısı. |
| Mainnet Uniswap v3 | **Kendi Uniswap v3 deploy'umuz** (resmi npm artefaktları) | Testnet'te Uniswap yok. Resmi bytecode kullanıldığı için pool adres hesabı (init code hash) standartla aynı. |
| Hono API + Cloudflare R2 (görseller) | **Zincir üstü metadata**: görsel tarayıcıda 128×128 WebP'ye sıkıştırılır, JSON `data:` URI olarak `metadataURI`'ye yazılır | Backend ve depolama hesabı gerekmez; testnet'te gas ücretsiz. |
| Goldsky subgraph + Ponder | **Tek indexer: Ponder** (token, trade, mum, analytics, holders) | Tek servis, tek veritabanı. Subgraph kodu repoda isteğe bağlı kalır. |
| Railway (indexer) | **Render free web service** | Ücretsiz; 15 dk trafik yoksa uyur, ilk istekte ~1 dk'da uyanır ve kaldığı bloktan devam eder. Demo için yeterli. |
| Postgres (Neon/Railway) | **Neon Free** (1 GB, süresiz) | Render'ın ücretsiz Postgres'i 30 günde siliniyor. |
| Keeper sunucusu | **GitHub Actions cron** (30 dk'da bir `--once`) | Sunucu gerekmez. Private repoda ayda 2000 dk ücretsiz; 30 dk aralık ~1440 dk/ay. |
| Privy (zorunlu) | **Tarayıcı cüzdanı** (MetaMask/Rabby, `injected`); Privy isteğe bağlı | Hesap gerekmez. |
| Alchemy RPC | Public testnet RPC | Demo trafiği için yeterli. |
| Vercel Pro | **Vercel Hobby** | Kişisel, ticari olmayan proje → ücretsiz plan uygun. |

## Kullanıcının açacağı hesaplar (hepsi ücretsiz, GitHub ile giriş)
Vercel, Render, Neon. Ayrıca bir test cüzdanı (MetaMask) ve faucet'ten test ETH'si.

## Mainnet'e dönüş
Kod mainnet'i desteklemeye devam ediyor (`deployments/mainnet.json`, `script/Deploy.s.sol`, `reports/deploy-runbook.md`). Ancak gerçek parayla çalıştırmadan önce audit hâlâ şart.

## Kaynaklar
- Render free: https://agentdeals.dev/vendor/render , https://toolfreebie.com/render-hosting-review/
- Neon Free (resmi FAQ): https://neon.com/faqs/free-plan-limits-and-quotas
- Vercel Hobby (resmi): https://vercel.com/docs/plans/hobby
- Robinhood testnet faucet: https://www.datawallet.com/crypto/get-robinhood-chain-testnet-tokens , https://www.alchemy.com/faucets/robinhood-testnet
