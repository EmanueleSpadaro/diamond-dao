// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import {DaoPermissable} from "./DaoPermissable.sol";
import {LibDao} from "./DaoPermissable.sol";

contract DaoCrowdsaleFacet is DaoPermissable {
    function createCrowdsale() external view onlyPermitted(LibDao.DaoPermission.crowd_create)returns (bool) {
        return true;
    }
}