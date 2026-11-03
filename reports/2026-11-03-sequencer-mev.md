# Robinhood Chain Sequencer ve MEV Varsayımı (2026-11-03)

Soru: MEV stratejimiz "sequencer FCFS, public mempool yok → sandwich riski düşük, asıl tehdit sniper botları" varsayımına dayanıyor. Doğru mu?

## Bulgular

| Konu | Sonuç | Güven |
|---|---|---|
| Sıralama | **FCFS.** Resmi doküman: ücreti artırmak öne geçirmez ([differences-from-ethereum](https://docs.robinhood.com/chain/differences-from-ethereum)) | Doğrulandı |
| Timeboost (express lane) | **Kapalı.** RPC'de `timeboost_*` metotları yok, receipt'lerde `timeboosted` alanı yok ([CoinDesk, 9 Eki 2026](https://www.coindesk.com/business/2026/10/09/robinhood-chain-considers-technology-that-gives-paying-traders-priority)) | Doğrulandı |
| Priority fee | Sıralamayı etkilemiyor: `eth_maxPriorityFeePerGas = 0`; 41 blokta düşük tip'li işlemler sık sık önde | Doğrulandı |
| Public mempool | Yok (`txpool_content` desteklenmiyor) | Muhtemel-yüksek |
| Sequencer feed | Herkese açık **sıralanmış** işlem feed'i var (`wss://feed.mainnet.chain.robinhood.com`); botlar yeni token'ı milisaniyeler içinde görür | Doğrulandı |
| Sequencer | Merkezi, tek; uyum (sanctions) taraması sequencer'da | Doğrulandı |
| Blok süresi | **~100 ms** (RPC ölçümü: 100.000 blok ≈ 10.200 sn) | Doğrulandı |
| Gelecek | Arbitrum, Timeboost yerine **Priority Gas Auctions (PGA)** getirdi (24 Eyl 2026); Robinhood bunu **değerlendiriyor**, tarih yok ([PGA dokümanı](https://docs.arbitrum.io/how-arbitrum-works/priority-gas-auction/pga)) | Takip edilmeli |

## Değerlendirme (Echo)

1. **Varsayım bugün geçerli.** Sandwich zor (bekleyen işlem görünmüyor, tip ile öne geçilemiyor). Tehdit: feed'i dinleyip aynı/bir sonraki 100 ms'lik blokta alan sniper'lar. Tasarım buna göre doğru.
2. **60 sn azalan sniper fee'si yeterli.** `block.timestamp` saniye hassasiyetinde; ilk saniyedeki ~10 blok tam **%20** öder, 1. saniyede ~%19.7. Sniper'ların yoğunlaştığı ilk bloklar zaten en yüksek fee'yi ödüyor. Değişiklik gerekmiyor.
3. **Reddedilen öneri — `block.number` ile hesaplama:** Robinhood Chain'de (Arbitrum Orbit) Solidity `block.number` **L1** blok numarasıdır (~12 sn'de bir artar), yani daha kaba olur. L2 blok için `ArbSys(100).arbBlockNumber()` gerekir; saniye hassasiyeti bu amaç için yeterli olduğundan eklenmedi.
4. **Reddedilen öneri — cüzdan başına alım limiti:** Cüzdan bölerek atlatılır (sybil); zamana bağlı fee bu yüzden seçildi (notes.md §10).
5. **PGA gelirse:** Sniping bir tip ihalesine döner ama sniper fee'si tip'ten bağımsız ve kontrat içinde kalır; koruma geçerliliğini korur. Sadece sniper'ların ödediği toplam maliyet artar. Yapılacak: Robinhood [notices](https://docs.robinhood.com/chain/notices-and-upgrades) sayfasını takip etmek; PGA aktif olursa sniper verisine (indexer'da ilk 60 sn alımları) bakıp eğriyi yeni token'lar için yeniden kalibre etmek (parametreler token başına launch'ta sabitlendiği için mevcut token'lar etkilenmez).
6. **Not:** Sequencer uyum taraması yaptığı için yaptırımlı adreslerle ilişkili işlemler zincire girmez; bizim tarafta ek bir şey gerekmiyor.
