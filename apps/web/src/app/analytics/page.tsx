import { Suspense } from "react";
import { Analytics } from "@/components/Analytics";

export default function AnalyticsPage() {
  // Analytics "şimdi"ye göre aralık hesaplar (Date.now); Next 16'da Suspense içinde olmalı
  return (
    <Suspense fallback={<p className="text-muted">Yükleniyor…</p>}>
      <Analytics />
    </Suspense>
  );
}
