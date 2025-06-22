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

# Privote Contracts

A private voting protocol built on MACI (Minimal Anti-Collusion Infrastructure) that allows users to deploy multiple private polls according to their needs.

## Features

- Deploy multiple private voting polls
- Support for various authentication policies
- Anonymous voting with privacy guarantees
- Customizable voting options and metadata

## Dynamic Policy Configuration

The join-poll functionality now supports dynamic policy signup data configuration. Instead of hardcoding "0x" for all policies, the system:

1. **Detects Policy Type**: Calls `getTrait()` on the poll's policy contract to determine the policy type
2. **Maps to Configuration**: Maps the trait (e.g., "FreeForAll") to the policy contract name (e.g., "FreeForAllPolicy")
3. **Fetches Signup Data**: Retrieves the `signupDataHex` field from the deployment configuration
4. **Uses Policy-Specific Data**: Passes the appropriate data to the joinPoll function

### Configuring Policy Signup Data

In your `deploy-config.json`, add a `signupDataHex` field to each policy configuration:

```json
{
  "hardhat": {
    "FreeForAllPolicy": {
      "deploy": true,
      "signupDataHex": "0x"
    },
    "EASPolicy": {
      "deploy": false,
      "easAddress": "0xC2679fBD37d54388Ce493F1DB75320D236e1815e",
      "schema": "0xe2636f31239f7948afdd9a9c477048b7fc2a089c347af60e3aa1251e5bf63e5c",
      "attester": "the-attester-address",
      "signupDataHex": "0x1234567890abcdef..."
    },
    "MerkleProofPolicy": {
      "deploy": false,
      "root": "0x2461fcc4c0965cb7f482dd28f1ca8057b7a62a35e8b7a86bb3ad6523f4bb21c0",
      "signupDataHex": "0xabcdef1234567890..."
    }
  }
}
```

### Policy-Specific Signup Data Examples

- **FreeForAllPolicy**: No data needed, use `"0x"`
- **EASPolicy**: Encoded attestation data or proof
- **MerkleProofPolicy**: Merkle proof data for whitelist verification
- **ERC20Policy**: Token balance proof or signature
- **GitcoinPassportPolicy**: Passport verification data
- **SemaphorePolicy**: Semaphore group membership proof

### Usage

When joining a poll, the system automatically:

```bash
npx hardhat join-poll --poll 0 --account 0 --network hardhat
```

The task will:
1. Fetch the poll contract
2. Detect the policy type via `getTrait()`
3. Load the appropriate `signupDataHex` from config
4. Use that data when calling the joinPoll SDK function

### Output Example

```
ℹ Policy trait detected: FreeForAll
ℹ Using FreeForAllPolicy - no signup data required
✅ Successfully joined poll!
   Poll ID: 0
   Account: 0
   Poll State Index: 1
   Voice Credits: 99
   Nullifier: 123456789...
   Transaction Hash: 0xabc123...
   Signup Data Used: 0x
```

## Installation

```bash
npm install
# or
yarn install
```

## Setup

1. Copy the example deploy configuration:
```bash
cp deploy-config-example.json deploy-config.json
```

2. Configure your network settings and policy signup data in `deploy-config.json`

3. Deploy contracts:
```bash
npx hardhat deploy --network <your-network>
```

## Usage

### Create Account
```bash
npx hardhat signup --network hardhat
```

### Join Poll
```bash
npx hardhat join-poll --poll 0 --account 0 --network hardhat
```

### Vote
```bash
npx hardhat vote --poll 0 --account 0 --state-index 1 --vote-option 0 --network hardhat
```

## Testing

Run the test suite:
```bash
npm test
# or
yarn test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
