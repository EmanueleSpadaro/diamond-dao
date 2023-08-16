// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import { LibDao } from "../libraries/LibDao.sol";

contract DaoFacet {
    function getOwner() external view returns (address) {
        LibDao.DaoStorage storage ds;
        bytes32 position = LibDao.DAO_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        return ds.owner;
    }

    function getRealm() external view returns (string memory) {
        LibDao.DaoStorage storage ds;
        bytes32 position = LibDao.DAO_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        return ds.realm;
    }

    function getName() external view returns (string memory) {
        LibDao.DaoStorage storage ds;
        bytes32 position = LibDao.DAO_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        return ds.name;
    }

    function getFirstlifePlaceID() external view returns (string memory) {
        LibDao.DaoStorage storage ds;
        bytes32 position = LibDao.DAO_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        return ds.firstlifePlaceID;
    }

    function getDescriptionCID() external view returns (string memory) {
        LibDao.DaoStorage storage ds;
        bytes32 position = LibDao.DAO_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        return ds.description_cid;
    }

    function getIsInviteOnly() external view returns (bool) {
        LibDao.DaoStorage storage ds;
        bytes32 position = LibDao.DAO_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        return ds.isInviteOnly;
    }
}