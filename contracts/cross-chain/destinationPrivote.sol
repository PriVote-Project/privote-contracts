// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { CCIPReceiver } from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import { Withdraw } from "./utils/Withdraw.sol";
import { IPrivote } from "../IPrivote.sol";
import { IPoll } from "maci-contracts/contracts/interfaces/IPoll.sol";
import { DomainObjs } from "maci-contracts/contracts/utilities/DomainObjs.sol";

contract DestinationPrivote is CCIPReceiver, Withdraw {
	bytes32 latestMessageId;
	uint64 latestSourceChainSelector;
	address latestSender;
	string latestMessage;
	IPrivote public privote;

	event MessageReceived(
		bytes32 latestMessageId,
		uint64 latestSourceChainSelector,
		address latestSender,
		string latestMessage
	);

	constructor(address router, address privoteAddress) CCIPReceiver(router) {
		privote = IPrivote(privoteAddress);
	}

	function _ccipReceive(
		Client.Any2EVMMessage memory message
	) internal override {
		latestMessageId = message.messageId;
		latestSourceChainSelector = message.sourceChainSelector;
		latestSender = abi.decode(message.sender, (address));
		(string memory functionName, bytes memory data) = abi.decode(
			message.data,
			(string, bytes)
		);

		if (
			keccak256(abi.encode(functionName)) ==
			keccak256(abi.encode("publishMessage"))
		) {
			(
				uint256 pollId,
				DomainObjs.Message memory messageText,
				DomainObjs.PubKey memory encPubKey
			) = abi.decode(
					data,
					(uint256, DomainObjs.Message, DomainObjs.PubKey)
				);
			IPrivote.PollData memory poll = privote.fetchPoll(pollId);
			IPoll(poll.pollContracts.poll).publishMessage(
				messageText,
				encPubKey
			);
		} else if (
			keccak256(abi.encode(functionName)) ==
			keccak256(abi.encode("signUp"))
		) {
			(
				DomainObjs.PubKey memory _pubKey,
				bytes memory _signUpGatekeeperData,
				bytes memory _initialVoiceCreditProxyData
			) = abi.decode(data, (DomainObjs.PubKey, bytes, bytes));
			privote.signUp(
				_pubKey,
				_signUpGatekeeperData,
				_initialVoiceCreditProxyData
			);
		}

		emit MessageReceived(
			latestMessageId,
			latestSourceChainSelector,
			latestSender,
			latestMessage
		);
	}

	function getLatestMessageDetails()
		public
		view
		returns (bytes32, uint64, address, string memory)
	{
		return (
			latestMessageId,
			latestSourceChainSelector,
			latestSender,
			latestMessage
		);
	}
}
