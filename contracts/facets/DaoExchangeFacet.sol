// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {DaoPermissable} from "./DaoPermissable.sol";
import {LibDao} from "./DaoPermissable.sol";
import {LibExchange} from "../libraries/facets/LibExchange.sol";

contract DaoExchangeFacet is DaoPermissable {
    using EnumerableSet for EnumerableSet.AddressSet;
    function createExchange(
        address[] memory _coinsOffered,
        address[] memory _coinsRequired,
        uint256[] memory _amountsOffered,
        uint256[] memory _amountsRequired,
        uint256 _repeats,
        uint256 _expiration
    )
        external
        isMember(msg.sender)
        onlyPermitted(LibDao.DaoPermission.exchange_create)
        returns (address)
    {
        //todo implement actual logic from commonshood
        return address(0x0);
    }

    function cancelExchange(
        address _exchangeID
    ) external isMember(msg.sender) onlyPermitted(LibDao.DaoPermission.exchange_cancel) {
        //todo implement actual logic from commonshood
    }

    function renewExchange(
        address _exchangeID
    ) external isMember(msg.sender) onlyPermitted(LibDao.DaoPermission.exchange_renew) {
        //todo implement actual logic from commonshood
    }

    function acceptExchange(
        address _exchangeID,
        address[] memory _coinsRequired,
        uint256[] memory _amountsRequired,
        uint256 repeats
    ) external isMember(msg.sender) onlyPermitted(LibDao.DaoPermission.exchange_accept) {
        //todo implement actual logic from commonshood
    }

    function refillExchange(
        address _exchangeID,
        address[] memory _coinsOffered,
        uint256[] memory _amountsOffered,
        uint256 _repeats
    ) external isMember(msg.sender) onlyPermitted(LibDao.DaoPermission.exchange_refill) {
        //todo implement actual logic from commonshood
    }

    function makeAdminExchange(
        address _exchangeID,
        address _address
    )
        external
        isMember(msg.sender)
        isMember(_address)
        onlyPermitted(LibDao.DaoPermission.exchange_setadmin)
    {
        LibExchange.DaoExchangeStorage storage des = LibExchange.daoExchangeStorage();
        require(
            isAuthorized(_address, LibDao.DaoPermission.exchange_canmanage),
            "target user has not enough permissions to be set as exchange admin"
        );
        //todo implement actual logic from commonshood
        require(
            !des.exchangeManagement[_address].managedExchanges.contains(_exchangeID),
            "target user already has permissions for the given exchange"
        );
        des.exchangeManagement[_address].managedExchanges.add(_exchangeID);
    }

    function removeAdminExchange(
        address _exchangeID,
        address _address
    )
        external
        isMember(msg.sender)
        isMember(_address)
        onlyPermitted(LibDao.DaoPermission.exchange_setadmin)
    {
        LibExchange.DaoExchangeStorage storage des = LibExchange.daoExchangeStorage();
        require(
            isAuthorized(_address, LibDao.DaoPermission.exchange_canmanage),
            "target user has not enough permissions to be set as exchange admin"
        );
        //todo implement actual logic from commonshood
        require(
            des.exchangeManagement[_address].managedExchanges.contains(_exchangeID),
            "target user already has not permissions for the given exchange"
        );
        
        des.exchangeManagement[_address].managedExchanges.remove(_exchangeID);
    }

    function getExchangeManagement(
        address _exchangeID,
        address _address
    ) external view returns (bool) {
        LibExchange.DaoExchangeStorage storage des = LibExchange.daoExchangeStorage();
        return des.exchangeManagement[_address].managedExchanges.contains(_exchangeID);
    }
}