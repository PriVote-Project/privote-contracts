#!/bin/bash

# Exit on any error
set -e

echo "Starting voting flow..."

echo "Step 1: Deploying full setup..."
yarn hardhat deploy-full


echo "Step 2: Signing up..."
yarn hardhat signup

echo "Step 3: Deploying poll..."
yarn hardhat deploy-poll

echo "Step 4: Joining poll..."
yarn hardhat join-poll --poll 0

# wait for 1 seconds
sleep 1

echo "Step 5: Voting..."
yarn hardhat vote --poll 0 --votes "0:5,1:30"

echo "Voting flow completed successfully!" 