// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Privote } from "./Privote.sol";
import { IPollFactory } from "@maci-protocol/contracts/contracts/interfaces/IPollFactory.sol";
import { IMessageProcessorFactory } from "@maci-protocol/contracts/contracts/interfaces/IMessageProcessorFactory.sol";
import { ITallyFactory } from "@maci-protocol/contracts/contracts/interfaces/ITallyFactory.sol";
import { IBasePolicy } from "@excubiae/contracts/contracts/interfaces/IBasePolicy.sol";
import { IPolicyFactory } from "@excubiae/contracts/contracts/interfaces/IPolicyFactory.sol";
import { ConstantInitialVoiceCreditProxyFactory } from "@maci-protocol/contracts/contracts/initialVoiceCreditProxy/ConstantInitialVoiceCreditProxyFactory.sol";

// Checker factory interfaces
interface IAnonAadhaarCheckerFactory {
	function deploy(
		address anonAadhaarVerifier,
		uint256 nullifierSeed
	) external returns (address);
}

interface IERC20CheckerFactory {
	function deploy(
		address token,
		uint256 threshold
	) external returns (address);
}

interface ITokenCheckerFactory {
	function deploy(address token) external returns (address);
}

interface IEASCheckerFactory {
	function deploy(
		address eas,
		address attester,
		bytes32 schema
	) external returns (address);
}

interface IGitcoinPassportCheckerFactory {
	function deploy(
		address passportDecoder,
		uint256 thresholdScore
	) external returns (address);
}

interface IMerkleProofCheckerFactory {
	function deploy(bytes32 root) external returns (address);
}

interface ISemaphoreCheckerFactory {
	function deploy(
		address semaphore,
		uint256 groupId
	) external returns (address);
}

interface IZupassCheckerFactory {
	function deploy(
		uint256 eventId,
		uint256 signer1,
		uint256 signer2,
		address verifier
	) external returns (address);
}

interface IFreeForAllCheckerFactory {
	function deploy() external returns (address);
}

