// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { EAS } from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";
import { ISchemaRegistry } from "@ethereum-attestation-service/eas-contracts/contracts/ISchemaRegistry.sol";

contract SimpleEAS is EAS {
	constructor(ISchemaRegistry registry) EAS(registry) {}
}
