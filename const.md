# Sabitler (Değişmez Gerçekler)

Projede değişmeyen değerler: ağ bilgileri, adresler, protokol parametreleri.
Kodda bir sabit gerektiğinde **önce buraya bak**; yeni bir sabit kesinleşince buraya ekle.

Durum etiketleri:
- ✅ **Doğrulandı** — resmi kaynak + zincirde (`cast call`) teyit edildi
- ⚠️ **Doğrulanmadı** — web kaynaklarından alındı; kullanmadan önce explorer'dan teyit et (bkz. backlog.md)

---

## Repo

| Ad | Değer | Durum |
|---|---|---|
| GitHub | `https://github.com/alisimsek55/launchpad` (private) | ✅ |
| Varsayılan dal | `main` | ✅ |
| Yerel klasör | `C:\Users\alisi\Documents\launchpad` | ✅ |

## Ağ: Robinhood Chain

| Ad | Mainnet | Testnet | Durum |
|---|---|---|---|
| Chain ID | `4663` | `46630` | ✅ (RPC'den teyit) |
| Tip | Arbitrum Orbit L2 | | ✅ |
| Gas token | ETH | ETH | ✅ |
| RPC (public, rate-limit'li) | `https://rpc.mainnet.chain.robinhood.com` | `https://rpc.testnet.chain.robinhood.com` | ✅ |
| Explorer | `https://robinhoodchain.blockscout.com` | `https://explorer.testnet.chain.robinhood.com` | ✅ |
| Goldsky network adı | `robinhood-mainnet` | — | ⚠️ |

Production'da public RPC yerine Alchemy vb. özel RPC kullanılmalı (Robinhood dokümanı public RPC'yi rate-limit'li tanımlıyor).

## Kontrat adresleri (Mainnet)

2026-11-03'te resmi kaynaklarla (Robinhood docs, Uniswap deployments, Paxos) ve zincirde `cast call` ile çapraz kontrol edildi.

| Kontrat | Adres | Durum | Zincir kontrolü |
|---|---|---|---|
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | ✅ | name/symbol = WETH, 18 ondalık |
| Uniswap v3 Factory | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` | ✅ | %1 fee tier aktif (`feeAmountTickSpacing(10000)` = 200) |
| Uniswap v3 NonfungiblePositionManager | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` | ✅ | `factory()` = Factory, `WETH9()` = WETH. Bildirilen tutarsızlık yok (Ethereum'daki `0xC364...` adresi burada geçerli değil). |
| Uniswap SwapRouter02 | `0xCaf681a66D020601342297493863E78C959E5cb2` | ✅ | `factory()` = Factory, `WETH9()` = WETH |
| Uniswap QuoterV2 | `0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7` | ✅ | `factory()`, `WETH9()` doğru |
| USDG (Paxos) | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | ✅ | ⚠️ **6 ondalık** (18 değil!) |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | ✅ | Zincirde kod var, `getBlockNumber()` çalışıyor |
| Uniswap UniversalRouter | `0x8876…0904` veya `0x204F…0498` | ⚠️ | İki resmi kaynak farklı adres veriyor; **kullanmıyoruz** (SwapRouter02 yeterli) |

## Kontrat adresleri (Testnet 46630)

| Kontrat | Adres | Durum |
|---|---|---|
| WETH | `0x7943e237c7F95DA44E0301572D358911207852Fa` | ✅ |
| Uniswap v3 | `packages/shared/deployments/testnet.json` | Resmi Uniswap'ın testnet deploy'u yok; `DeployTestnet.s.sol` resmi npm artefaktlarından kendimiz kuruyoruz (pool init code hash standartla aynı: `0xe34f…8b54`, doğrulandı) |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | ✅ zincirde doğrulandı (2026-11-09) |
| USDG | — | ❌ Testnet'te yok |

**Sonuç:** Uniswap testnet'te olmadığı için graduation testleri **mainnet fork** ile yapılacak (`anvil --fork-url` / Foundry fork testleri).

## Protokol parametreleri

Bunlar tasarım kararlarıdır (gerekçeler notes.md §9-10'da). Bir token'ın parametreleri launch anında sabitlenir.

### Token
| Ad | Değer |
|---|---|
| Toplam arz | `1_000_000_000` (1B) |
| Ondalık | `18` |

### Bonding curve
| Ad | Değer |
|---|---|
| Model | Sanal rezervli constant product (`x · y = k`) |
| Curve'de satılan | `800_000_000` (%80) |
| LP'ye giden token | `200_000_000` (%20) |
| Graduation eşiği | `4.2 ETH` |
| Sanal ETH `x0` | `1.4 ETH` |
| Sanal token `y0` | `1_066_666_667` |
| Başlangıç fiyatı | `1.3125e-9 ETH` |
| Graduation fiyatı | `2.1e-8 ETH` |

### Fee'ler
| Ad | Değer |
|---|---|
| İşlem fee'si | %1 (`100` bps) |
| Protokol payı | %0.5 (`50` bps) |
| Creator payı | %0.5 (`50` bps) |
| Launch fee | `0.0005 ETH` |
| Graduation fee | Yok |
| LP fee dağılımı | %50 protokol / %50 creator |

### MEV koruması
| Ad | Değer |
|---|---|
| Sniper fee süresi | `60` saniye |
| Sniper fee başlangıç | %20 (`2000` bps) → lineer düşüş → %1 |
| Creator dev buy üst sınırı | %5 (`50_000_000` token) |
| Varsayılan slippage (frontend) | %1 |

### Uniswap v3 graduation
| Ad | Değer |
|---|---|
| Fee tier | %1 (`10000`) |
| Pozisyon | Full-range |
| LP NFT | `LPLocker`'da kilitli, çekilemez |

### DCA
| Ad | Değer |
|---|---|
| TWAP penceresi | `5` dakika |
| v1 keeper | Sadece whitelist (kendi servisimiz) |
