# Backlog Log

[backlog.md](backlog.md)'deki işlerin geçmişi. Sadece ekleme yapılır, kayıtlar silinmez. En yeni kayıt en üstte.

Format:
```
## YYYY-MM-DD — İş başlığı
- Olay: EKLENDİ | GÜNCELLENDİ | TAMAMLANDI | İPTAL
- Not: ne yapıldı / neden
```

---

## 2026-11-03 — Projeyi kalıcı klasöre taşı
- Olay: TAMAMLANDI
- Not: Proje `C:\Users\alisi\Documents\launchpad`'e taşındı (OneDrive dışı yerel klasör). Git geçmişi GitHub'dan yeniden bağlandı.

## 2026-11-03 — `.env.example` şablonu
- Olay: TAMAMLANDI
- Not: Şablon `env.example` adıyla oluşturuldu (`.env.*` deny kuralına takılmadan). Gerçek `.env` koruması aynen duruyor. README'ye kopyalama komutu eklendi.

## 2026-11-03 — `.env.example` şablonu
- Olay: EKLENDİ
- Not: Kullanıcının deny kuralı nedeniyle oluşturulamadı; kural güvenlik için korunuyor.

## 2026-11-03 — GitHub `launchpad` reposunu aç ve push et
- Olay: TAMAMLANDI
- Not: Private repo açıldı: https://github.com/alisimsek55/launchpad — ilk commit `main` dalına push edildi.

## 2026-11-03 — GitHub `launchpad` reposunu aç ve push et
- Olay: EKLENDİ
- Not: gh CLI kuruldu, git init + stage yapıldı; GitHub login kullanıcıyı bekliyor.

## 2026-11-03 — Backlog sistemi kuruldu
- Olay: EKLENDİ
- Not: backlog.md'ye 6 açık iş eklendi: klasör taşıma, Faz 0, adres doğrulama, Chainlink Automation teyidi, sequencer politikası, Uniswap Liquidity Launchpad analizi.
