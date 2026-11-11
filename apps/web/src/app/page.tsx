import { Hero } from "@/components/Hero";
import { TokenList } from "@/components/TokenList";

export default function Home() {
  return (
    <div className="space-y-10">
      <Hero />
      <section id="tokens" className="scroll-mt-6 space-y-6">
        <h2 className="text-3xl font-semibold tracking-tight">Tokens</h2>
        <TokenList />
      </section>
    </div>
  );
}