/// @title PrivoteWrapper - A Wrapper for Privote with Auto-deployment
/// @notice Extends Privote to automatically deploy policies and voice credit proxies
/// @dev Simplifies poll creation by handling the deployment of required contracts
contract PrivoteWrapper is Privote {
	/// @notice Custom errors for gas optimization
	error InvalidFactoryAddress();
	error AnonAadhaarCheckerFactoryNotSet();
	error AnonAadhaarPolicyFactoryNotSet();
	error ERC20CheckerFactoryNotSet();
	error ERC20PolicyFactoryNotSet();
	error TokenCheckerFactoryNotSet();
	error TokenPolicyFactoryNotSet();
	error EASCheckerFactoryNotSet();
	error EASPolicyFactoryNotSet();
	error GitcoinCheckerFactoryNotSet();
	error GitcoinPolicyFactoryNotSet();
	error MerkleCheckerFactoryNotSet();
	error MerklePolicyFactoryNotSet();
	error SemaphoreCheckerFactoryNotSet();
	error SemaphorePolicyFactoryNotSet();
	error ZupassCheckerFactoryNotSet();
	error ZupassPolicyFactoryNotSet();
	error FreeForAllCheckerFactoryNotSet();
	error FreeForAllPolicyFactoryNotSet();
	error VoiceCreditProxyFactoryNotSet();
	error InvalidPolicyAddress();
	/// @notice Factory contracts for auto-deployment
	IAnonAadhaarCheckerFactory public anonAadhaarCheckerFactory;
	IPolicyFactory public anonAadhaarPolicyFactory;
	IERC20CheckerFactory public erc20CheckerFactory;
	IPolicyFactory public erc20PolicyFactory;
	ITokenCheckerFactory public tokenCheckerFactory;
	IPolicyFactory public tokenPolicyFactory;
	IEASCheckerFactory public easCheckerFactory;
	IPolicyFactory public easPolicyFactory;
	IGitcoinPassportCheckerFactory public gitcoinCheckerFactory;
	IPolicyFactory public gitcoinPolicyFactory;
	IMerkleProofCheckerFactory public merkleCheckerFactory;
	IPolicyFactory public merklePolicyFactory;
	ISemaphoreCheckerFactory public semaphoreCheckerFactory;
	IPolicyFactory public semaphorePolicyFactory;
	IZupassCheckerFactory public zupassCheckerFactory;
	IPolicyFactory public zupassPolicyFactory;
	IFreeForAllCheckerFactory public freeForAllCheckerFactory;
	IPolicyFactory public freeForAllPolicyFactory;
	ConstantInitialVoiceCreditProxyFactory
		public constantVoiceCreditProxyFactory;

	/// @notice Events

	event AnonAadhaarFactoriesUpdated(
		address indexed oldCheckerFactory,
		address indexed newCheckerFactory,
		address indexed oldPolicyFactory,
		address newPolicyFactory
	);
	event ERC20FactoriesUpdated(
		address indexed oldCheckerFactory,
		address indexed newCheckerFactory,
		address indexed oldPolicyFactory,
		address newPolicyFactory
	);
	event TokenFactoriesUpdated(
		address indexed oldCheckerFactory,
		address indexed newCheckerFactory,
		address indexed oldPolicyFactory,
		address newPolicyFactory
	);
	event EASFactoriesUpdated(
		address indexed oldCheckerFactory,
		address indexed newCheckerFactory,
		address indexed oldPolicyFactory,
		address newPolicyFactory
	);
	event GitcoinFactoriesUpdated(
		address indexed oldCheckerFactory,
		address indexed newCheckerFactory,
		address indexed oldPolicyFactory,
		address newPolicyFactory
	);
	event MerkleFactoriesUpdated(
		address indexed oldCheckerFactory,
		address indexed newCheckerFactory,
		address indexed oldPolicyFactory,
		address newPolicyFactory
	);
	event SemaphoreFactoriesUpdated(
		address indexed oldCheckerFactory,
		address indexed newCheckerFactory,
		address indexed oldPolicyFactory,
		address newPolicyFactory
	);
	event ZupassFactoriesUpdated(
		address indexed oldCheckerFactory,
		address indexed newCheckerFactory,
		address indexed oldPolicyFactory,
		address newPolicyFactory
	);
	event FreeForAllFactoriesUpdated(
		address indexed oldCheckerFactory,
		address indexed newCheckerFactory,
		address indexed oldPolicyFactory,
		address newPolicyFactory
	);
	event ConstantVoiceCreditProxyFactoryUpdated(
		address indexed oldFactory,
		address indexed newFactory
	);

	/// @notice Constructor - Factory contracts must be set separately via setter functions
	/// @param _pollFactory The poll factory contract
	/// @param _messageProcessorFactory The message processor factory contract
	/// @param _tallyFactory The tally factory contract
	/// @param _signUpPolicy The initial sign up policy
	/// @param _stateTreeDepth The state tree depth
	/// @param _emptyBallotRoots The empty ballot roots
	constructor(
		IPollFactory _pollFactory,
		IMessageProcessorFactory _messageProcessorFactory,
		ITallyFactory _tallyFactory,
		IBasePolicy _signUpPolicy,
		uint8 _stateTreeDepth,
		uint256[5] memory _emptyBallotRoots
	)
		Privote(
			_pollFactory,
			_messageProcessorFactory,
			_tallyFactory,
			_signUpPolicy,
			_stateTreeDepth,
			_emptyBallotRoots
		)
	{
		// Factory contracts are initialized to zero and must be set via setter functions
		// This avoids "stack too deep" errors in the constructor
	}

	/// @notice Update both AnonAadhaar checker and policy factories (only owner)
	/// @param _newCheckerFactory The new AnonAadhaar checker factory address
	/// @param _newPolicyFactory The new policy factory address
	function setAnonAadhaarFactories(
		address _newCheckerFactory,
		address _newPolicyFactory
	) external onlyOwner {
		if (_newCheckerFactory == address(0)) revert InvalidFactoryAddress();
		if (_newPolicyFactory == address(0)) revert InvalidFactoryAddress();

		address oldCheckerFactory = address(anonAadhaarCheckerFactory);
		address oldPolicyFactory = address(anonAadhaarPolicyFactory);

		anonAadhaarCheckerFactory = IAnonAadhaarCheckerFactory(
			_newCheckerFactory
		);
		anonAadhaarPolicyFactory = IPolicyFactory(_newPolicyFactory);

		emit AnonAadhaarFactoriesUpdated(
			oldCheckerFactory,
			_newCheckerFactory,
			oldPolicyFactory,
			_newPolicyFactory
		);
	}

	/// @notice Update both ERC20 checker and policy factories (only owner)
	/// @param _newCheckerFactory The new ERC20 checker factory address
	/// @param _newPolicyFactory The new ERC20 policy factory address
	function setERC20Factories(
		address _newCheckerFactory,
		address _newPolicyFactory
	) external onlyOwner {
		if (_newCheckerFactory == address(0)) revert InvalidFactoryAddress();
		if (_newPolicyFactory == address(0)) revert InvalidFactoryAddress();

		address oldCheckerFactory = address(erc20CheckerFactory);
		address oldPolicyFactory = address(erc20PolicyFactory);

		erc20CheckerFactory = IERC20CheckerFactory(_newCheckerFactory);
		erc20PolicyFactory = IPolicyFactory(_newPolicyFactory);

		emit ERC20FactoriesUpdated(
			oldCheckerFactory,
			_newCheckerFactory,
			oldPolicyFactory,
			_newPolicyFactory
		);
	}

	/// @notice Update both Token checker and policy factories (only owner)
	/// @param _newCheckerFactory The new Token checker factory address
	/// @param _newPolicyFactory The new Token policy factory address
	function setTokenFactories(
		address _newCheckerFactory,
		address _newPolicyFactory
	) external onlyOwner {
		if (_newCheckerFactory == address(0)) revert InvalidFactoryAddress();
		if (_newPolicyFactory == address(0)) revert InvalidFactoryAddress();

		address oldCheckerFactory = address(tokenCheckerFactory);
		address oldPolicyFactory = address(tokenPolicyFactory);

		tokenCheckerFactory = ITokenCheckerFactory(_newCheckerFactory);
		tokenPolicyFactory = IPolicyFactory(_newPolicyFactory);

		emit TokenFactoriesUpdated(
			oldCheckerFactory,
			_newCheckerFactory,
			oldPolicyFactory,
			_newPolicyFactory
		);
	}

	/// @notice Update both EAS checker and policy factories (only owner)
	/// @param _newCheckerFactory The new EAS checker factory address
	/// @param _newPolicyFactory The new EAS policy factory address
	function setEASFactories(
		address _newCheckerFactory,
		address _newPolicyFactory
	) external onlyOwner {
		if (_newCheckerFactory == address(0)) revert InvalidFactoryAddress();
		if (_newPolicyFactory == address(0)) revert InvalidFactoryAddress();

		address oldCheckerFactory = address(easCheckerFactory);
		address oldPolicyFactory = address(easPolicyFactory);

		easCheckerFactory = IEASCheckerFactory(_newCheckerFactory);
		easPolicyFactory = IPolicyFactory(_newPolicyFactory);

		emit EASFactoriesUpdated(
			oldCheckerFactory,
			_newCheckerFactory,
			oldPolicyFactory,
			_newPolicyFactory
		);
	}

	/// @notice Update both GitCoin checker and policy factories (only owner)
	/// @param _newCheckerFactory The new GitCoin checker factory address
	/// @param _newPolicyFactory The new GitCoin policy factory address
	function setGitcoinFactories(
		address _newCheckerFactory,
		address _newPolicyFactory
	) external onlyOwner {
		if (_newCheckerFactory == address(0)) revert InvalidFactoryAddress();
		if (_newPolicyFactory == address(0)) revert InvalidFactoryAddress();

		address oldCheckerFactory = address(gitcoinCheckerFactory);
		address oldPolicyFactory = address(gitcoinPolicyFactory);

		gitcoinCheckerFactory = IGitcoinPassportCheckerFactory(
			_newCheckerFactory
		);
		gitcoinPolicyFactory = IPolicyFactory(_newPolicyFactory);

		emit GitcoinFactoriesUpdated(
			oldCheckerFactory,
			_newCheckerFactory,
			oldPolicyFactory,
			_newPolicyFactory
		);
	}

	/// @notice Update both Merkle checker and policy factories (only owner)
	/// @param _newCheckerFactory The new Merkle checker factory address
	/// @param _newPolicyFactory The new Merkle policy factory address
	function setMerkleFactories(
		address _newCheckerFactory,
		address _newPolicyFactory
	) external onlyOwner {
		if (_newCheckerFactory == address(0)) revert InvalidFactoryAddress();
		if (_newPolicyFactory == address(0)) revert InvalidFactoryAddress();

		address oldCheckerFactory = address(merkleCheckerFactory);
		address oldPolicyFactory = address(merklePolicyFactory);

		merkleCheckerFactory = IMerkleProofCheckerFactory(_newCheckerFactory);
		merklePolicyFactory = IPolicyFactory(_newPolicyFactory);

		emit MerkleFactoriesUpdated(
			oldCheckerFactory,
			_newCheckerFactory,
			oldPolicyFactory,
			_newPolicyFactory
		);
	}

	/// @notice Update both Semaphore checker and policy factories (only owner)
	/// @param _newCheckerFactory The new Semaphore checker factory address
	/// @param _newPolicyFactory The new Semaphore policy factory address
	function setSemaphoreFactories(
		address _newCheckerFactory,
		address _newPolicyFactory
	) external onlyOwner {
		if (_newCheckerFactory == address(0)) revert InvalidFactoryAddress();
		if (_newPolicyFactory == address(0)) revert InvalidFactoryAddress();

		address oldCheckerFactory = address(semaphoreCheckerFactory);
		address oldPolicyFactory = address(semaphorePolicyFactory);

		semaphoreCheckerFactory = ISemaphoreCheckerFactory(_newCheckerFactory);
		semaphorePolicyFactory = IPolicyFactory(_newPolicyFactory);

		emit SemaphoreFactoriesUpdated(
			oldCheckerFactory,
			_newCheckerFactory,
			oldPolicyFactory,
			_newPolicyFactory
		);
	}

	/// @notice Update both Zupass checker and policy factories (only owner)
	/// @param _newCheckerFactory The new Zupass checker factory address
	/// @param _newPolicyFactory The new Zupass policy factory address
	function setZupassFactories(
		address _newCheckerFactory,
		address _newPolicyFactory
	) external onlyOwner {
		if (_newCheckerFactory == address(0)) revert InvalidFactoryAddress();
		if (_newPolicyFactory == address(0)) revert InvalidFactoryAddress();

		address oldCheckerFactory = address(zupassCheckerFactory);
		address oldPolicyFactory = address(zupassPolicyFactory);

		zupassCheckerFactory = IZupassCheckerFactory(_newCheckerFactory);
		zupassPolicyFactory = IPolicyFactory(_newPolicyFactory);

		emit ZupassFactoriesUpdated(
			oldCheckerFactory,
			_newCheckerFactory,
			oldPolicyFactory,
			_newPolicyFactory
		);
	}

	/// @notice Update both Free For All checker and policy factories (only owner)
	/// @param _newCheckerFactory The new Free For All checker factory address
	/// @param _newPolicyFactory The new Free For All policy factory address
	function setFreeForAllFactories(
		address _newCheckerFactory,
		address _newPolicyFactory
	) external onlyOwner {
		if (_newCheckerFactory == address(0)) revert InvalidFactoryAddress();
		if (_newPolicyFactory == address(0)) revert InvalidFactoryAddress();

		address oldCheckerFactory = address(freeForAllCheckerFactory);
		address oldPolicyFactory = address(freeForAllPolicyFactory);

		freeForAllCheckerFactory = IFreeForAllCheckerFactory(
			_newCheckerFactory
		);
		freeForAllPolicyFactory = IPolicyFactory(_newPolicyFactory);

		emit FreeForAllFactoriesUpdated(
			oldCheckerFactory,
			_newCheckerFactory,
			oldPolicyFactory,
			_newPolicyFactory
		);
	}

	/// @notice Update the constant voice credit proxy factory (only owner)
	/// @param _newFactory The new constant voice credit proxy factory address
	function setConstantVoiceCreditProxyFactory(
		address _newFactory
	) external onlyOwner {
		if (_newFactory == address(0)) revert InvalidFactoryAddress();
		address oldFactory = address(constantVoiceCreditProxyFactory);
		constantVoiceCreditProxyFactory = ConstantInitialVoiceCreditProxyFactory(
			_newFactory
		);
		emit ConstantVoiceCreditProxyFactoryUpdated(oldFactory, _newFactory);
	}

	/// @notice Create a poll with AnonAadhaar authentication
	/// @param _name The name of the poll
	/// @param _options The options of the poll
	/// @param _optionInfo The info of the options
	/// @param _metadata The metadata of the poll
	/// @param _startTime The start time of the poll
	/// @param _endTime The end time of the poll
	/// @param _mode The mode of the poll
	/// @param _coordinatorPubKey The coordinator public key
	/// @param _relayers The relayers of the poll
	/// @param _anonAadhaarVerifier The address of the AnonAadhaar verifier contract
	/// @param _nullifierSeed The nullifier seed specific to the app
	/// @param _voiceCreditsBalance The balance for voice credits
	function createPollWithAnonAadhaar(
		string calldata _name,
		string[] calldata _options,
		bytes[] calldata _optionInfo,
		string calldata _metadata,
		uint256 _startTime,
		uint256 _endTime,
		Mode _mode,
		PublicKey memory _coordinatorPubKey,
		address[] memory _relayers,
		address _anonAadhaarVerifier,
		uint256 _nullifierSeed,
		uint256 _voiceCreditsBalance
	) public {
		if (address(anonAadhaarCheckerFactory) == address(0))
			revert AnonAadhaarCheckerFactoryNotSet();
		if (address(anonAadhaarPolicyFactory) == address(0))
			revert AnonAadhaarPolicyFactoryNotSet();
		if (address(constantVoiceCreditProxyFactory) == address(0))
			revert VoiceCreditProxyFactoryNotSet();

		// Deploy AnonAadhaar checker
		address checker = anonAadhaarCheckerFactory.deploy(
			_anonAadhaarVerifier,
			_nullifierSeed
		);

		// Deploy AnonAadhaar policy using the checker
		address policy = anonAadhaarPolicyFactory.deploy(checker);

		// Deploy constant voice credit proxy
		address voiceCreditProxy = constantVoiceCreditProxyFactory.deploy(
			_voiceCreditsBalance
		);

		// Create the poll using the deployed contracts
		PollContracts memory pollContracts = super.createPoll(
			_name,
			_options,
			_optionInfo,
			_metadata,
			_startTime,
			_endTime,
			_mode,
			_coordinatorPubKey,
			policy,
			voiceCreditProxy,
			_relayers
		);

		// Set the target of the policy contract
		IBasePolicy(policy).setTarget(pollContracts.poll);
	}

	/// @notice Create a poll with ERC20 token authentication
	/// @param _name The name of the poll
	/// @param _options The options of the poll
	/// @param _optionInfo The info of the options
	/// @param _metadata The metadata of the poll
	/// @param _startTime The start time of the poll
	/// @param _endTime The end time of the poll
	/// @param _mode The mode of the poll
	/// @param _coordinatorPubKey The coordinator public key
	/// @param _relayers The relayers of the poll
	/// @param _tokenAddress The ERC20 token contract address
	/// @param _threshold The minimum token balance required
	/// @param _voiceCreditsBalance The balance for voice credits
	function createPollWithERC20(
		string calldata _name,
		string[] calldata _options,
		bytes[] calldata _optionInfo,
		string calldata _metadata,
		uint256 _startTime,
		uint256 _endTime,
		Mode _mode,
		PublicKey memory _coordinatorPubKey,
		address[] memory _relayers,
		address _tokenAddress,
		uint256 _threshold,
		uint256 _voiceCreditsBalance
	) public {
		if (address(erc20CheckerFactory) == address(0))
			revert ERC20CheckerFactoryNotSet();
		if (address(erc20PolicyFactory) == address(0))
			revert ERC20PolicyFactoryNotSet();
		if (address(constantVoiceCreditProxyFactory) == address(0))
			revert VoiceCreditProxyFactoryNotSet();

		// Deploy ERC20 checker
		address checker = erc20CheckerFactory.deploy(_tokenAddress, _threshold);

		// Deploy ERC20 policy using the checker
		address policy = erc20PolicyFactory.deploy(checker);

		// Deploy constant voice credit proxy
		address voiceCreditProxy = constantVoiceCreditProxyFactory.deploy(
			_voiceCreditsBalance
		);

		// Create the poll using the deployed contracts
		PollContracts memory pollContracts = super.createPoll(
			_name,
			_options,
			_optionInfo,
			_metadata,
			_startTime,
			_endTime,
			_mode,
			_coordinatorPubKey,
			policy,
			voiceCreditProxy,
			_relayers
		);

		// Set the target of the policy contract
		IBasePolicy(policy).setTarget(pollContracts.poll);
	}

	/// @notice Create a poll with Token (NFT) authentication
	/// @param _name The name of the poll
	/// @param _options The options of the poll
	/// @param _optionInfo The info of the options
	/// @param _metadata The metadata of the poll
	/// @param _startTime The start time of the poll
	/// @param _endTime The end time of the poll
	/// @param _mode The mode of the poll
	/// @param _coordinatorPubKey The coordinator public key
	/// @param _relayers The relayers of the poll
	/// @param _tokenAddress The NFT token contract address
	/// @param _voiceCreditsBalance The balance for voice credits
	function createPollWithToken(
		string calldata _name,
		string[] calldata _options,
		bytes[] calldata _optionInfo,
		string calldata _metadata,
		uint256 _startTime,
		uint256 _endTime,
		Mode _mode,
		PublicKey memory _coordinatorPubKey,
		address[] memory _relayers,
		address _tokenAddress,
		uint256 _voiceCreditsBalance
	) public {
		if (address(tokenCheckerFactory) == address(0))
			revert TokenCheckerFactoryNotSet();
		if (address(tokenPolicyFactory) == address(0))
			revert TokenPolicyFactoryNotSet();
		if (address(constantVoiceCreditProxyFactory) == address(0))
			revert VoiceCreditProxyFactoryNotSet();

		// Deploy Token checker
		address checker = tokenCheckerFactory.deploy(_tokenAddress);

		// Deploy Token policy using the checker
		address policy = tokenPolicyFactory.deploy(checker);

		// Deploy constant voice credit proxy
		address voiceCreditProxy = constantVoiceCreditProxyFactory.deploy(
			_voiceCreditsBalance
		);

		// Create the poll using the deployed contracts
		PollContracts memory pollContracts = super.createPoll(
			_name,
			_options,
			_optionInfo,
			_metadata,
			_startTime,
			_endTime,
			_mode,
			_coordinatorPubKey,
			policy,
			voiceCreditProxy,
			_relayers
		);

		// Set the target of the policy contract
		IBasePolicy(policy).setTarget(pollContracts.poll);
	}

	/// @notice Create a poll with EAS (Ethereum Attestation Service) authentication
	/// @param _name The name of the poll
	/// @param _options The options of the poll
	/// @param _optionInfo The info of the options
	/// @param _metadata The metadata of the poll
	/// @param _startTime The start time of the poll
	/// @param _endTime The end time of the poll
	/// @param _mode The mode of the poll
	/// @param _coordinatorPubKey The coordinator public key
	/// @param _relayers The relayers of the poll
	/// @param _easContract The EAS contract address
	/// @param _attester The trusted attester address
	/// @param _schema The schema UID
	/// @param _voiceCreditsBalance The balance for voice credits
	function createPollWithEAS(
		string calldata _name,
		string[] calldata _options,
		bytes[] calldata _optionInfo,
		string calldata _metadata,
		uint256 _startTime,
		uint256 _endTime,
		Mode _mode,
		PublicKey memory _coordinatorPubKey,
		address[] memory _relayers,
		address _easContract,
		address _attester,
		bytes32 _schema,
		uint256 _voiceCreditsBalance
	) public {
		if (address(easCheckerFactory) == address(0))
			revert EASCheckerFactoryNotSet();
		if (address(easPolicyFactory) == address(0))
			revert EASPolicyFactoryNotSet();
		if (address(constantVoiceCreditProxyFactory) == address(0))
			revert VoiceCreditProxyFactoryNotSet();

		// Deploy EAS checker
		address checker = easCheckerFactory.deploy(
			_easContract,
			_attester,
			_schema
		);

		// Deploy EAS policy using the checker
		address policy = easPolicyFactory.deploy(checker);

		// Deploy constant voice credit proxy
		address voiceCreditProxy = constantVoiceCreditProxyFactory.deploy(
			_voiceCreditsBalance
		);

		// Create the poll using the deployed contracts
		PollContracts memory pollContracts = super.createPoll(
			_name,
			_options,
			_optionInfo,
			_metadata,
			_startTime,
			_endTime,
			_mode,
			_coordinatorPubKey,
			policy,
			voiceCreditProxy,
			_relayers
		);

		// Set the target of the policy contract
		IBasePolicy(policy).setTarget(pollContracts.poll);
	}

	/// @notice Create a poll with GitCoin Passport authentication
	/// @param _name The name of the poll
	/// @param _options The options of the poll
	/// @param _optionInfo The info of the options
	/// @param _metadata The metadata of the poll
	/// @param _startTime The start time of the poll
	/// @param _endTime The end time of the poll
	/// @param _mode The mode of the poll
	/// @param _coordinatorPubKey The coordinator public key
	/// @param _relayers The relayers of the poll
	/// @param _passportDecoder The GitCoin passport decoder contract address
	/// @param _thresholdScore The minimum score required
	/// @param _voiceCreditsBalance The balance for voice credits
	function createPollWithGitcoin(
		string calldata _name,
		string[] calldata _options,
		bytes[] calldata _optionInfo,
		string calldata _metadata,
		uint256 _startTime,
		uint256 _endTime,
		Mode _mode,
		PublicKey memory _coordinatorPubKey,
		address[] memory _relayers,
		address _passportDecoder,
		uint256 _thresholdScore,
		uint256 _voiceCreditsBalance
	) public {
		if (address(gitcoinCheckerFactory) == address(0))
			revert GitcoinCheckerFactoryNotSet();
		if (address(gitcoinPolicyFactory) == address(0))
			revert GitcoinPolicyFactoryNotSet();
		if (address(constantVoiceCreditProxyFactory) == address(0))
			revert VoiceCreditProxyFactoryNotSet();

		// Deploy GitCoin checker
		address checker = gitcoinCheckerFactory.deploy(
			_passportDecoder,
			_thresholdScore
		);

		// Deploy GitCoin policy using the checker
		address policy = gitcoinPolicyFactory.deploy(checker);

		// Deploy constant voice credit proxy
		address voiceCreditProxy = constantVoiceCreditProxyFactory.deploy(
			_voiceCreditsBalance
		);

		// Create the poll using the deployed contracts
		PollContracts memory pollContracts = super.createPoll(
			_name,
			_options,
			_optionInfo,
			_metadata,
			_startTime,
			_endTime,
			_mode,
			_coordinatorPubKey,
			policy,
			voiceCreditProxy,
			_relayers
		);

		// Set the target of the policy contract
		IBasePolicy(policy).setTarget(pollContracts.poll);
	}

	/// @notice Create a poll with Merkle Proof authentication
	/// @param _name The name of the poll
	/// @param _options The options of the poll
	/// @param _optionInfo The info of the options
	/// @param _metadata The metadata of the poll
	/// @param _startTime The start time of the poll
	/// @param _endTime The end time of the poll
	/// @param _mode The mode of the poll
	/// @param _coordinatorPubKey The coordinator public key
	/// @param _relayers The relayers of the poll
	/// @param _merkleRoot The merkle tree root
	/// @param _voiceCreditsBalance The balance for voice credits
	function createPollWithMerkle(
		string calldata _name,
		string[] calldata _options,
		bytes[] calldata _optionInfo,
		string calldata _metadata,
		uint256 _startTime,
		uint256 _endTime,
		Mode _mode,
		PublicKey memory _coordinatorPubKey,
		address[] memory _relayers,
		bytes32 _merkleRoot,
		uint256 _voiceCreditsBalance
	) public {
		if (address(merkleCheckerFactory) == address(0))
			revert MerkleCheckerFactoryNotSet();
		if (address(merklePolicyFactory) == address(0))
			revert MerklePolicyFactoryNotSet();
		if (address(constantVoiceCreditProxyFactory) == address(0))
			revert VoiceCreditProxyFactoryNotSet();

		// Deploy Merkle checker
		address checker = merkleCheckerFactory.deploy(_merkleRoot);

		// Deploy Merkle policy using the checker
		address policy = merklePolicyFactory.deploy(checker);

		// Deploy constant voice credit proxy
		address voiceCreditProxy = constantVoiceCreditProxyFactory.deploy(
			_voiceCreditsBalance
		);

		// Create the poll using the deployed contracts
		PollContracts memory pollContracts = super.createPoll(
			_name,
			_options,
			_optionInfo,
			_metadata,
			_startTime,
			_endTime,
			_mode,
			_coordinatorPubKey,
			policy,
			voiceCreditProxy,
			_relayers
		);

		// Set the target of the policy contract
		IBasePolicy(policy).setTarget(pollContracts.poll);
	}

	/// @notice Create a poll with Semaphore authentication
	/// @param _name The name of the poll
	/// @param _options The options of the poll
	/// @param _optionInfo The info of the options
	/// @param _metadata The metadata of the poll
	/// @param _startTime The start time of the poll
	/// @param _endTime The end time of the poll
	/// @param _mode The mode of the poll
	/// @param _coordinatorPubKey The coordinator public key
	/// @param _relayers The relayers of the poll
	/// @param _semaphoreContract The Semaphore contract address
	/// @param _groupId The Semaphore group ID
	/// @param _voiceCreditsBalance The balance for voice credits
	function createPollWithSemaphore(
		string calldata _name,
		string[] calldata _options,
		bytes[] calldata _optionInfo,
		string calldata _metadata,
		uint256 _startTime,
		uint256 _endTime,
		Mode _mode,
		PublicKey memory _coordinatorPubKey,
		address[] memory _relayers,
		address _semaphoreContract,
		uint256 _groupId,
		uint256 _voiceCreditsBalance
	) public {
		if (address(semaphoreCheckerFactory) == address(0))
			revert SemaphoreCheckerFactoryNotSet();
		if (address(semaphorePolicyFactory) == address(0))
			revert SemaphorePolicyFactoryNotSet();
		if (address(constantVoiceCreditProxyFactory) == address(0))
			revert VoiceCreditProxyFactoryNotSet();

		// Deploy Semaphore checker
		address checker = semaphoreCheckerFactory.deploy(
			_semaphoreContract,
			_groupId
		);

		// Deploy Semaphore policy using the checker
		address policy = semaphorePolicyFactory.deploy(checker);

		// Deploy constant voice credit proxy
		address voiceCreditProxy = constantVoiceCreditProxyFactory.deploy(
			_voiceCreditsBalance
		);

		// Create the poll using the deployed contracts
		PollContracts memory pollContracts = super.createPoll(
			_name,
			_options,
			_optionInfo,
			_metadata,
			_startTime,
			_endTime,
			_mode,
			_coordinatorPubKey,
			policy,
			voiceCreditProxy,
			_relayers
		);

		// Set the target of the policy contract
		IBasePolicy(policy).setTarget(pollContracts.poll);
	}

	/// @notice Create a poll with Zupass authentication
	/// @param _name The name of the poll
	/// @param _options The options of the poll
	/// @param _optionInfo The info of the options
	/// @param _metadata The metadata of the poll
	/// @param _startTime The start time of the poll
	/// @param _endTime The end time of the poll
	/// @param _mode The mode of the poll
	/// @param _coordinatorPubKey The coordinator public key
	/// @param _relayers The relayers of the poll
	/// @param _eventId Zupass event UUID converted to bigint
	/// @param _signer1 Zupass event signer[0] converted to bigint
	/// @param _signer2 Zupass event signer[1] converted to bigint
	/// @param _verifier The ZupassGroth16Verifier contract address
	/// @param _voiceCreditsBalance The balance for voice credits
	function createPollWithZupass(
		string calldata _name,
		string[] calldata _options,
		bytes[] calldata _optionInfo,
		string calldata _metadata,
		uint256 _startTime,
		uint256 _endTime,
		Mode _mode,
		PublicKey memory _coordinatorPubKey,
		address[] memory _relayers,
		uint256 _eventId,
		uint256 _signer1,
		uint256 _signer2,
		address _verifier,
		uint256 _voiceCreditsBalance
	) public {
		if (address(zupassCheckerFactory) == address(0))
			revert ZupassCheckerFactoryNotSet();
		if (address(zupassPolicyFactory) == address(0))
			revert ZupassPolicyFactoryNotSet();
		if (address(constantVoiceCreditProxyFactory) == address(0))
			revert VoiceCreditProxyFactoryNotSet();

		// Deploy Zupass checker
		address checker = zupassCheckerFactory.deploy(
			_eventId,
			_signer1,
			_signer2,
			_verifier
		);

		// Deploy Zupass policy using the checker
		address policy = zupassPolicyFactory.deploy(checker);

		// Deploy constant voice credit proxy
		address voiceCreditProxy = constantVoiceCreditProxyFactory.deploy(
			_voiceCreditsBalance
		);

		// Create the poll using the deployed contracts
		PollContracts memory pollContracts = super.createPoll(
			_name,
			_options,
			_optionInfo,
			_metadata,
			_startTime,
			_endTime,
			_mode,
			_coordinatorPubKey,
			policy,
			voiceCreditProxy,
			_relayers
		);

		// Set the target of the policy contract
		IBasePolicy(policy).setTarget(pollContracts.poll);
	}

	/// @notice Create a poll with Free For All policy (no authentication required)
	/// @param _name The name of the poll
	/// @param _options The options of the poll
	/// @param _optionInfo The info of the options
	/// @param _metadata The metadata of the poll
	/// @param _startTime The start time of the poll
	/// @param _endTime The end time of the poll
	/// @param _mode The mode of the poll
	/// @param _coordinatorPubKey The coordinator public key
	/// @param _relayers The relayers of the poll
	/// @param _voiceCreditsBalance The balance for voice credits
	function createPollWithFreeForAll(
		string calldata _name,
		string[] calldata _options,
		bytes[] calldata _optionInfo,
		string calldata _metadata,
		uint256 _startTime,
		uint256 _endTime,
		Mode _mode,
		PublicKey memory _coordinatorPubKey,
		address[] memory _relayers,
		uint256 _voiceCreditsBalance
	) public {
		if (address(freeForAllCheckerFactory) == address(0))
			revert FreeForAllCheckerFactoryNotSet();
		if (address(freeForAllPolicyFactory) == address(0))
			revert FreeForAllPolicyFactoryNotSet();
		if (address(constantVoiceCreditProxyFactory) == address(0))
			revert VoiceCreditProxyFactoryNotSet();

		// Deploy Free For All checker (no parameters required)
		address checker = freeForAllCheckerFactory.deploy();

		// Deploy Free For All policy using the checker
		address policy = freeForAllPolicyFactory.deploy(checker);

		// Deploy constant voice credit proxy
		address voiceCreditProxy = constantVoiceCreditProxyFactory.deploy(
			_voiceCreditsBalance
		);

		// Create the poll using the deployed contracts
		PollContracts memory pollContracts = super.createPoll(
			_name,
			_options,
			_optionInfo,
			_metadata,
			_startTime,
			_endTime,
			_mode,
			_coordinatorPubKey,
			policy,
			voiceCreditProxy,
			_relayers
		);

		// Set the target of the policy contract
		IBasePolicy(policy).setTarget(pollContracts.poll);
	}
}
