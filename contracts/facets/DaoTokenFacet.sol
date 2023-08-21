// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import {DaoPermissable} from "./DaoPermissable.sol";
import {LibDao} from "./DaoPermissable.sol";

contract DaoTokenFacet is DaoPermissable {
    function createToken() external view onlyPermitted(LibDao.DaoPermission.token_create)returns (bool) {
        return true;
    }
}