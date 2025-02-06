// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { MACI } from "maci-contracts/contracts/MACI.sol";
import { IPollFactory } from "maci-contracts/contracts/interfaces/IPollFactory.sol";
import { IMessageProcessorFactory } from "maci-contracts/contracts/interfaces/IMPFactory.sol";
import { ITallyFactory } from "maci-contracts/contracts/interfaces/ITallyFactory.sol";
import { SignUpGatekeeper } from "maci-contracts/contracts/gatekeepers/SignUpGatekeeper.sol";
import { InitialVoiceCreditProxy } from "maci-contracts/contracts/initialVoiceCreditProxy/InitialVoiceCreditProxy.sol";
import { ITally } from "./interfaces/ITally.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title Privote - A Private Voting Protocol
/// @notice Allows userss to deploy multiple private polls according to their needs
contract Privote is MACI, Ownable, ReentrancyGuard {
	struct PollData {
		uint256 id;
		string name;
		bytes encodedOptions;
		string metadata;
		Privote.PollContracts pollContracts;
		uint256 startTime;
		uint256 endTime;
		uint256 numOfOptions;
		string[] options;
		bytes[] optionInfo;
		bool isTallied; // New field for tally status
		PubKey coordinatorPubKey;
		address pollDeployer;
		uint256 slashThreshold;
		string authType;
		Mode isQv;
	}

	mapping(uint256 => PollData) internal _polls;

	TreeDepths public treeDepths;
	address public verifier;
	address public vkRegistry;
	uint256 public stake;
	uint256 public slashThreshold;
	uint256 public totalStaked;

	mapping(address => uint256) public stakes;

	event PollCreated(
		uint256 indexed pollId,
		address indexed creator,
		Privote.PollContracts pollContracts,
		string name,
		string[] options,
		bytes[] optionInfo,
		string metadata,
		uint256 startTime,
		uint256 endTime,
		string authType
	);

	event PollTallyCIDUpdated(uint256 indexed pollId, string tallyJsonCID);
	event PollDeployerSlashed(address indexed pollDeployer, uint256 amount);
	// pubkey.x => pubkey.y => uint40
	// user would have to subtract one from this value while using this to vote for particular PubKey
	mapping(uint256 => mapping(uint256 => uint40)) public pubKeyToStateIndex;

	error PubKeyAlreadyRegistered();
	error PollAddressDoesNotExist(address _poll);
	error InvalidCaller();
	error StakeAmountMismatch();
	error NotPollDeployer();
	error PollNotTallied();
	error SlashThresholdNotReached();
	error PollAlreadyTallied();
	error InsufficientStake();
	error NoStakeToWithdraw();
	error NoExcessBalance();

	constructor(
		IPollFactory _pollFactory,
		IMessageProcessorFactory _messageProcessorFactory,
		ITallyFactory _tallyFactory,
		SignUpGatekeeper _signUpGatekeeper,
		InitialVoiceCreditProxy _initialVoiceCreditProxy,
		uint8 _stateTreeDepth,
		uint256[5] memory _emptyBallotRoots,
		uint256 _stake,
		uint256 _slashThreshold
	)
		MACI(
			_pollFactory,
			_messageProcessorFactory,
			_tallyFactory,
			_signUpGatekeeper,
			_initialVoiceCreditProxy,
			_stateTreeDepth,
			_emptyBallotRoots
		)
	{
		stake = _stake;
		slashThreshold = _slashThreshold;
	}

	function setConfig(
		TreeDepths memory _treeDepths,
		address _verifier,
		address _vkRegistry
	) public onlyOwner {
		treeDepths = _treeDepths;
		verifier = _verifier;
		vkRegistry = _vkRegistry;
	}

	/// @notice Allows any eligible user sign up. The sign-up gatekeeper should prevent
	/// double sign-ups or ineligible users from doing so.  This function will
	/// only succeed if the sign-up deadline has not passed. It also enqueues a
	/// fresh state leaf into the state AccQueue.
	/// @param _pubKey The user's desired public key.
	/// @param _signUpGatekeeperData Data to pass to the sign-up gatekeeper's
	///     register() function. For instance, the POAPGatekeeper or
	///     SignUpTokenGatekeeper requires this value to be the ABI-encoded
	///     token ID.
	/// @param _initialVoiceCreditProxyData Data to pass to the
	///     InitialVoiceCreditProxy, which allows it to determine how many voice
	///     credits this user should have.
	function signUp(
		PubKey memory _pubKey,
		bytes memory _signUpGatekeeperData,
		bytes memory _initialVoiceCreditProxyData
	) public override {
		// check if the pubkey is already registered
		if (pubKeyToStateIndex[_pubKey.x][_pubKey.y] != 0)
			revert PubKeyAlreadyRegistered();

		super.signUp(
			_pubKey,
			_signUpGatekeeperData,
			_initialVoiceCreditProxyData
		);

		pubKeyToStateIndex[_pubKey.x][_pubKey.y] = lazyIMTData.numberOfLeaves;
	}

	function createPoll(
		string calldata _name,
		string[] calldata _options,
		bytes[] calldata _optionInfo,
		string calldata _metadata,
		uint256 _duration,
		Mode isQv,
		PubKey memory coordinatorPubKey,
		string calldata authType
	) public payable {
		// TODO: check if the number of options are more than limit
		if (msg.value < stake) revert StakeAmountMismatch();

		stakes[msg.sender] += stake;
		totalStaked += stake;

		uint256 pollId = nextPollId;

		deployPoll(
			_duration,
			treeDepths,
			coordinatorPubKey,
			verifier,
			vkRegistry,
			isQv
		);

		PollContracts memory pollContracts = MACI.polls[pollId];

		// encode options to bytes for retrieval
		bytes memory encodedOptions = abi.encode(_options);

		uint256 endTime = block.timestamp + _duration;

		// create poll
		_polls[pollId] = PollData({
			id: pollId,
			name: _name,
			encodedOptions: encodedOptions,
			numOfOptions: _options.length,
			metadata: _metadata,
			startTime: block.timestamp,
			endTime: endTime,
			pollContracts: pollContracts,
			options: _options,
			optionInfo: _optionInfo,
			isTallied: false, // Set initial tally status to false
			coordinatorPubKey: coordinatorPubKey,
			pollDeployer: msg.sender,
			slashThreshold: slashThreshold,
			authType: authType,
			isQv: isQv
		});

		emit PollCreated(
			pollId,
			msg.sender,
			pollContracts,
			_name,
			_options,
			_optionInfo,
			_metadata,
			block.timestamp,
			endTime,
			authType
		);
	}

	function slashPollDeployer(uint256 _pollId) public {
		PollData storage poll = _polls[_pollId];
		if (block.timestamp <= poll.endTime + poll.slashThreshold)
			revert SlashThresholdNotReached();
		if (ITally(poll.pollContracts.tally).isTallied())
			revert PollAlreadyTallied();
		uint256 stakeToSlash = stake;
		if (stakes[poll.pollDeployer] < stakeToSlash)
			revert InsufficientStake();

		stakes[poll.pollDeployer] -= stakeToSlash;
		totalStaked -= stakeToSlash;

		emit PollDeployerSlashed(poll.pollDeployer, stakeToSlash);
	}

	function withdrawStake(uint256 _pollId) external nonReentrant {
		PollData storage poll = _polls[_pollId];
		if (poll.pollDeployer != msg.sender) revert NotPollDeployer();
		if (!ITally(poll.pollContracts.tally).isTallied())
			revert PollNotTallied();
		uint256 amount = stakes[msg.sender];
		if (amount == 0) revert NoStakeToWithdraw();

		stakes[msg.sender] = 0;
		totalStaked -= amount;
		(bool sent, ) = msg.sender.call{ value: amount }("");
		require(sent, "Withdraw failed");
	}

	function withdrawExcessBalance() external onlyOwner {
		uint256 excess = address(this).balance - totalStaked;
		if (excess <= 0) revert NoExcessBalance();

		(bool sent, ) = msg.sender.call{ value: excess }("");
		require(sent, "Owner withdraw failed");
	}

	function setPollTallied(uint256 _pollId) external {
		PollData storage poll = _polls[_pollId];
		ITally tally = ITally(poll.pollContracts.tally);
		if (!tally.isTallied()) revert PollNotTallied();
		poll.isTallied = true;
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
			(uint256 value, ) = tally.tallyResults(i);
			results[i] = value;
		}
	}

	receive() external payable {
		// Allow receiving Ether
	}

	fallback() external payable {
		// Fallback function
	}
}
