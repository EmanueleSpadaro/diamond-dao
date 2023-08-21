// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import {DaoPermissable} from "./DaoPermissable.sol";
import {LibDao} from "./DaoPermissable.sol";

contract DaoExchangeFacet is DaoPermissable {
    function createExchange() external view onlyPermitted(LibDao.DaoPermission.exchange_create)returns (bool) {
        return true;
    }
}