import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { defineChain } from "viem";

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
});

async function main() {
  const artifactPath = path.resolve("./contracts/artifacts/DuelArena.json");
  if (!fs.existsSync(artifactPath)) {
    console.error("Artifact not found! Please run 'node scripts/compileContracts.mjs' first.");
    process.exit(1);
  }

  const { abi, bytecode } = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Read .env.local if exists
  const envLocalPath = path.resolve("./.env.local");
  let envContent = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, "utf8") : "";

  let privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    const match = envContent.match(/DEPLOYER_PRIVATE_KEY=(0x[a-fA-F0-9]{64})/);
    if (match) {
      privateKey = match[1];
    }
  }

  let isBurner = false;
  if (!privateKey) {
    console.log("No DEPLOYER_PRIVATE_KEY found in environment or .env.local.");
    privateKey = generatePrivateKey();
    isBurner = true;
    console.log("Generated fresh deployer key:");
    console.log(`Private Key: ${privateKey}`);

    // Append to .env.local so it persists across runs
    fs.appendFileSync(envLocalPath, `\n# Generated Deployer Key for Monad Testnet\nDEPLOYER_PRIVATE_KEY=${privateKey}\n`);
    console.log("Saved DEPLOYER_PRIVATE_KEY to .env.local.");
  }

  const account = privateKeyToAccount(privateKey);
  console.log(`\nDeployer Address: ${account.address}`);

  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http("https://testnet-rpc.monad.xyz"),
  });

  const walletClient = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http("https://testnet-rpc.monad.xyz"),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer Balance: ${formatEther(balance)} MON`);

  if (balance === 0n) {
    console.error("\n❌ INSUFFICIENT FUNDS ON MONAD TESTNET!");
    console.log(`Please request free testnet MON from the faucet to:`);
    console.log(`👉 ${account.address}`);
    console.log(`Faucet: https://testnet.monad.xyz\n`);
    console.log("Once funded, re-run 'node scripts/deployDuelArena.mjs' to deploy immediately.");
    process.exit(1);
  }

  let treasuryAddress = process.env.NEXT_PUBLIC_HOUSE_TREASURY_ADDRESS;
  if (!treasuryAddress) {
    const match = envContent.match(/NEXT_PUBLIC_HOUSE_TREASURY_ADDRESS=(0x[a-fA-F0-9]{40})/);
    if (match) {
      treasuryAddress = match[1];
    }
  }
  if (!treasuryAddress) {
    treasuryAddress = "0x5A9798AE1abB0b004a4d46a4dC626f87C7513D23";
  }

  console.log(`House Treasury Target: ${treasuryAddress}`);

  console.log("\n🚀 Submitting deployment transaction to Monad Testnet (10143)...");
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [treasuryAddress],
  });

  console.log(`Tx submitted! Hash: ${hash}`);
  console.log("Waiting for confirmation on Monad...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const deployedAddress = receipt.contractAddress;

  console.log(`\n🎉 DuelArena successfully deployed to Monad Testnet!`);
  console.log(`Contract Address: ${deployedAddress}`);
  console.log(`Block Number: ${receipt.blockNumber}`);

  // Update .env.local
  if (deployedAddress && fs.existsSync(envLocalPath)) {
    const updated = fs.readFileSync(envLocalPath, "utf8").replace(
      /NEXT_PUBLIC_DUEL_ARENA_ADDRESS=0x[a-fA-F0-9]{40}/,
      `NEXT_PUBLIC_DUEL_ARENA_ADDRESS=${deployedAddress}`
    );
    fs.writeFileSync(envLocalPath, updated);
    console.log(`Updated NEXT_PUBLIC_DUEL_ARENA_ADDRESS in .env.local to ${deployedAddress}`);
  }
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
