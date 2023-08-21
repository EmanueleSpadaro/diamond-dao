// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import {LibDao} from "../libraries/LibDao.sol";

interface IDao {
    function getRole(address account) external view returns (bytes32);
    function hasPermission(address account, LibDao.DaoPermission) external view returns (bool);
}