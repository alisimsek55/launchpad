import type { Address } from "viem";

// Kaynak: const.md — packages/contracts/src/Constants.sol ile aynı olmalı.
export const addresses = {
  4663: {
    weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
    uniV3Factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
    uniV3PositionManager: "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3",
    uniSwapRouter02: "0xCaf681a66D020601342297493863E78C959E5cb2",
    uniQuoterV2: "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7",
    usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", // 6 ondalık
  },
  46630: {
    weth: "0x7943e237c7F95DA44E0301572D358911207852Fa",
  },
} as const satisfies Record<number, Record<string, Address>>;
