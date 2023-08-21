// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {LibDao} from "../libraries/LibDao.sol";
import {IDao} from "../interfaces/IDao.sol";
import {DaoPermissable} from "./DaoPermissable.sol";

contract DaoFacet is IDao, DaoPermissable {
    using EnumerableSet for EnumerableSet.UintSet;
    //Modifier that allows to execute the code only if the caller IS a member
    modifier isMember(address addr) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        require(
            ds.usersRole[addr] != LibDao.DEFAULT_ADMIN_ROLE,
            "you're required to be a member"
        );
        _;
    }

    //Modifier that allows to execute the code only if the caller IS NOT a member
    modifier isNotMember(address addr) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        require(
            ds.usersRole[addr] == LibDao.DEFAULT_ADMIN_ROLE,
            "you're required to not be a member"
        );
        _;
    }

    //Modifier that allows to execute the code only if the caller has a pending invitation
    modifier hasInvite() {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        require(ds.invites[msg.sender] != 0, "no invite available for you");
        _;
    }

    //Modifier that allows to execute the code only if the caller has a pending promotion
    modifier hasPromotion() {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        require(ds.promotions[msg.sender] != 0, "no promotion pending");
        _;
    }

    //Modifier that allows to execute the code only if the caller is hierarchically superior in terms of rank
    modifier isAdminOf(address ofAddress) {
        require(
            isAdminOfRole(msg.sender, _getRole(ofAddress)),
            "you're required to be of higher rank"
        );
        _;
    }

    //Modifier that extends the behaviour achievable with onlyRole(getRoleAdmin(role)) to hierarchically superior ranks
    modifier onlyAdmins(bytes32 role) {
        require(
            isAdminOfRole(msg.sender, role),
            "only higher ranks of the given role are allowed"
        );
        _;
    }

    modifier onlyRole(bytes32 role) {
        require(_getRole(msg.sender) == role, "role not allowed");
        _;
    }

    //TODO: move this logic into a DaoTokenFacet contract
    // modifier canManageToken(string memory tokenSymbol) {
    //     require(getTokenAuth(tokenSymbol, msg.sender), "not authorized to manage token");
    //     _;
    // }

    modifier isLegitRole(bytes32 role) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        require(_isLegitRole(role), "non-existing role");
        _;
        /*TODO: fare tabella di true / false, spiegazione, documentazione di questa scelta implementaziona
          1. bisogna inoltre garantire che LibDao.USER_ROLE e LibDao.OWNER_ROLE non siano cancellati per mantenere la gerarchia integra
          2. bisogna far sì che nessun ruolo abbia LibDao.DEFAULT_ADMIN_ROLE come upper role se non per LibDao.OWNER_ROLE, che deve essere l'unico ad averlo
        */
    }

    modifier notDefaultRole(bytes32 role) {
        require(!isDefaultRole(role), "non-default DAO role expected");
        _;
    }

    function isDefaultRole(bytes32 role) internal pure returns (bool) {
        return role == LibDao.USER_ROLE || role == LibDao.OWNER_ROLE;
    }

    function _isLegitRole(bytes32 role) internal view returns (bool) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        return
            (role != LibDao.OWNER_ROLE &&
                ds.roleHierarchy[role] != LibDao.DEFAULT_ADMIN_ROLE) ||
            role == LibDao.OWNER_ROLE;
    }

    function isAdminOfRole(
        bytes32 isAdminRole,
        bytes32 ofRole
    ) internal view returns (bool) {
        bytes32 ofRoleAdminRole = getRoleAdmin(ofRole);
        while (ofRoleAdminRole != LibDao.DEFAULT_ADMIN_ROLE) {
            if (ofRoleAdminRole == isAdminRole) {
                return true;
            }
            ofRoleAdminRole = getRoleAdmin(ofRoleAdminRole);
        }
        return isAdminRole == LibDao.DEFAULT_ADMIN_ROLE;
    }

    function isAdminOfRole(
        address isAdmin,
        bytes32 ofRole
    ) internal view returns (bool) {
        return isAdminOfRole(_getRole(isAdmin), ofRole);
    }

    //Joins the DAO
    function join() external isNotMember(msg.sender) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        require(!ds.isInviteOnly, "can't freely join invite-only dao");
        delete ds.invites[msg.sender];
        _grantRole(LibDao.USER_ROLE, msg.sender);
        //TODO: daoFactory notification emission on join?
        //daoFactory.addJoinedDaoTo(msg.sender);

        //TODO: UserJoin emission on join by the diamond itself?
        //emit UserJoined(msg.sender, USER_ROLE);
    }

    //TODO: invite_switch shall be implemented in some way (maybe hasPermission(daoFacetContextAddress, permission_enum_int))
    //Alters the DAO Invite-Only flag
    function setInviteOnly(
        bool newValue
    )
        external
        isMember(msg.sender)
        onlyPermitted(LibDao.DaoPermission.invite_switch)
    {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        require(
            ds.isInviteOnly != newValue,
            "invite only already set as desired value"
        );
        ds.isInviteOnly = newValue;
    }

    //Invites a user with the given role to join the DAO
    function invite(
        address toInvite,
        bytes32 offeredRole
    )
        external
        isMember(msg.sender)
        isNotMember(toInvite)
        onlyAdmins(offeredRole)
    {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        ds.invites[toInvite] = offeredRole;
        //TODO: event emission
        //emit UserInvited(msg.sender, toInvite);
    }

    //Accepts an invite to the DAO
    function acceptInvite() external hasInvite {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        //We assign the role
        _grantRole(ds.invites[msg.sender], msg.sender);
        //We delete the invite since it's been accepted
        ds.invites[msg.sender] = 0;
        //TODO: factory notification
        // daoFactory.addJoinedDaoTo(msg.sender);
        //TODO: Userjoined by this contract emission
        // emit UserJoined(msg.sender, users[msg.sender].role);
    }

    //Declines an invite to the DAO
    function declineInvite() external hasInvite {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        //We delete the invite since it's been declined
        ds.invites[msg.sender] = 0;
    }

    function modifyRank(address toModify, bytes32 newRole) external {
        _modifyRank(toModify, newRole);
    }

    //Offers a promotion if the new role is higher than the current one, otherwise it deranks instantly, if we have enough permissions
    function _modifyRank(
        address toModify,
        bytes32 newRole
    ) internal isMember(toModify) isAdminOf(toModify) onlyAdmins(newRole) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        bool isPromotion = isAdminOfRole(newRole, _getRole(toModify));
        //If there's a pending promotion, we delete it whether it's a promotion or not
        delete ds.promotions[toModify];
        //If it's a promotion, there is a 2Phase (offer && accept/refuse)
        if (isPromotion) {
            ds.promotions[toModify] = newRole;
            //TODO: event emission
            // emit UserPromotionProposed(msg.sender, toModify, newRole);
            return;
        }
        //If it's not a promotion, we just revoke the role and emit the event
        _revokeRole(toModify);
        _grantRole(newRole, toModify);
        //TODO: event emission
        // emit UserDeranked(msg.sender, toModify, newRole);
    }

    function acceptPromotion() external isMember(msg.sender) hasPromotion {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        _revokeRole(msg.sender);
        _grantRole(ds.promotions[msg.sender], msg.sender);
        delete ds.promotions[msg.sender];
        //TODO: event emission
        // emit UserPromoted(msg.sender, users[msg.sender].role);
    }

    function refusePromotion() external isMember(msg.sender) hasPromotion {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        //TODO: shall we emit an event?
        delete ds.promotions[msg.sender];
    }

    //Kicks a member if we have enough permissions
    function kickMember(
        address toKick
    ) external isMember(toKick) isAdminOf(toKick) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        //We clear out possible promotions before kicking the member
        delete ds.promotions[toKick];
        //Revoke role inherently deletes the kicked member struct, deleting their management permissions
        _revokeRole(toKick);
        //TODO: factory notification
        // daoFactory.removeJoinedDaoFrom(toKick);
        //TODO: event emission
        // emit UserKicked(msg.sender, toKick);
    }

    //FIXME: shall also be externally callable
    function hasRole(
        bytes32 role,
        address account
    ) internal view returns (bool) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        return ds.usersRole[account] == role;
    }

    //Returns the provided address' role
    function getRole(address account) external view returns (bytes32) {
        return _getRole(account);
    }

    function _getRole(address account) internal view returns (bytes32) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        return ds.usersRole[account];
    }

    function _grantRole(bytes32 role, address account) internal {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        ds.usersRole[account] = role;
    }

    function _revokeRole(address account) internal {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        delete ds.usersRole[account];
    }

    function _grantPermission(
        LibDao.DaoPermission perm,
        bytes32 toRole
    ) internal {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        ds.rolePermissions[toRole].permissions.add(uint256(perm));
    }

    function _revokePermission(
        LibDao.DaoPermission perm,
        bytes32 toRole
    ) internal {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        ds.rolePermissions[toRole].permissions.remove(uint256(perm));
    }

    //TODO: associate or atleast throw an event with the friendly name string of the rank?
    function addRole(
        bytes32 newRole,
        bytes32 adminRole
    ) external onlyRole(LibDao.OWNER_ROLE) isLegitRole(adminRole) {
        require(!_isLegitRole(newRole), "already existing role");
        require(
            adminRole != LibDao.USER_ROLE,
            "user role shall not have ranks below"
        );
        require(
            newRole != LibDao.DEFAULT_ADMIN_ROLE,
            "cannot add DEFAULT_ADMIN_ROLE to role hierarchy"
        );
        bytes32 role = LibDao.USER_ROLE;
        while (getRoleAdmin(role) != adminRole) {
            role = getRoleAdmin(role);
        }
        _setRoleAdmin(role, newRole);
        _setRoleAdmin(newRole, adminRole);
        //We went from Role -> AdminRole to
        //Role -> NewRole -> AdminRole
    }

    function removeRole(
        bytes32 toRemove
    )
        external
        onlyRole(LibDao.OWNER_ROLE)
        isLegitRole(toRemove)
        notDefaultRole(toRemove)
    {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        //We remove the role from the EnumerableSet
        delete ds.roleHierarchy[toRemove];
        //We iterate over each member of the role to demote them to User
        address[] memory roleMembers = getRoleMembers(toRemove);
        for (uint256 i = 0; i < roleMembers.length; i++) {
            _modifyRank(roleMembers[i], LibDao.USER_ROLE);
        }
        bytes32 upperRankOfRemovedOne = getRoleAdmin(toRemove);
        //We rebuild the hierarchy, we need to find the role right below the removed one
        bytes32 role = LibDao.USER_ROLE;
        while (getRoleAdmin(role) != toRemove) {
            //We got up until we have the removed one as admin
            role = getRoleAdmin(role);
        }
        _setRoleAdmin(role, upperRankOfRemovedOne);
    }

    //safe grantRole: if the role exists, it allows only hierarchically superior ranks to execute it
    function grantRole(
        bytes32 role,
        address account
    ) external onlyAdmins(role) isAdminOf(account) isLegitRole(role) {
        _grantRole(role, account);
    }

    //safe grantRole: if the role exists, it allows only hierarchically superior ranks to execute it
    function revokeRole(
        bytes32 role,
        address account
    ) external onlyAdmins(role) isAdminOf(account) isLegitRole(role) {
        require(
            _getRole(account) == role,
            "target account does not have to-be-revoked role"
        );
        _revokeRole(account);
    }

    function getRoleAdmin(bytes32 role) internal view returns (bytes32) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        return ds.roleHierarchy[role];
    }

    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        ds.roleHierarchy[role] = adminRole;
    }

    function getRoleMemberCount(bytes32 role) external view returns (uint256) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        return ds.roleUsers[role].length;
    }

    //TODO: shall we make it pure?
    function getRoleMembers(
        bytes32 role
    ) internal view returns (address[] memory) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        return ds.roleUsers[role];
    }

    //View getters
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

    function getRolesCount() internal view returns (uint) {
        uint count = 0;
        bytes32 role = LibDao.USER_ROLE;
        while (role != LibDao.DEFAULT_ADMIN_ROLE) {
            role = getRoleAdmin(role);
            count++;
        }
        return count;
    }

    function getRoleHierarchy() external view returns (bytes32[] memory) {
        bytes32[] memory rolesArr = new bytes32[](getRolesCount());
        bytes32 role = LibDao.USER_ROLE;
        uint i = 0;
        while (role != LibDao.DEFAULT_ADMIN_ROLE) {
            rolesArr[i++] = role;
            role = getRoleAdmin(role);
        }
        return rolesArr;
    }

    function hasPermission(
        address account,
        LibDao.DaoPermission perm
    ) external view returns (bool) {
        LibDao.DaoStorage storage ds = LibDao.diamondStorage();
        return
            ds.rolePermissions[_getRole(account)].permissions.contains(
                uint256(perm)
            );
    }
}
