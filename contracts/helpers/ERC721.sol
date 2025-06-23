// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract SimpleERC721 is ERC721 {
	uint256 nextTokenId = 1;

	constructor() ERC721("SimpleToken", "LORD") {
		_mint(msg.sender, 0);
	}

	function mint() public {
		_mint(msg.sender, nextTokenId);
		nextTokenId++;
	}

	function mintTo(address to) public {
		_mint(to, nextTokenId);
		nextTokenId++;
	}
}
