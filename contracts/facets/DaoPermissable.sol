// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import "../libraries/LibDao.sol";
import {IDao} from "../interfaces/IDao.sol";

abstract contract DaoPermissable {
    modifier onlyPermitted(LibDao.DaoPermission perm) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        IDao dao = IDao(address(this));
        require(
            dao.hasPermission(msg.sender, perm),
            "not-enough-permissions"
        );
        _;
    }
}