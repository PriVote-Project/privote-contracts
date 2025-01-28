# PriVote Contracts

## Generating Poll Results

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/PriVote-Project/privote-contracts.git

# Navigate to the project directory
cd privote-contracts

# Install dependencies
yarn install

# Download required zkeys
yarn download-zkeys
```

### Step 2: Environment Setup

Create a `.env` file in the root directory using `.env.example` as a template. The following environment variables are required:

- `INFURA_API_KEY`: Your Infura API key
- `DEPLOYER_PRIVATE_KEY`: Private key of the deployer account
- `ETHERSCAN_API_KEY`: Your Etherscan API key for contract verification
- `LH_API_KEY`: Lighthouse API key for pinning poll results on IPFS

### Step 3: Generate Results

To generate poll results, use the following command:

```bash
yarn hardhat genResults --poll <poll-id> \
  --auth-type <auth-type> \
  --use-quadratic-voting false \
  --output-dir ./proofs \
  --tally-file ./tally.json \
  --coordinator-private-key <private-key>
```

Replace the following parameters:

- `<poll-id>`: The ID of the poll you want to generate results for
- `<auth-type>`: The authentication type (either "free" or "anon")
- `<private-key>`: Your coordinator's private key generated while creating the poll

#### Optional Parameters:

- `--maci-contract-address`: MACI contract address
- `--rapidsnark`: Rapidsnark binary path
- `--process-witgen`: Process witgen binary path
- `--tally-witgen`: Tally witgen binary path

The generated results and proofs will be stored in the specified output directory.

## Note

Make sure all environment variables are properly set before running the tasks. The generated proofs will be used to verify the poll results on-chain while maintaining privacy.
