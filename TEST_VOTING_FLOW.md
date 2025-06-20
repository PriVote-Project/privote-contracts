# MACI Voting Flow Tests

This document describes how to run comprehensive tests for the full MACI voting flow using the task runners.

## Overview

The tests verify the complete end-to-end MACI voting process:

1. **Deploy MACI Infrastructure** - Deploy all core MACI contracts
2. **Deploy Poll** - Create a new voting poll
3. **User Signups** - Register multiple users to participate
4. **Join Poll** - Users join the specific poll to get poll state index
5. **Voting Phase** - Users cast their votes
6. **Wait for Poll End** - Automatically wait for poll to end and fast-forward time if needed
7. **Merge Phase** - Merge state and message trees after poll ends
8. **Proof Generation** - Generate zk-SNARK proofs for vote tallying
9. **Submit On-Chain** - Submit proofs to smart contracts
10. **Verify Results** - Validate tally results match expected values and voice credit calculations

## Test Files

### Integration Test
- **Location**: `test/integration/fullVotingFlow.test.ts`
- **Purpose**: Complete end-to-end integration test using Mocha/Chai
- **Duration**: ~5 minutes
- **Features**: 
  - Tests all phases sequentially
  - Validates expected vote tallies
  - Comprehensive error handling
  - Detailed logging and verification

### Unit Tests
- **Location**: `test/unit/taskRunner.test.ts`
- **Purpose**: Individual task runner validation
- **Duration**: ~2 minutes
- **Features**:
  - Tests each task in isolation
  - Validates configuration and setup
  - Quick smoke tests for functionality

### Test Script
- **Location**: `scripts/testVotingFlow.ts`
- **Purpose**: Standalone script for manual testing
- **Duration**: Variable
- **Features**:
  - Can be run outside of test framework
  - Configurable parameters
  - Detailed step-by-step logging
  - Optional cleanup

## Prerequisites

### 1. Dependencies
```bash
# Install dependencies
yarn install

# Download zkeys (required for proof generation)
yarn download-zkeys
```

### 2. Configuration
Ensure you have proper configuration files:
- `deploy-config.json` - Deployment configuration
- `hardhat.config.ts` - Network configuration

### 3. Network Setup
The tests are designed to run on Hardhat local network:
```bash
# Start local hardhat network (optional - tests can start their own)
yarn chain
```

## Running Tests

### Option 1: Simplified Integration Test (Recommended)

Run the simplified integration test that handles errors gracefully:

```bash
# Run simplified integration test
yarn test test/integration/simplifiedFlow.test.ts

# Run with specific network
yarn hardhat test test/integration/simplifiedFlow.test.ts --network hardhat
```

### Option 1a: Full Integration Test (Advanced)

Run the complete integration test with strict validation:

```bash
# Run full integration test (may fail if zkeys missing)
yarn test test/integration/fullVotingFlow.test.ts

# Run with specific network
yarn hardhat test test/integration/fullVotingFlow.test.ts --network hardhat
```

**Test Scenario:**
- 4 users signup to vote
- Users join the poll to get poll state indices
- Users cast votes: 
  - User 0: 5 votes for Option A, 3 for Option B
  - User 1: 7 votes for Option B, 2 for Option C  
  - User 2: 1 vote for Option A, 4 for Option C
  - User 3: 6 votes for Option C
- Expected results calculated using quadratic voting
- Full proof generation and verification

### Option 2: Smoke Tests

Run basic task availability tests:

```bash
# Run smoke tests (quick validation)
yarn test test/smoke/tasks.test.ts
```

### Option 3: Unit Tests

Run individual task validation:

```bash
# Run unit tests
yarn test test/unit/taskRunner.test.ts
```

### Option 4: Manual Script

Run the standalone test script:

```bash
# Run with default configuration
yarn hardhat run scripts/testVotingFlow.ts

# Run without cleanup (preserve artifacts)
yarn hardhat run scripts/testVotingFlow.ts -- --no-cleanup

# Run with custom output directory
yarn hardhat run scripts/testVotingFlow.ts -- --output-dir=./my-test-proofs
```

