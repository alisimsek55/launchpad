# Sabitler (Değişmez Gerçekler)

Projede değişmeyen değerler: ağ bilgileri, adresler, protokol parametreleri.
Kodda bir sabit gerektiğinde **önce buraya bak**; yeni bir sabit kesinleşince buraya ekle.

Durum etiketleri:
- ✅ **Doğrulandı** — resmi kaynak veya explorer'dan teyit edildi
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
| Chain ID | `4663` | `46630` | ⚠️ |
| Tip | Arbitrum Orbit L2 | | ⚠️ |
| Gas token | ETH | ETH | ⚠️ |
| RPC | `https://rpc.mainnet.chain.robinhood.com` | — | ⚠️ |
| Explorer | `https://robinhoodchain.blockscout.com` | — | ⚠️ |
| Goldsky network adı | `robinhood-mainnet` | — | ⚠️ |

## Kontrat adresleri (Mainnet)

| Kontrat | Adres | Durum |
|---|---|---|
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | ⚠️ |
| Uniswap v3 Factory | — | ⚠️ bulunacak |
| Uniswap v3 NonfungiblePositionManager | — | ⚠️ bulunacak (tutarsızlık bildirilmiş) |
| Uniswap SwapRouter02 | — | ⚠️ bulunacak |
| USDG (Paxos) | — | ⚠️ bulunacak |

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
| Protokol payı | %0.7 (`70` bps) |
| Creator payı | %0.3 (`30` bps) |
| Launch fee | `0.0005 ETH` |
| Graduation fee | Yok |
| LP fee dağılımı | %70 protokol / %30 creator |

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
