// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { SignUpGatekeeper } from "./SignUpGatekeeper.sol";
import { IAnonAadhaar } from "../interfaces/IAnonAadhaar.sol";

/// @title AnonAadhaarGatekeeper
/// @notice A gatekeeper contract which allows users to sign up to MACI
/// only if they can prove they are valid Aadhaar owners.
/// @dev Please note that once a identity is used to register, it cannot be used again.
/// This is because we store the nullifier of the proof.
contract AnonAadhaarGatekeeper is SignUpGatekeeper, Ownable {
	/// @notice The anonAadhaar contract
	IAnonAadhaar public immutable anonAadhaarContract;

	/// @notice The address of the MACI contract
	address public maci;

	/// @notice The time window in which the proof is valid
	uint256 public proofValidTime;

	/// @notice The registered identities
	mapping(uint256 => bool) public registeredAadhaars;

	/// @notice Errors
	error ZeroAddress();
	error OnlyMACI();
	error AlreadyRegistered();
	error InvalidProof();
	error proofTooOld();

	/// @notice Create a new instance of the gatekeeper
	/// @param _anonAadhaarVerifierAddr The address of the anonAadhaar contract
	constructor(
		address _anonAadhaarVerifierAddr,
		uint256 _proofValidTime
	) payable {
		if (_anonAadhaarVerifierAddr == address(0)) revert ZeroAddress();
		anonAadhaarContract = IAnonAadhaar(_anonAadhaarVerifierAddr);
		proofValidTime = _proofValidTime;
	}

	/// @notice Adds an uninitialised MACI instance to allow for token signups
	/// @param _maci The MACI contract interface to be stored
	function setMaciInstance(address _maci) public override onlyOwner {
		if (_maci == address(0)) revert ZeroAddress();
		maci = _maci;
	}

	/// @notice Register an user if they can prove anonAadhaar proof
	/// @dev Throw if the proof is not valid or just complete silently
	/// @param _data The ABI-encoded data containing nullifierSeed, nullifier, timestamp, signal, revealArray, and groth16Proof.
	function register(address /*_user*/, bytes memory _data) public override {
		// decode the argument
		(
			uint nullifierSeed,
			uint nullifier,
			uint timestamp,
			uint signal,
			uint[4] memory revealArray,
			uint[8] memory groth16Proof
		) = abi.decode(_data, (uint, uint, uint, uint, uint[4], uint[8]));

		// ensure that the caller is the MACI contract
		if (maci != msg.sender) revert OnlyMACI();

		// ensure that the proof is not too old
		if (block.timestamp - timestamp > proofValidTime) revert proofTooOld();

		// ensure that the nullifier has not been registered yet
		if (registeredAadhaars[nullifier]) revert AlreadyRegistered();

		// register the nullifier so it cannot be called again with the same one
		registeredAadhaars[nullifier] = true;

		// check if the proof validates
		if (
			!anonAadhaarContract.verifyAnonAadhaarProof(
				nullifierSeed,
				nullifier,
				timestamp,
				signal,
				revealArray,
				groth16Proof
			)
		) revert InvalidProof();
	}

	/// @notice Get the trait of the gatekeeper
	/// @return The type of the gatekeeper
	function getTrait() public pure override returns (string memory) {
		return "AnonAadhaar";
	}
}
