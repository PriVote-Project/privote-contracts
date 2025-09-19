#!/bin/bash

# Exit on any error
set -e

echo "Starting voting flow..."

echo "Step 1: Deploying full setup..."
# For testnet deployments, add --timeout parameter to avoid rate limiting
# Example: yarn hardhat deploy-full --network optimism-sepolia --timeout 10
yarn hardhat deploy-full


echo "Step 2: Signing up..."
yarn hardhat signup

echo "Step 3: Deploying poll..."
# For testnet deployments, add --timeout parameter to avoid rate limiting
# Example: yarn hardhat deploy-poll --network optimism-sepolia --timeout 5
yarn hardhat deploy-poll

echo "Step 4: Joining poll..."
yarn hardhat join-poll --poll 0

sleep 10

echo "Step 5: Voting..."
yarn hardhat vote --poll 0 --votes "1:99"

echo "Voting flow completed successfully!" 