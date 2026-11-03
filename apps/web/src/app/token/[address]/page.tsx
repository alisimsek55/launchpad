import { Suspense } from "react";
import { TokenView } from "@/components/TokenView";

export default function TokenPage() {
  // useParams() çalışma anında okunur; Next 16'da Suspense içinde olmalı
  return (
    <Suspense fallback={<p className="text-muted">Yükleniyor…</p>}>
      <TokenView />
    </Suspense>
  );
}
