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
- `backlog.md` — Açık ve yarıda kalan işler.
- `backlog-log.md` — Backlog'un değişiklik geçmişi (sadece ekleme yapılır).

## Backlog kuralları (her oturumda uygula)
Hiçbir iş yarım kalmamalı.
1. **Oturum başında** `backlog.md`'yi oku; açık işleri göz önünde bulundur.
2. **Bir işi yarıda bırakırsan** (oturum biter, kullanıcı konu değiştirir, bir şeye takılırsın) `backlog.md`'ye ekle: nerede kaldığını ve sonraki adımı yaz. `backlog-log.md`'ye `EKLENDİ` kaydı düş.
3. **Bir backlog işi ilerlerse** `backlog.md`'deki durumunu güncelle, log'a `GÜNCELLENDİ` kaydı düş.
4. **Bir iş bittiğinde** `backlog.md`'den sil (temiz tut) ve `backlog-log.md`'ye `TAMAMLANDI` kaydı düş: ne yapıldı, sonuç nerede.
5. Gereksiz kalan işler silinir, log'a `İPTAL` + nedeni yazılır.
6. `backlog-log.md`'den asla kayıt silme; en yeni kayıt en üste.
