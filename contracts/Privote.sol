// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { MACI } from "@maci-protocol/contracts/contracts/MACI.sol";
import { IMACI } from "@maci-protocol/contracts/contracts/interfaces/IMACI.sol";
import { IPollFactory } from "@maci-protocol/contracts/contracts/interfaces/IPollFactory.sol";
import { IMessageProcessorFactory } from "@maci-protocol/contracts/contracts/interfaces/IMessageProcessorFactory.sol";
import { ITallyFactory } from "@maci-protocol/contracts/contracts/interfaces/ITallyFactory.sol";
import { IBasePolicy } from "@excubiae/contracts/contracts/interfaces/IBasePolicy.sol";
import { ITally } from "@maci-protocol/contracts/contracts/interfaces/ITally.sol";

/// @title Privote - A Private Voting Protocol
/// @notice Allows users to deploy multiple private polls according to their needs
contract Privote is MACI, Ownable, ReentrancyGuard {
	// Poll data structure
	struct PollData {
		uint256 id;
		string name;
		string metadata;
		uint256 startTime;
		uint256 endTime;
		string[] options;
		bytes[] optionInfo;
		PublicKey coordinatorPubKey;
		address pollDeployer;
		Mode mode;
		address policy;
		PollContracts pollContracts;
	}

	mapping(uint256 => PollData) public _polls;

	TreeDepths public treeDepths;
	address public verifier;
	address public vkRegistry;
	uint8 public messageBatchSize;

	event PollCreated(
		uint256 indexed pollId,
		address indexed creator,
		PollContracts pollContracts,
		string name,
		string[] options,
		bytes[] optionInfo,
		string metadata,
		uint256 startTime,
		uint256 endTime,
		address policy
	);

	error PollNotTallied();
	error StartTimeMustBeInFuture();
	error EndTimeMustBeAfterStartTime();

	constructor(
		IPollFactory _pollFactory,
		IMessageProcessorFactory _messageProcessorFactory,
		ITallyFactory _tallyFactory,
		IBasePolicy _signUpPolicy,
		uint8 _stateTreeDepth,
		uint256[5] memory _emptyBallotRoots
	)
		MACI(
			_pollFactory,
			_messageProcessorFactory,
			_tallyFactory,
			_signUpPolicy,
			_stateTreeDepth,
			_emptyBallotRoots
		)
		Ownable(msg.sender)
	{}

	/// @notice Set configuration for poll deployment
	/// @param _treeDepths The depths of the Merkle trees
	/// @param _verifier The verifier contract address
	/// @param _vkRegistry The verifying keys registry contract address
	/// @param _messageBatchSize The message batch size for the poll
	function setConfig(
		TreeDepths memory _treeDepths,
		address _verifier,
		address _vkRegistry,
		uint8 _messageBatchSize
	) public onlyOwner {
		treeDepths = _treeDepths;
		verifier = _verifier;
		vkRegistry = _vkRegistry;
		messageBatchSize = _messageBatchSize;
	}

	/// @notice Create a new poll
	/// @param _name The name of the poll
	/// @param _options The options of the poll
	/// @param _optionInfo The info of the options
	/// @param _metadata The metadata of the poll
	/// @param _startTime The start time of the poll
	/// @param _endTime The end time of the poll
	/// @param _mode The mode of the poll
	/// @param _coordinatorPubKey The coordinator public key
	/// @param _policy The gatekeeping policy of the poll
	/// @param _initialVoiceCreditProxy The initial voice credit proxy
	/// @param _relayers The relayers of the poll
	function createPoll(
		string calldata _name,
		string[] calldata _options,
		bytes[] calldata _optionInfo,
		string calldata _metadata,
		uint256 _startTime,
		uint256 _endTime,
		Mode _mode,
		PublicKey memory _coordinatorPubKey,
		address _policy,
		address _initialVoiceCreditProxy,
		address[] memory _relayers
	) public {
		// if (_startTime < block.timestamp) {
		// 	revert StartTimeMustBeInFuture();
		// }
		// if (_endTime <= _startTime) {
		// 	revert EndTimeMustBeAfterStartTime();
		// }

		uint256 pollId = nextPollId;
		uint256 voteOptions = _options.length;

		IMACI.DeployPollArgs memory args = IMACI.DeployPollArgs({
			startDate: _startTime,
			endDate: _endTime,
			treeDepths: treeDepths,
			messageBatchSize: messageBatchSize,
			coordinatorPublicKey: _coordinatorPubKey,
			verifier: verifier,
			verifyingKeysRegistry: vkRegistry,
			mode: _mode,
			policy: _policy,
			initialVoiceCreditProxy: _initialVoiceCreditProxy,
			relayers: _relayers,
			voteOptions: voteOptions
		});

		PollContracts memory pollContracts = super.deployPoll(args);

		_polls[pollId] = PollData({
			id: pollId,
			name: _name,
			metadata: _metadata,
			startTime: _startTime,
			endTime: _endTime,
			options: _options,
			optionInfo: _optionInfo,
			coordinatorPubKey: _coordinatorPubKey,
			pollDeployer: msg.sender,
			mode: _mode,
			policy: _policy,
			pollContracts: pollContracts
		});

		emit PollCreated(
			pollId,
			msg.sender,
			pollContracts,
			_name,
			_options,
			_optionInfo,
			_metadata,
			_startTime,
			_endTime,
			_policy
		);
	}

	/// @notice Allows any eligible user to sign up. The sign-up policy should prevent
	/// double sign-ups or ineligible users from doing so.
	/// @param _publicKey The user's public key.
	/// @param _signUpPolicyData Data to pass to the sign-up policy's
	///     enforce() function to verify the user's eligibility.
	function signUp(
		PublicKey memory _publicKey,
		bytes memory _signUpPolicyData
	) public override {
		// Call the parent MACI signUp function which already emits SignUp event
		super.signUp(_publicKey, _signUpPolicyData);
	}

	function fetchPolls(
		uint256 _page,
		uint256 _perPage,
		bool _ascending
	) public view returns (PollData[] memory polls_) {
		uint256 start = (_page - 1) * _perPage;
		uint256 end = start + _perPage - 1;

		if (start >= nextPollId) {
			return new PollData[](0);
		}

		if (end >= nextPollId) {
			end = nextPollId - 1;
		}

		polls_ = new PollData[](end - start + 1);

		uint256 index = 0;
		for (uint256 i = start; i <= end; i++) {
			uint256 pollIndex = i;
			if (!_ascending) {
				pollIndex = nextPollId - i - 1;
			}
			polls_[index++] = _polls[pollIndex];
		}
	}

	// Possible gas optimizations

	function userTotalPolls(address user) public view returns (uint256) {
		uint256 total = 0;
		for (uint256 i = 0; i < nextPollId; i++) {
			if (_polls[i].pollDeployer == user) {
				total++;
			}
		}
		return total;
	}

	function fetchUserPolls(
		address user,
		uint256 _page,
		uint256 _perPage,
		bool _ascending
	) public view returns (PollData[] memory polls_) {
		uint256 totalPolls = userTotalPolls(user);
		uint256 start = (_page - 1) * _perPage;
		uint256 end = start + _perPage - 1;

		if (start >= totalPolls) {
			return new PollData[](0);
		}

		if (end >= totalPolls) {
			end = totalPolls - 1;
		}

		polls_ = new PollData[](end - start + 1);
		uint256 index = 0;
		uint256 counted = 0;
		for (uint256 i = 0; i < nextPollId; i++) {
			if (_polls[i].pollDeployer == user) {
				if (counted >= start && counted <= end) {
					if (_ascending) {
						polls_[index++] = _polls[i];
					} else {
						polls_[end - index++] = _polls[i];
					}
				}
				counted++;
				if (counted > end) {
					break;
				}
			}
		}
	}

	function fetchPoll(
		uint256 _pollId
	) public view returns (PollData memory poll_) {
		if (_pollId >= nextPollId) revert PollDoesNotExist(_pollId);
		return _polls[_pollId];
	}

	// Returns the poll tally results for a given poll id.
	function getPollResult(
		uint256 _pollId
	) external view returns (uint256[] memory results) {
		if (_pollId >= nextPollId) revert PollDoesNotExist(_pollId);
		PollData storage poll = _polls[_pollId];
		ITally tally = ITally(poll.pollContracts.tally);
		if (!tally.isTallied()) revert PollNotTallied();
		uint256 len = tally.totalTallyResults();
		results = new uint256[](len);
		for (uint256 i = 0; i < len; i++) {
			ITally.TallyResult memory result = tally.getTallyResults(i);
			results[i] = result.value;
		}
	}

	receive() external payable {
		// Allow receiving Ether
	}

	fallback() external payable {
		// Fallback function
	}
}
