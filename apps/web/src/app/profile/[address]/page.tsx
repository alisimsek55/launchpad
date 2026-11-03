import { Suspense } from "react";
import { ProfileView } from "@/components/ProfileView";

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="text-muted">Yükleniyor…</p>}>
      <ProfileView />
    </Suspense>
  );
}
