import { task, types } from "hardhat/config";

import { IMergeParamsExtended } from "./merge";

const MAX_BLOCKS_PER_BATCH = 100000;

task("genResults", "Generate results")
  .addParam("poll", "The poll id", undefined, types.string)
  .addParam("outputDir", "Output directory for proofs", undefined, types.string)
  .addParam("coordinatorPrivateKey", "Coordinator maci private key", undefined, types.string)
  .addParam("authType", "The authentication type", undefined, types.string)
  .addOptionalParam("maciContractAddress", "MACI contract address", undefined, types.string)
  .addOptionalParam("useQuadraticVoting", "Use quadratic voting", false, types.boolean)
  .addOptionalParam("rapidsnark", "Rapidsnark binary path", undefined, types.string)
  .addOptionalParam("processWitgen", "Process witgen binary path", undefined, types.string)
  .addParam("tallyFile", "The file to store the tally proof", undefined, types.string)
  .addOptionalParam("tallyWitgen", "Tally witgen binary path", undefined, types.string)
  .addOptionalParam("stateFile", "The file with the serialized maci state", undefined, types.string)
  .addOptionalParam("startBlock", "The block number to start fetching logs from", undefined, types.int)
  .addOptionalParam("blocksPerBatch", "The number of blocks to fetch logs from", MAX_BLOCKS_PER_BATCH, types.int)
  .addOptionalParam("endBlock", "The block number to stop fetching logs from", undefined, types.int)
  .addOptionalParam("transactionHash", "The transaction hash of the first transaction", undefined, types.int)
  .setAction(
    async (
      {
        outputDir,
        poll,
        coordinatorPrivateKey,
        authType,
        maciContractAddress,
        useQuadraticVoting,
        stateFile,
        rapidsnark,
        processWitgen,
        tallyWitgen,
        tallyFile,
        startBlock,
        blocksPerBatch,
        endBlock,
        transactionHash,
      },
      hre,
    ) => {
      const mergeArgs: IMergeParamsExtended = {
        poll,
        maciContractAddress,
        authType,
      };

      // run merge tasks
      await hre.run("merge", mergeArgs);

      const proveArgs = {
        outputDir,
        poll,
        coordinatorPrivateKey,
        authType,
        maciContractAddress,
        useQuadraticVoting,
        stateFile,
        rapidsnark,
        processWitgen,
        tallyWitgen,
        tallyFile,
        startBlock,
        blocksPerBatch,
        endBlock,
        transactionHash,
      };

      // run prove tasks
      await hre.run("prove", proveArgs);
    },
  );
