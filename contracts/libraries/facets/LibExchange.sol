// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

library LibExchange {
    using EnumerableSet for EnumerableSet.AddressSet;
    bytes32 constant DAO_EXCHANGE_POSITION = keccak256('eu.commonshood.dao.exchange.storage');

    struct DaoExchangeStorage {
        mapping (address => DaoUserExchangeAuth) exchangeManagement;
    }

    struct DaoUserExchangeAuth {
        EnumerableSet.AddressSet managedExchanges;
    }

    function daoExchangeStorage() internal pure returns (DaoExchangeStorage storage ds) {
        bytes32 position = DAO_EXCHANGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}