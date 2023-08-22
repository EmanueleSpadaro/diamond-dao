// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

library LibToken {
    using EnumerableSet for EnumerableSet.Bytes32Set;
    bytes32 constant DAO_TOKEN_POSITION = keccak256('eu.commonshood.dao.token.storage');

    struct DaoTokenStorage {
        mapping (address => DaoUserTokenAuth) tokenManagement;
    }

    struct DaoUserTokenAuth {
        EnumerableSet.Bytes32Set managedTokens;
    }

    function daoTokenStorage() internal pure returns (DaoTokenStorage storage ds) {
        bytes32 position = DAO_TOKEN_POSITION;
        assembly {
            ds.slot := position
        }
    }
}