## Test Configuration

### Voting Scenario
```typescript
const TEST_VOTERS = [
  { account: "0", votes: "0:5,1:3" }, // 5 votes for Option A, 3 for Option B
  { account: "1", votes: "1:7,2:2" }, // 7 votes for Option B, 2 for Option C
  { account: "2", votes: "0:1,2:4" }, // 1 vote for Option A, 4 for Option C
  { account: "3", votes: "2:6" },     // 6 votes for Option C
];
```

### Poll Options
```typescript
const TEST_POLL_OPTIONS = ["Option A", "Option B", "Option C"];
```

### Expected Results (Quadratic Voting)
The tests validate that vote tallying works correctly with quadratic voting mechanics.

## Understanding the Output

### Successful Test Run
```
🚀 Starting Full MACI Voting Flow Integration Test
📦 Deploying MACI infrastructure...
✅ MACI infrastructure deployed successfully
🗳️  Deploying poll...
✅ Poll deployed successfully with ID: 0
👤 Signing up user 0...
✅ User 0 signed up successfully
...
🔐 Generating zk-SNARK proofs...
✅ Proofs generated successfully
📤 Submitting proofs on-chain...
✅ Proofs submitted on-chain successfully
🔍 Verifying tally results...
📊 Option A: 6 votes
📊 Option B: 10 votes  
📊 Option C: 12 votes
💰 Total spent voice credits: 123
✅ Tally results verification completed
🎉 Full MACI voting flow completed successfully!
```

### Files Generated
During testing, the following files may be created:
- `signup-config.json` - User signup configuration
- `test-voting-proofs/` - zk-SNARK proof files
- `tally.json` - Final vote tally results

## Troubleshooting

### Common Issues

#### 1. Missing zkeys
```
Error: ENOENT: no such file or directory, open 'zkeys/...'
```
**Solution**: Run `yarn download-zkeys`

#### 2. Poll timing issues
```
Error: Poll has not ended yet
```
**Solution**: Tests automatically fast-forward time on Hardhat network

#### 3. Proof generation failures
```
Error: rapidsnark not found
```
**Solution**: Ensure rapidsnark is installed or use WASM-based proving

#### 4. Contract deployment issues
```
Error: Privote contract not found
```
**Solution**: Ensure deploy-config.json is properly configured

### Debug Mode

Run tests with additional logging:
```bash
# Enable debug logging
DEBUG=maci:* yarn test test/integration/fullVotingFlow.test.ts
```

### Manual Task Execution

You can also run individual tasks manually:

```bash
# Deploy infrastructure
yarn hardhat deploy-full

# Deploy poll
yarn hardhat deploy-poll

# Signup user
yarn hardhat signup --account 0 --new

# Join poll
yarn hardhat join-poll --poll 0 --account 0

# Vote
yarn hardhat vote --poll 0 --votes "0:5,1:3" --account 0

# Merge
yarn hardhat merge --poll 0

# Generate proofs (requires zkeys)
yarn hardhat prove --poll 0 --output-dir ./proofs --coordinator-private-key "macisk...." --tally-file ./proofs/tally.json

# Submit on-chain
yarn hardhat submitOnChain --poll 0 --output-dir ./proofs --tally-file ./proofs/tally.json
```

## Performance Notes

- **Full Integration Test**: ~5 minutes (includes proof generation)
- **Unit Tests**: ~2 minutes (no proof generation)
- **Manual Script**: Variable (depends on configuration)

The most time-consuming step is zk-SNARK proof generation, which requires:
- Circuit compilation
- Witness generation  
- Proof computation

## Next Steps

After running these tests successfully, you can:

1. **Customize Test Scenarios**: Modify voting patterns in test configuration
2. **Add More Voters**: Increase the number of test participants
3. **Test Different Poll Types**: Try single-choice, approval voting, etc.
4. **Performance Testing**: Measure gas costs and timing
5. **Integration with Frontend**: Connect test results to UI components

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review task runner source code in `tasks/runner/`
3. Examine deployment configuration files
4. Enable debug logging for detailed output 