// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

library LibDao {
    bytes32 constant DAO_STORAGE_POSITION = keccak256("eu.commonshood.dao.storage");

    bytes32 constant DEFAULT_ADMIN_ROLE = bytes32(0);
    bytes32 constant OWNER_ROLE = keccak256('OWNER_ROLE');
    bytes32 constant USER_ROLE = keccak256('USER_ROLE');

    struct DaoStorage {
        address owner;
        string realm;
        string name;
        string firstlifePlaceID;
        string description_cid;
        bool isInviteOnly;
        mapping (address => bytes32) usersRole;
        mapping (bytes32 => address[]) roleUsers;
        mapping (bytes32 => bytes32) roleHierarchy;
        mapping(address => bytes32) invites;
        mapping(address => bytes32) promotions;
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
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event UserJoined(address indexed user, bytes32 asRole);
    event UserInvited(address indexed by, address user);
    event UserDeranked(address indexed by, address user, bytes32 toRole);
    event UserPromotionProposed(address indexed by, address user, bytes32 toRole);
    event UserPromoted(address indexed user, bytes32 toRole);
    event UserKicked(address indexed by, address user);
    event UserTokenAuthorization(address indexed by, address user, string token);
    event UserTokenAuthorizationRevoked(address indexed by, address user, string token);

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
    }
}