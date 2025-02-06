// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { MACI } from "maci-contracts/contracts/MACI.sol";
import { IPollFactory } from "maci-contracts/contracts/interfaces/IPollFactory.sol";
import { IMessageProcessorFactory } from "maci-contracts/contracts/interfaces/IMPFactory.sol";
import { ITallyFactory } from "maci-contracts/contracts/interfaces/ITallyFactory.sol";
import { SignUpGatekeeper } from "maci-contracts/contracts/gatekeepers/SignUpGatekeeper.sol";
import { InitialVoiceCreditProxy } from "maci-contracts/contracts/initialVoiceCreditProxy/InitialVoiceCreditProxy.sol";

interface IPrivote {
	struct PollData {
		uint256 id;
		string name;
		bytes encodedOptions;
		string metadata;
		MACI.PollContracts pollContracts;
		uint256 startTime;
		uint256 endTime;
		uint256 numOfOptions;
		string[] options;
		bool isTallied; // New field for tally status
		MACI.PubKey coordinatorPubKey;
		address pollDeployer;
		uint256 slashThreshold;
		string authType;
		MACI.Mode isQv;
	}

	struct TreeDepths {
		uint8 stateTreeDepth;
		uint8 messageTreeDepth;
		uint8 voteOptionTreeDepth;
	}

	event PollCreated(
		uint256 indexed pollId,
		address indexed creator,
		MACI.PollContracts pollContracts,
		string name,
		string[] options,
		bytes[] optionInfo,
		string metadata,
		uint256 startTime,
		uint256 endTime,
		string authType
	);

	event PollDeployerSlashed(address indexed pollDeployer, uint256 amount);

	error PubKeyAlreadyRegistered();
	error PollAddressDoesNotExist(address _poll);
	error InvalidCaller();

	function setConfig(
		TreeDepths memory _treeDepths,
		address _verifier,
		address _vkRegistry
	) external;

	function signUp(
		MACI.PubKey memory _pubKey,
		bytes memory _signUpGatekeeperData,
		bytes memory _initialVoiceCreditProxyData
	) external;

	function createPoll(
		string calldata _name,
		string[] calldata _options,
		bytes[] calldata _optionInfo, // New parameter added
		string calldata _metadata,
		uint256 _duration,
		MACI.Mode isQv,
		MACI.PubKey memory coordinatorPubKey,
		string calldata authType
	) external payable;

	function slashPollDeployer(uint256 _pollId) external;

	function fetchPolls(
		uint256 _page,
		uint256 _perPage,
		bool _ascending
	) external view returns (PollData[] memory polls_);

	function fetchPoll(
		uint256 _pollId
	) external view returns (PollData memory poll_);

	// New function to set the poll as tallied based on ITally checking.
	function setPollTallied(uint256 _pollId) external;
}
