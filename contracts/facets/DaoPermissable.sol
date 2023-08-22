// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import "../libraries/LibDao.sol";
import {IDao} from "../interfaces/IDao.sol";

abstract contract DaoPermissable {
    modifier onlyPermitted(LibDao.DaoPermission perm) {
        IDao dao = IDao(address(this));
        //FIXME:move hasPermission as internal in DaoPermissable
        //TODO: move hasPermission as internal in DaoPermissable
        require(dao.hasPermission(msg.sender, perm), "not-enough-permissions");
        _;
    }

    modifier isMember(address addr) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        require(
            ds.usersRole[addr] != LibDao.DEFAULT_ADMIN_ROLE,
            "you're required to be a member"
        );
        _;
    }

    function isAuthorized(
        address account,
        LibDao.DaoPermission perm
    ) internal view returns (bool) {
        return IDao(address(this)).hasPermission(account, perm);
    }
}
