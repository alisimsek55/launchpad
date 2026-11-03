import type { Metadata } from "next";
import { deployment } from "@/config";

export const metadata: Metadata = { title: "Docs · Launchpad" };

const SECTIONS = [
  { id: "nasil", title: "Nasıl çalışır?" },
  { id: "curve", title: "Bonding curve" },
  { id: "graduation", title: "Graduation" },
  { id: "fee", title: "Fee'ler" },
  { id: "sniper", title: "Sniper koruması" },
  { id: "creator", title: "Creator kazancı" },
  { id: "dca", title: "DCA" },
  { id: "guvenlik", title: "Güvenlik ve riskler" },
  { id: "kontratlar", title: "Kontrat adresleri" },
];

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-6 pt-6 text-xl font-semibold">
      {children}
    </h2>
  );
}

export default function DocsPage() {
  const contracts: [string, string][] = [
    ["TokenFactory", deployment.tokenFactory],
    ["BondingCurve", deployment.bondingCurve],
    ["Graduator", deployment.graduator],
    ["LPLocker", deployment.lpLocker],
    ["FeeVault", deployment.feeVault],
    ["DCAVault", deployment.dcaVault],
  ];
  return (
    <div className="grid gap-10 lg:grid-cols-[200px_1fr]">
      <nav className="hidden space-y-1 text-sm lg:sticky lg:top-6 lg:block lg:self-start">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="block text-muted hover:text-foreground">
            {s.title}
          </a>
        ))}
      </nav>

      <article className="max-w-3xl space-y-3 text-sm leading-7 text-zinc-300 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Docs</h1>
        <p>Robinhood Chain üzerinde, herkesin birkaç saniyede token çıkarabildiği ve adil başlangıçlı bir launchpad.</p>

        <H id="nasil">Nasıl çalışır?</H>
        <ol className="space-y-1">
          <li>Creator token&apos;ı oluşturur: isim, ticker, görsel. Toplam arz her zaman <strong>1.000.000.000</strong>.</li>
          <li>Token önce <strong>bonding curve</strong> üzerinde işlem görür: fiyat matematiksel bir formülle belirlenir, alım fiyatı yükseltir, satım düşürür.</li>
          <li>Curve&apos;de <strong>4.2 ETH</strong> toplandığında token <strong>graduate</strong> olur: likidite otomatik olarak Uniswap v3&apos;e taşınır ve sonsuza kadar kilitlenir.</li>
        </ol>
        <p>Ön satış, ekip payı ya da gizli arz yoktur; herkes aynı curve&apos;den alır.</p>

        <H id="curve">Bonding curve</H>
        <p>
          Sanal rezervli sabit çarpım modeli: <code className="text-foreground">x · y = k</code>. Curve 1.4 ETH sanal ETH rezerviyle başlar.
          Arzın <strong>%80&apos;i (800M)</strong> curve&apos;de satılır; kalan <strong>%20 (200M)</strong> graduation&apos;da Uniswap likiditesine gider.
        </p>
        <ul>
          <li>Başlangıç fiyatı ≈ 0.0000000013 ETH (market cap ≈ 1.31 ETH)</li>
          <li>Graduation fiyatı ≈ 0.000000021 ETH (market cap = 21 ETH), başlangıcın 16 katı</li>
          <li>Curve&apos;e her zaman geri satabilirsin; curve her satışı karşılayacak ETH&apos;yi tutar.</li>
        </ul>

        <H id="graduation">Graduation</H>
        <p>
          Eşiği aşan alımda yalnızca kalan token satılır, fazla ETH iade edilir. Aynı işlemde: toplanan 4.2 ETH ve 200M token ile Uniswap v3&apos;te
          <strong> %1 fee tier, tam aralık</strong> pozisyon açılır. Pool fiyatı curve&apos;ün son fiyatına <strong>birebir eşittir</strong>, geçişte fiyat sıçramaz.
          LP NFT&apos;si <strong>LPLocker</strong>&apos;da kilitlidir: likiditeyi çekecek bir fonksiyon yoktur (rug pull mümkün değil).
        </p>

        <H id="fee">Fee&apos;ler</H>
        <ul>
          <li><strong>İşlem fee&apos;si %1</strong>: %0.7 protokol, %0.3 creator. Alım ve satımda ETH tarafından kesilir.</li>
          <li><strong>Launch fee&apos;si 0.0005 ETH</strong> (spam önleme).</li>
          <li>Graduation fee&apos;si yok.</li>
          <li>Graduation sonrası Uniswap&apos;in %1 LP fee&apos;i de aynı oranla (%70 / %30) dağıtılır.</li>
        </ul>

        <H id="sniper">Sniper koruması</H>
        <p>
          Launch&apos;tan sonraki ilk <strong>60 saniye</strong> boyunca alım fee&apos;si <strong>%20&apos;den %1&apos;e</strong> doğrusal olarak düşer. Bu, botların ilk saniyede
          arzı toplamasını pahalı hale getirir. Kural adrese değil zamana bağlı olduğu için cüzdan bölerek atlatılamaz. Satışlar her zaman %1&apos;dir ve hiçbir zaman
          engellenmez. Creator, launch işleminde (sniper fee&apos;si olmadan) arzın en fazla <strong>%5&apos;ini</strong> alabilir.
        </p>
        <p>Her alım-satımda <strong>slippage</strong> (varsayılan %1) ve <strong>son geçerlilik süresi</strong> zorunludur.</p>

        <H id="creator">Creator kazancı</H>
        <p>
          Creator her işlemden %0.3 kazanır; graduation sonrası Uniswap LP fee&apos;lerinin %30&apos;u da creator&apos;ındır. Kazançlar <strong>FeeVault</strong>&apos;ta birikir;
          profil sayfasından <strong>Claim</strong> ile çekilir.
        </p>

        <H id="dca">DCA (periyodik alım)</H>
        <p>
          Token sayfasında <strong>DCA</strong> sekmesinden plan açabilirsin: alım başına ETH, aralık (1 saat – 1 hafta) ve alım sayısı. Toplam ETH plana yatırılır;
          keeper zamanı gelince alım yapar ve token&apos;lar doğrudan cüzdanına gelir. İsteğe bağlı <strong>en yüksek fiyat</strong> sınırı zincirde uygulanır.
          Planı istediğin an iptal edip kalan ETH&apos;yi geri alabilirsin. Token graduate olursa alımlar otomatik olarak Uniswap&apos;ten devam eder.
        </p>

        <H id="guvenlik">Güvenlik ve riskler</H>
        <ul>
          <li>Sözleşmeler <strong>yükseltilemez</strong>; token başına kurallar launch anında sabitlenir.</li>
          <li>Admin sadece <strong>yeni launch&apos;ları durdurabilir</strong>; alım-satım ve claim hiçbir zaman durdurulamaz.</li>
          <li>Token&apos;lar sade ERC-20&apos;dir: mint, vergi, kara liste yok.</li>
          <li>
            <strong>Risk:</strong> memecoin&apos;ler son derece volatildir; yatırdığın her şeyi kaybedebilirsin. Bu sayfa yatırım tavsiyesi değildir.
          </li>
        </ul>

        <H id="kontratlar">Kontrat adresleri</H>
        <p className="text-xs text-muted">Ağ: Robinhood Chain (chain ID {deployment.chainId})</p>
        <table className="w-full text-xs">
          <tbody>
            {contracts.map(([name, addr]) => (
              <tr key={name} className="border-t border-line">
                <td className="py-2 text-foreground">{name}</td>
                <td className="font-mono text-muted">{addr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  );
}
