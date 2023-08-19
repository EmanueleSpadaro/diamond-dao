// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

library LibDao {
    using EnumerableSet for EnumerableSet.UintSet;
    bytes32 constant DAO_STORAGE_POSITION =
        keccak256("eu.commonshood.dao.storage");

    bytes32 constant DEFAULT_ADMIN_ROLE = bytes32(0);
    bytes32 constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 constant USER_ROLE = keccak256("USER_ROLE");

    struct DaoStorage {
        address owner;
        string realm;
        string name;
        string firstlifePlaceID;
        string description_cid;
        bool isInviteOnly;
        mapping(address => bytes32) usersRole;
        mapping(bytes32 => address[]) roleUsers;
        mapping(bytes32 => bytes32) roleHierarchy;
        mapping(bytes32 => RolePermissionsStruct) rolePermissions;
        mapping(address => bytes32) invites;
        mapping(address => bytes32) promotions;
    }

    //Auxiliary struct to allow us to delete rolePermissions in case of role deletion
    struct RolePermissionsStruct {
        EnumerableSet.UintSet permissions;
    }

    //Struct to pass arguments to the Diamond-DAO in order to avoid stack too deep errors
    struct DaoConstructorArgs {
        address owner;
        string realm;
        string name;
        string firstlifePlaceID;
        string description_cid;
        bool isInviteOnly;
    }

    function diamondStorage() internal pure returns (DaoStorage storage ds) {
        bytes32 position = DAO_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    //Events throwed by Daos
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    event UserJoined(address indexed user, bytes32 asRole);
    event UserInvited(address indexed by, address user);
    event UserDeranked(address indexed by, address user, bytes32 toRole);
    event UserPromotionProposed(
        address indexed by,
        address user,
        bytes32 toRole
    );
    event UserPromoted(address indexed user, bytes32 toRole);
    event UserKicked(address indexed by, address user);
    event UserTokenAuthorization(
        address indexed by,
        address user,
        string token
    );
    event UserTokenAuthorizationRevoked(
        address indexed by,
        address user,
        string token
    );

    //Internal methods

    function initDao(DaoConstructorArgs memory _args) internal {
        DaoStorage storage ds = diamondStorage();
        ds.owner = _args.owner;
        ds.realm = _args.realm;
        ds.name = _args.name;
        ds.firstlifePlaceID = _args.firstlifePlaceID;
        ds.description_cid = _args.description_cid;
        ds.isInviteOnly = _args.isInviteOnly;

        ds.usersRole[_args.owner] = OWNER_ROLE;
        //USER < OWNER
        ds.roleHierarchy[USER_ROLE] = OWNER_ROLE;

        for (uint8 i = 0; i < uint8(DaoPermission.COUNT); i++) {
            ds.rolePermissions[OWNER_ROLE].permissions.add(uint256(DaoPermission(i)));
        }
    }

    enum DaoPermission {
        //Whether it can alter the inviteOnly flag for the given DAO
        invite_switch,
        //Whether it can manage all tokens
        token_all,
        //Whether it can manage only specific tokens
        token_specific,
        //Whether it can transfer manageable tokens
        token_transfer,
        //Whether it can create tokens
        token_create,
        //Whether it can mint manageable tokens
        token_mint,
        //Whether it can authorize others to use a specific token
        token_auth,
        //Whether it can be set as authorized to manage specific tokens
        token_canmanage,
        //Whether it can create a crowdsale
        crowd_create,
        //Whether it can join a crowdsale
        crowd_join,
        //Whether it can unlock a crowdsale
        crowd_unlock,
        //Whether it can refund a crowdsale
        crowd_refund,
        //Whether it can stop a crowdsale
        crowd_stop,
        //Whether it can offer / revoke a DAO member (must have crowd_canmanage permission) management privileges regarding a specific crowdsale
        crowd_setadmin,
        //Whether it can be set as crowdsale manager by members with crowd_setadmin permissions
        crowd_canmanage,
        //Whether it can create an exchange
        exchange_create,
        //Whether it can cancel an exchange
        exchange_cancel,
        //Whether it can renew an exchange
        exchange_renew,
        //Whether it can accept an exchange
        exchange_accept,
        //Whether it can refill an exchange
        exchange_refill,
        //Whether it can offer / revoke a DAO member (that has exchange_canmanage permission) management privileges regarding a specific exchange
        exchange_setadmin,
        //Whether it can be set as exchange manager by members with exchange_setadmin permissions
        exchange_canmanage,
        //using the "counting enum pattern" to get the number of elements in the enum
        COUNT
    }
}
