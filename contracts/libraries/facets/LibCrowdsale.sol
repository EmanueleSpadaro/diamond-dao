// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

library LibCrowdsale {
    using EnumerableSet for EnumerableSet.AddressSet;
    bytes32 constant DAO_CROWDSALE_POSITION = keccak256('eu.commonshood.dao.crowdsale.storage');

    struct DaoCrowdsaleStorage {
        mapping (address => DaoUserCrowdAuth) crowdManagement;
    }

    struct DaoUserCrowdAuth {
        EnumerableSet.AddressSet managedCrowdsales;
    }

    function daoCrowdsaleStorage() internal pure returns (DaoCrowdsaleStorage storage ds) {
        bytes32 position = DAO_CROWDSALE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}