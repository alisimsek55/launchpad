# Backlog

Yarıda kalan ve bekleyen işler. Hiçbir iş yarım bırakılmaz: bırakılan her iş buraya yazılır.
Bir iş bitince buradan silinir ve [backlog-log.md](backlog-log.md)'ye kayıt düşülür.

Format:
```
- [ ] **İş başlığı** (eklenme: YYYY-MM-DD)
  - Durum: nerede kaldı
  - Sonraki adım: devam etmek için ilk yapılacak şey
```

## Açık işler

- [ ] **Faz 2.0 fikirleri** (eklenme: 2026-11-03)
  - Durum: Lansman sonrası.
  - Sonraki adım: GMGN/Bitquery entegrasyonu + açık quote API (yüksek öncelik; DexScreener adapter'ı hazır, bkz. aşağıdaki iş); fair launch modu (DCA tabanlı); Uniswap v4 graduation; hisse token eşli lansman; limit emirler; permissionless keeper + TWAP; kullanıcı adı düzenleme.

- [ ] **DexScreener listeleme başvurusu** (eklenme: 2026-11-10)
  - Durum: Adapter uç noktaları indexer'da hazır (`/dexscreener/*`, README "DexScreener entegrasyonu"). Testnet DexScreener'da listelenmediği için başvuru bekliyor.
  - Sonraki adım: Mainnet deploy'undan sonra mainnet indexer'ın `/dexscreener` adresini DexScreener'a bildir (dış hizmet başvurusu; kullanıcı yapar/onaylar).

- [ ] **Mainnet kontrol listesi: DCAVault keeper yetkisi** (eklenme: 2026-11-12)
  - Durum: `Deploy.s.sol` `setKeeper` çağırmıyor ve çağıramaz; mainnet'te owner Safe multisig, `setKeeper` `onlyOwner`. Testnet script'i çağırıyor.
  - Sonraki adım: Mainnet deploy'undan sonra Safe'ten `DCAVault.setKeeper(keeper, true)` işlemini gönder; yoksa tüm `execute()` çağrıları `NotKeeper` ile revert eder. Bkz. `reports/deploy-runbook.md`, `reports/2026-11-12-capraz-kontrol-codex.md`.

- [ ] **Testnet/mainnet redeploy: çapraz kontrol düzeltmeleri** (eklenme: 2026-11-13)
  - Durum: Sözleşme düzeltmeleri kodda ve testli (73/73): sınırlı/devam ettirilebilir graduation (`GraduationPending`, `continueGraduation`), DCA 5 dk TWAP koruması, on-chain `quoteBuy` düzeltmesi + `quoteBuyDetailed`, DCA terminal alım `maxPrice` düzeltmesi, `claimCreatorFees(recipient)` / `cancelPlan(id, recipient)`. Web, indexer (şema değişti: `token.graduationPending`, `pool_token.ethBalanceWei`) ve keeper yeni ABI'ye göre güncellendi. Zincirdeki testnet kontratları eski sürüm.
  - Sonraki adım: `initialize()` tek seferlik olduğundan tüm protokolü (Factory, Curve, Locker, Graduator, DCAVault, FeeVault) yeniden deploy et (testnet: `DeployTestnet.s.sol`); `packages/shared/deployments/*.json`, `const.md`, `subgraph.yaml` ve indexer start block'unu güncelle, `pnpm --filter @launchpad/contracts abis` çalıştır, indexer'ı yeni şemayla baştan indeksle; mainnet'te Safe `setKeeper`. Adımlar: `reports/deploy-runbook.md` "Sonraki deploy". Anvil fork + `Simulate.s.sol` ile pending graduation ve indexer Swap guard'ını uçtan uca dene.
