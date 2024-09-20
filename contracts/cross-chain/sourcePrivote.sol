// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { LinkTokenInterface } from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import { Withdraw } from "./utils/Withdraw.sol";
import { DomainObjs } from "maci-contracts/contracts/utilities/DomainObjs.sol";

contract SourcePrivote is Withdraw {
	enum PayFeesIn {
		Native,
		LINK
	}

	address immutable i_router;
	address immutable i_link;

	event MessageSent(bytes32 messageId);

	constructor(address router, address link) {
		i_router = router;
		i_link = link;
	}

	receive() external payable {}

	function vote(
		uint64 destinationChainSelector,
		address receiver,
		uint256 pollId,
		DomainObjs.Message memory messageText,
		DomainObjs.PubKey calldata encPubKey,
		PayFeesIn payFeesIn
	) external {
		Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
			receiver: abi.encode(receiver),
			data: abi.encode(
				"publishMessage",
				abi.encode(pollId, messageText, encPubKey)
			),
			tokenAmounts: new Client.EVMTokenAmount[](0),
			extraArgs: "",
			feeToken: payFeesIn == PayFeesIn.LINK ? i_link : address(0)
		});

		uint256 fee = IRouterClient(i_router).getFee(
			destinationChainSelector,
			message
		);

		bytes32 messageId;

		if (payFeesIn == PayFeesIn.LINK) {
			LinkTokenInterface(i_link).approve(i_router, fee);
			messageId = IRouterClient(i_router).ccipSend(
				destinationChainSelector,
				message
			);
		} else {
			messageId = IRouterClient(i_router).ccipSend{ value: fee }(
				destinationChainSelector,
				message
			);
		}

		emit MessageSent(messageId);
	}

	function signup(
		uint64 destinationChainSelector,
		address receiver,
		DomainObjs.PubKey memory _pubKey,
		bytes memory _signUpGatekeeperData,
		bytes memory _initialVoiceCreditProxyData,
		PayFeesIn payFeesIn
	) external {
		Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
			receiver: abi.encode(receiver),
			data: abi.encode(
				"signup",
				abi.encode(
					_pubKey,
					_signUpGatekeeperData,
					_initialVoiceCreditProxyData
				)
			),
			tokenAmounts: new Client.EVMTokenAmount[](0),
			extraArgs: "",
			feeToken: payFeesIn == PayFeesIn.LINK ? i_link : address(0)
		});

		uint256 fee = IRouterClient(i_router).getFee(
			destinationChainSelector,
			message
		);

		bytes32 messageId;

		if (payFeesIn == PayFeesIn.LINK) {
			LinkTokenInterface(i_link).approve(i_router, fee);
			messageId = IRouterClient(i_router).ccipSend(
				destinationChainSelector,
				message
			);
		} else {
			messageId = IRouterClient(i_router).ccipSend{ value: fee }(
				destinationChainSelector,
				message
			);
		}

		emit MessageSent(messageId);
	}
}
