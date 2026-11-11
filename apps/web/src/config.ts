import { chainFor, curveParamsOf, getDeployment, type Network } from "@launchpad/shared";
import { formatEther } from "viem";

/// local (anvil fork) | testnet (herkese açık demo) | mainnet
export const network = (process.env.NEXT_PUBLIC_NETWORK ?? "testnet") as Network;
export const deployment = getDeployment(network);
export const isLocal = deployment.network === "local";
export const isTestnet = deployment.network === "testnet";

export const chain = chainFor(deployment.chainId, deployment.rpcUrl);

/// İsteğe bağlı: varsa Privy ile giriş, yoksa tarayıcı cüzdanı (MetaMask/Rabby)
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
/// Ponder indexer (tüm veri: tokenlar, işlemler, mumlar, holders, analytics).
/// Boş/boşluk değer "yok" sayılır (env.example boş bırakır; "" olsaydı istekler Next'in kendi
/// /tokens yollarına giderdi). localhost varsayılanı yalnızca yerel ağda veya `next dev`'de kullanılır.
/// Diğer durumlarda build kırılmasın diye (değişken build anında olmayabilir) çözülmesi garanti
/// olmayan `.invalid` adresine (RFC 2606) düşer: istekler hızlıca hata verir, arayüz hata durumunu
/// gösterir ve konsola açık bir mesaj yazılır.
const indexerEnv = process.env.NEXT_PUBLIC_INDEXER_URL?.trim().replace(/\/+$/, "") ?? "";
export const INDEXER_URL_MISSING = !indexerEnv && !isLocal && process.env.NODE_ENV !== "development";
export const INDEXER_URL =
  indexerEnv || (INDEXER_URL_MISSING ? "https://indexer-url-missing.invalid" : "http://localhost:42069");
if (INDEXER_URL_MISSING && typeof window !== "undefined") {
  console.error(`NEXT_PUBLIC_INDEXER_URL tanımlı değil (ağ: ${network}); indexer verisi yüklenemez.`);
}

export const DEFAULT_SLIPPAGE_BPS = 100; // %1

/// Ağa göre değişen curve parametreleri (testnet'te mainnet'in 1/1000'i: graduation 0.0042 ETH)
export const curveParams = curveParamsOf(deployment);
export const GRADUATION_ETH = Number(formatEther(curveParams.graduationEth));
export const LAUNCH_FEE_ETH = formatEther(curveParams.launchFee);
