import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const contractsDir = path.resolve("./contracts");
const arenaSource = fs.readFileSync(path.join(contractsDir, "DuelArena.sol"), "utf8");
const interfaceSource = fs.readFileSync(path.join(contractsDir, "interfaces/IDuelArena.sol"), "utf8");

const input = {
  language: "Solidity",
  sources: {
    "DuelArena.sol": {
      content: arenaSource,
    },
    "interfaces/IDuelArena.sol": {
      content: interfaceSource,
    },
  },
  settings: {
    viaIR: true,
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode"],
      },
    },
  },
};

console.log("Compiling DuelArena.sol with solc...");
const output = JSON.parse(solc.compile(JSON.stringify(input)));

let hasErrors = false;
if (output.errors) {
  for (const error of output.errors) {
    if (error.severity === "error") {
      console.error(error.formattedMessage);
      hasErrors = true;
    } else {
      console.warn(error.formattedMessage);
    }
  }
}

if (hasErrors) {
  process.exit(1);
}

const contract = output.contracts["DuelArena.sol"]["DuelArena"];
const abi = contract.abi;
const bytecode = contract.evm.bytecode.object;

const outDir = path.resolve("./contracts/artifacts");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(
  path.join(outDir, "DuelArena.json"),
  JSON.stringify({ abi, bytecode: `0x${bytecode}` }, null, 2)
);

console.log(`Successfully compiled DuelArena! Bytecode length: ${bytecode.length} hex chars.`);
console.log(`Artifact saved to ${path.join(outDir, "DuelArena.json")}`);
