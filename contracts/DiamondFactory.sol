// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.18;

import "./libraries/LibDao.sol";
import "./Diamond.sol";

contract DiamondFactory {
    address owner;
    address diamondCutFacet;
    address[] otherFacets;
    string name;
    string realm;

    constructor(string memory _factoryName, string memory _realm, address _diamondCutFacet, address[] memory _otherFacets) {
        owner = msg.sender;
        diamondCutFacet = _diamondCutFacet;
        name = _factoryName;
        realm = _realm;
        otherFacets = _otherFacets;
    }

    function createDao(
        string memory _name,
        string memory _firstlifePlaceID,
        string memory _description_cid
    ) public returns (address) {
        LibDao.DaoConstructorArgs memory args;
        args.owner = msg.sender;
        args.realm = realm;
        args.name = _name;
        args.firstlifePlaceID = _firstlifePlaceID;
        args.description_cid = _description_cid;
        args.isInviteOnly = false;


        Diamond diamond = new Diamond(address(this), diamondCutFacet, args);
        address newDaoAddress = address(diamond);
        return newDaoAddress;
    }


    function getCurrentFacets() external view returns (address[] memory) {
        address[] memory addresses = new address[](otherFacets.length + 1);
        for(uint i = 0; i < otherFacets.length; i++){
            addresses[i+1] = (otherFacets[i]);
        }
        return addresses;
    }

       // Getter for owner
    function getOwner() external view returns (address) {
        return owner;
    }

    // Getter for diamondCutFacet
    function getDiamondCutFacet() external view returns (address) {
        return diamondCutFacet;
    }

    // Getter for name
    function getName() external view returns (string memory) {
        return name;
    }

    // Getter for realm
    function getRealm() external view returns (string memory) {
        return realm;
    }
}
