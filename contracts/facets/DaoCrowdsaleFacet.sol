// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {DaoPermissable} from "./DaoPermissable.sol";
import {LibDao} from "./DaoPermissable.sol";
import {LibCrowdsale} from "../libraries/facets/LibCrowdsale.sol";

contract DaoCrowdsaleFacet is DaoPermissable {
    using EnumerableSet for EnumerableSet.AddressSet;

    function createCrowdsale(
        address _tokenToGive,
        address _tokenToAccept,
        uint256 _start,
        uint256 _end,
        uint256 _acceptRatio,
        uint256 _giveRatio,
        uint256 _maxCap,
        string memory _title,
        string memory _description,
        string memory _logoHash,
        string memory _TOSHash
    ) external view onlyPermitted(LibDao.DaoPermission.crowd_create) {}

    function unlockCrowdsale(
        address _crowdsaleID,
        address _tokenToGive,
        uint256 _amount
    ) external onlyPermitted(LibDao.DaoPermission.crowd_unlock) {
        //todo implement actual logic from commonshood
    }

    function stopCrowdsale(
        address _crowdsaleID
    ) external onlyPermitted(LibDao.DaoPermission.crowd_stop) {
        //todo implement actual logic from commonshood
    }

    function joinCrowdsale(
        address _crowdsaleID,
        uint256 _amount,
        string memory _symbol
    ) external onlyPermitted(LibDao.DaoPermission.crowd_join) {
        //todo implement actual logic from commonshood
    }

    function refundMeCrowdsale(
        address _crowdsaleID,
        uint256 _amount
    ) external onlyPermitted(LibDao.DaoPermission.crowd_refund) {
        //todo implement actual logic from commonshood
    }

    function makeAdminCrowdsale(
        address _crowdsaleID,
        address _address
    )
        external
        isMember(_address)
        onlyPermitted(LibDao.DaoPermission.crowd_setadmin)
    {
        require(
            isAuthorized(_address, LibDao.DaoPermission.crowd_canmanage),
            "target user has not enough permissions to be set as crowdsale admin"
        );
        LibCrowdsale.DaoCrowdsaleStorage storage dcs = LibCrowdsale
            .daoCrowdsaleStorage();
        //TODO: check for crowdsale existance
        //TODO: implement actual logic from commonshood
        require(
            !dcs.crowdManagement[_address].managedCrowdsales.contains(
                _crowdsaleID
            ),
            "target user already has permissions for the given crowdsale"
        );
        dcs.crowdManagement[_address].managedCrowdsales.add(_crowdsaleID);
    }

    function removeAdminCrowdsale(
        address _crowdsaleID,
        address _address
    )
        external
        isMember(_address)
        onlyPermitted(LibDao.DaoPermission.crowd_setadmin)
    {
        LibCrowdsale.DaoCrowdsaleStorage storage dcs = LibCrowdsale.daoCrowdsaleStorage();
        require(
            dcs.crowdManagement[_address].managedCrowdsales.contains(
                _crowdsaleID
            ),
            "target user already has no permissions for the given crowdsale"
        );

        //TODO: check for crowdsale existance
        //TODO: implement actual logic from commonshood
        dcs.crowdManagement[_address].managedCrowdsales.remove(_crowdsaleID);
    }

    function getCrowdsaleManagement(
        address _crowdsale,
        address _address
    ) external view returns (bool) {
        //If the user has crowd_setadmin permissions, it can set admins for crowdsale, so it's inherently able to
        //manage any crowdsale, otherwise, if it has crowd_canmanage set, we check if it's been granted management
        //privileges for the specific crowdsale
        LibCrowdsale.DaoCrowdsaleStorage storage dcs = LibCrowdsale
            .daoCrowdsaleStorage();
        return
            isAuthorized(_address, LibDao.DaoPermission.crowd_setadmin) ||
            (isAuthorized(_address, LibDao.DaoPermission.crowd_canmanage) &&
                dcs.crowdManagement[_address].managedCrowdsales.contains(
                    _crowdsale
                ));
    }
}
