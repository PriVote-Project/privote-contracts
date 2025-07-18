# PriVote Contracts

A private voting protocol built on MACI (Minimal Anti-Collusion Infrastructure) that allows users to deploy multiple private polls according to their needs in just few clicks.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Configuration](#configuration)
  - [Deploy Configuration](#deploy-configuration)
  - [Poll Configuration Options](#poll-configuration-options)
  - [Account Configuration](#account-configuration)
- [Basic Voting Flow](#basic-voting-flow)
  - [Step 1: Deploy Full Setup](#step-1-deploy-full-setup)
  - [Step 2: Deploy Poll](#step-2-deploy-poll)
  - [Step 3: Create User Account](#step-3-create-user-account)
  - [Step 4: Join Poll](#step-4-join-poll)
  - [Step 5: Cast Votes](#step-5-cast-votes)
  - [Step 6: Generate Results (After Poll Ends)](#step-6-generate-results-after-poll-ends)
- [Policy Configuration and Evidence Generation](#policy-configuration-and-evidence-generation)
  - [Manual Policy Configuration in deploy-config.json](#manual-policy-configuration-in-deploy-configjson)
  - [Generate Account Evidence](#generate-account-evidence)
  - [Optional: Deploy Test Contracts](#optional-deploy-test-contracts)
- [Account Management](#account-management)
  - [Create Account Config (Optional)](#create-account-config-optional)
  - [Default Account Behavior](#default-account-behavior)
- [PrivoteWrapper (Advanced)](#privotewrapper-advanced)
  - [PrivoteWrapper vs Basic Privote](#privotewrapper-vs-basic-privote)
  - [PrivoteWrapper Deployment](#privotewrapper-deployment)
  - [PrivoteWrapper Poll Creation](#privotewrapper-poll-creation)
  - [PrivoteWrapper Benefits](#privotewrapper-benefits)
  - [When to Use PrivoteWrapper](#when-to-use-privotewrapper)
- [Quick Start (Automated Flow)](#quick-start-automated-flow)
- [Dynamic Policy Configuration](#dynamic-policy-configuration)
- [Policy-Specific Notes](#policy-specific-notes)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)
- [Note](#note)

## Features

- Deploy multiple private voting polls
- Support for various authentication policies
- Anonymous voting with privacy guarantees
- Customizable voting options and metadata
- Dynamic policy configuration with automatic signup data handling
- Seamless integration with privote-frontend

## Installation

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

## Environment Setup

Create a `.env` file in the root directory using `.env.example` as a template. The following environment variables are required:

- `INFURA_API_KEY`: Your Infura API key
- `DEPLOYER_PRIVATE_KEY`: Private key of the deployer account
- `ETHERSCAN_API_KEY`: Your Etherscan API key for contract verification (optional)

## Configuration

### Deploy Configuration

All deployment and poll settings are managed through `deploy-config.json`. This file controls:

- **Policy Configuration**: Which authentication policies to deploy and their settings
- **MACI Settings**: State tree depth, message batch size, voting mode  
- **Poll Configuration**: Duration, vote options, coordinator keys, and **policy selection**

You can customize any poll configuration before deploying. The `policy` field in the Poll section determines which authentication policy the poll will use.

Example configuration structure:
```json
{
  "hardhat": {
    "FreeForAllPolicy": {
      "deploy": true
    },
    "ERC20Policy": {
      "deploy": false,
      "token": "0x...",
      "threshold": 100
    },
    "MerkleProofPolicy": {
      "deploy": false,
      "root": "0x2461fcc4c0965cb7f482dd28f1ca8057b7a62a35e8b7a86bb3ad6523f4bb21c0"
    },
    "MACI": {
      "stateTreeDepth": 10,
      "policy": "FreeForAllPolicy"
    },
    "Poll": {
      "name": "My Custom Poll",
      "metadata": "Description of my poll",
      "pollStartDate": 0,
      "pollEndDate": 0,
      "duration": 600,
      "coordinatorPublicKey": "macipk.afec0cff00d1e254be6a769fcc7b7a151fbc8e5f58cfae5ed8da7ec1f04a227d",
      "mode": 0,
      "policy": "MerkleProofPolicy",
      "relayers": "0x0000000000000000000000000000000000000000",
      "initialVoiceCreditProxy": "ConstantInitialVoiceCreditProxy",
      "voteOptions": 3,
      "stateTreeDepth": 10,
      "options": [
        "Option 1",
        "Option 2", 
        "Option 3"
      ],
      "optionInfo": [
        "0x0000000000000000000000000000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000000000000000000000000000002",
        "0x0000000000000000000000000000000000000000000000000000000000000003"
      ]
    }
  }
}
```

#### Poll Configuration Options

You can customize these poll settings before deployment:

- **`name`**: Display name for your poll
- **`metadata`**: Description or additional information about the poll
- **`duration`**: How long the poll runs (in seconds)
- **`policy`**: Which authentication policy to use (e.g., "FreeForAllPolicy", "MerkleProofPolicy", "EASPolicy", etc.)
- **`mode`**: Voting mode (0 = QV, 1 = Non-QV)
- **`voteOptions`**: Number of voting options
- **`options`**: Array of option names/descriptions
- **`coordinatorPublicKey`**: MACI public key of the poll coordinator
- **`initialVoiceCreditProxy`**: Voice credit allocation method

**Important**: The `policy` field determines which authentication policy users must satisfy to join the poll. Make sure the chosen policy is properly configured in the same config file.



### Account Configuration

User accounts and their policy evidence are stored in `account-config.json`. Each account has:

- **MACI Keypair**: Deterministic private/public keys tied to the signer's address
- **Policy Evidence**: Authentication data required by different policies (e.g., merkle proofs, attestation IDs)

Example account configuration:
```json
{
  "0": {
    "signerAddress": "0x...",
    "maciPrivateKey": "macisk...",
    "maciPublicKey": "macipk...",
    "MerkleProofPolicyEvidence": "0x...",
    "EASPolicyEvidence": "0x...",
    "TokenPolicyEvidence": "0x..."
  },
  "1": {
    "signerAddress": "0x...",
    "maciPrivateKey": "macisk...",
    "maciPublicKey": "macipk...",
    "EASPolicyEvidence": "0x..."
  }
}
```

**Note**: Account config is only needed for signup, joining polls, and voting. You can create and deploy polls without any account configuration.

## Basic Voting Flow

### Step 1: Deploy Full Setup

Deploy all contracts including MACI, policies, and supporting infrastructure:

```bash
yarn hardhat deploy-full --network <network>
```

### Step 2: Deploy Poll

Create a new poll using the configuration from `deploy-config.json`:

```bash
yarn hardhat deploy-poll --network <network>
```

### Step 3: Create User Account

Generate a MACI keypair and register with the system:

```bash
# Sign up to the Privote system (creates account config automatically)
yarn hardhat signup --network <network>
```

This automatically:
1. Creates account config if it doesn't exist (defaults to account 0)
2. Generates a deterministic MACI keypair tied to the signer's address
3. Stores account data in `account-config.json` 
4. Registers the account with the Privote contract using appropriate policy evidence

For multiple accounts:
```bash
# Signup account 1
yarn hardhat signup --account 1 --network <network>

# Signup account 2  
yarn hardhat signup --account 2 --network <network>
```

### Step 4: Join Poll

Users must join the poll with their account:

```bash
yarn hardhat join-poll --poll 0 --network <network>
```

The system automatically:
1. Detects the poll's policy type
2. Retrieves the appropriate policy evidence from `account-config.json` (defaults to account 0)
3. Uses the evidence to join the poll

For multiple accounts:
```bash
yarn hardhat join-poll --poll 0 --account 1 --network <network>
```

### Step 5: Cast Votes

Vote on the poll options using your account:

```bash
# Multiple votes (quadratic voting) - recommended
yarn hardhat vote --poll 0 --votes "0:5,1:30" --network <network>

# Single vote (if needed)
yarn hardhat vote --poll 0 --state-index 1 --vote-option 0 --network <network>
```

For multiple accounts:
```bash
yarn hardhat vote --poll 0 --account 1 --votes "0:10,1:15" --network <network>
```

### Step 6: Generate Results (After Poll Ends)

Once the poll duration has ended, generate and verify results:

#### 6.1: Merge Signups
```bash
yarn hardhat merge --poll <poll-id> --network <network>
```

#### 6.2: Generate and Submit Proofs
```bash
yarn hardhat prove --poll <poll-id> \
  --output-dir ./out-dir/ \
  --coordinator-private-key <coordinator-private-key> \
  --tally-file ./out-dir/tally.json \
  --submit-on-chain \
  --network <network>
```

Replace the following parameters:

- `<poll-id>`: The ID of the poll you want to generate results for
- `<network>`: The network name (e.g., hardhat, sepolia, mainnet)
- `<coordinator-private-key>`: Your coordinator's MACI private key generated while creating the poll

#### Optional Parameters for Prove Command:

- `--rapidsnark`: Rapidsnark binary path
- `--message-processor-witness-generator`: MessageProcessor witness generator binary path
- `--vote-tally-witness-generator`: VoteTally witness generator binary path
- `--state-file`: File with serialized MACI state
- `--start-block`: Block number to start fetching logs from
- `--blocks-per-batch`: Number of blocks to fetch logs from
- `--end-block`: Block number to stop fetching logs from

## Policy Configuration and Evidence Generation

For policies requiring specific authentication, you need to configure contract addresses and generate account evidence before signup.

#### Manual Policy Configuration in deploy-config.json

Most policies require you to configure contract addresses and parameters in `deploy-config.json` manually:

**ERC20 Policy**: Add your token contract address and threshold:
```json
"ERC20Policy": {
  "deploy": false,
  "token": "0x...", // Your ERC20 token address
  "threshold": 100  // Minimum token balance required
}
```

**ERC20Votes Policy**: Add your token contract address and threshold:
```json
"ERC20VotesPolicy": {
  "deploy": false,
  "token": "0x...", // Your ERC20Votes token address
  "threshold": 100, // Minimum token balance required
  "snapshotBlock": 1 // Block number of snapshot
}
```

**EAS Policy**: Configure your EAS deployment details:
```json
"EASPolicy": {
  "deploy": false,
  "easAddress": "0x...", // Your EAS contract address
  "schema": "0x...", // Your schema ID
  "attester": "0x..." // Trusted attester address
}
```

**Token Policy**: Add your NFT contract address:
```json
"TokenPolicy": {
  "deploy": false,
  "token": "0x..." // Your ERC721 contract address
}
```

**MerkleProof Policy**: Configure your merkle root:
```json
"MerkleProofPolicy": {
  "deploy": false,
  "root": "0x..." // Your merkle root
}
```

**GitcoinPassport Policy**: Configure your Gitcoin Passport decoder:
```json
"GitcoinPassportPolicy": {
  "deploy": false,
  "decoderAddress": "0x...", // Your Gitcoin Passport decoder contract
  "passingScore": 5 // Minimum score required to pass
}
```

**AnonAadhaar Policy**: Configure your AnonAadhaar verifier:
```json
"AnonAadhaarPolicy": {
  "deploy": false,
  "verifierAddress": "0x...", // Your AnonAadhaar verifier contract
  "nullifierSeed": "4534",
  // this pubkeyhash is for testnet
  "pubkeyHash": "15134874015316324267425466444584014077184337590635665158241104437045239495873"
}
```

#### Generate Account Evidence

Each account needs specific evidence for the configured policy. Policy evidence is stored in `account-config.json`:

**MerkleProof Policy** (can generate both root and evidence):
```bash
# Generate merkle root and evidence for defaultaccount 0
yarn hardhat generate-merkle-proof-data --create-tree --whitelist ./whitelist.json --update-config --network <network>

# Generate evidence for current signer (account 0)
yarn hardhat generate-merkle-proof-data --create-tree --update-config --network <network>

# Generate evidence for different account
yarn hardhat generate-merkle-proof-data --account 1 --update-config --network <network>
```

Create `whitelist.json` with addresses:
```json
[
  "0x1234567890abcdef1234567890abcdef12345678",
  "0xabcdef1234567890abcdef1234567890abcdef12",
  "0x..."
]
```

**EAS Policy**:
```bash
# Generate evidence with existing attestation for account 0
yarn hardhat generate-eas-data --attestation-id 0x... --update-config --network <network>

# Generate evidence for different account
yarn hardhat generate-eas-data --attestation-id 0x... --account 1 --update-config --network <network>
```

**Token Policy**:
```bash
# Generate evidence with specific token ID for account 0
yarn hardhat generate-token-data --token-id 5 --update-config --network <network>

# Generate evidence for different account
yarn hardhat generate-token-data --token-id 10 --account 1 --update-config --network <network>
```

**AnonAadhaar Policy**:
```bash
# AnonAadhaar
yarn hardhat generate-anon-aadhaar-data --update-config --network <network>
```



#### Optional: Deploy Test Contracts

For testing purposes, you can deploy mock contracts:

```bash
# Deploy test EAS ecosystem and generate evidence
yarn hardhat generate-eas-data --deploy --create-simple-attestation --update-config --network <network>

# Deploy test ERC20 token
yarn hardhat generate-erc20-data --deploy --update-config --network <network>

# Deploy test NFT and mint
yarn hardhat generate-token-data --deploy --mint-nft --update-config --network <network>
```

## Account Management

### Create Account Config (Optional)

While `signup` automatically creates account configs, you can pre-create them manually:

```bash
# Create account config for account 0 (default signer)
yarn hardhat create-account-config --network <network>

# Create account config for account 1 (second signer)
yarn hardhat create-account-config --account 1 --network <network>
```

This is useful for:
- **Pre-generating MACI keypairs** before actual signup
- **Batch account creation** for multiple users
- **Account verification** to check signer addresses and keypairs

The command generates:
- **Deterministic MACI keypair** tied to the signer's Ethereum address
- **Account configuration** stored in `account-config.json`
- **Signer address verification** to ensure correct account mapping

### Default Account Behavior

Most tasks default to account 0 when no `--account` parameter is specified:
- `signup` defaults to account 0
- `join-poll` defaults to account 0  
- `vote` defaults to account 0
- Policy generation tasks default to account 0

## PrivoteWrapper 

PrivoteWrapper is a wrapper contract that allows you to deploy polls with custom policies and configurations in single transaction, this helps in better user experience.

### PrivoteWrapper vs Basic Privote

**Basic Privote (Default):**
- **Single Policy**: Uses one policy specified in deploy-config.json
- **Manual Setup**: Requires pre-deployment of policies  
- **Configuration-Based**: Poll creation uses deploy-config.json settings
- **Use Case**: Simple deployments with one authentication method

**PrivoteWrapper:**
- **Multi-Policy Support**: Can create polls with any policy type
- **Automatic Deployment**: Deploys policies and voice credit proxies automatically
- **Flexible Poll Creation**: Override any poll parameter during creation
- **One-Transaction Polls**: Complete poll setup in a single transaction
- **Dynamic Configuration**: No need to redeploy factories for different policies

### PrivoteWrapper Deployment

Deploy PrivoteWrapper instead of basic Privote:

```bash
yarn hardhat deploy-full --wrapper --network <network>
```

This deploys:
- PrivoteWrapper contract with multi-policy support
- Policy factories for all supported authentication methods
- Voice credit proxy factories
- All required infrastructure

### PrivoteWrapper Poll Creation

Create polls with enhanced flexibility:

```bash
# Use config settings
yarn hardhat deploy-poll-wrapper --network <network>

# Override specific settings
yarn hardhat deploy-poll-wrapper \
  --policy MerkleProofPolicy \
  --name "My Custom Poll" \
  --duration 3600 \
  --voice-credits 200 \
  --options "Yes,No,Maybe" \
  --network <network>
```

**Available Parameters:**
- `--policy`: Override policy type (FreeForAllPolicy, MerkleProofPolicy, EASPolicy, etc.)
- `--name`: Poll name
- `--metadata`: Poll description  
- `--duration`: Poll duration in seconds
- `--voice-credits`: Voice credits per user
- `--options`: Comma-separated vote options

### PrivoteWrapper Benefits

- **No Policy Pre-deployment**: Create polls with any policy without prior setup
- **Automatic Configuration**: Policies and voice credits deployed automatically
- **Frontend Integration**: Perfect for applications needing dynamic poll creation
- **Parameter Flexibility**: Override any setting at poll creation time
- **Multi-Policy Projects**: Support different authentication methods per poll

### When to Use PrivoteWrapper

- Building frontend applications
- Creating multiple polls with different policies
- Need runtime flexibility in poll configuration
- Want simplified deployment process
- Developing production applications

## Quick Start (Automated Flow)

For testing, you can run the complete flow with:

```bash
# Edit run_voting_flow.sh to add --network <network> to each command
./run_voting_flow.sh
```

Or run individual steps manually:
```bash
yarn hardhat deploy-full --network <network>
yarn hardhat signup --network <network>
yarn hardhat deploy-poll --network <network>
yarn hardhat join-poll --poll 0 --network <network>
yarn hardhat vote --poll 0 --votes "0:5,1:30" --network <network>

# After poll ends:
yarn hardhat merge --poll 0 --network <network>
yarn hardhat prove --poll 0 --output-dir ./out-dir/ --coordinator-private-key <key> --tally-file ./out-dir/tally.json --submit-on-chain --network <network>
```

## Dynamic Policy Configuration

The system supports dynamic policy evidence lookup per account. The process works as follows:

1. **Detects Policy Type**: Calls `getTrait()` on the policy contract to determine the policy type
2. **Maps to Evidence Field**: Maps the trait (e.g., "FreeForAll") to the evidence field (e.g., "FreeForAllPolicyEvidence")
3. **Fetches Account Evidence**: Retrieves the policy evidence from the account's configuration in `account-config.json`
4. **Uses Policy-Specific Data**: Passes the appropriate evidence to the signup/joinPoll functions

If no evidence is found for a policy (except FreeForAll), the system suggests running the appropriate policy generation command.



### Policy-Specific Notes

- **FreeForAllPolicy**: No signup data required, anyone can join
- **MerkleProofPolicy**: Requires whitelist and merkle proof generation
- **EASPolicy**: Requires attestation from trusted attester
- **ERC20Policy**: Requires minimum token balance
- **TokenPolicy**: Requires ownership of specific NFT
- **GitcoinPassportPolicy**: Requires valid Gitcoin Passport
- **SemaphorePolicy**: Requires Semaphore group membership
- **ZupassPolicy**: Requires valid Zupass verification

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

## Note

Make sure all environment variables are properly set before running the tasks. The generated proofs will be used to verify the poll results on-chain while maintaining privacy.

