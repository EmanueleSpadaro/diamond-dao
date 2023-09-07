// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.18;

import "./libraries/LibDao.sol";
import "./Diamond.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {IDiamondCut} from "./interfaces/IDiamondCut.sol"; //for IDiamondCut.FacetCut
contract DiamondFactory is OwnableUpgradeable {
    modifier onlyDao() {
        require(isDao[msg.sender], "only daos are allowed to call such method");
        _;
    }
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    address diamondCutFacet;
    string name;
    string realm;
    mapping(string => address[]) placeDaos;
    mapping(address => EnumerableSetUpgradeable.AddressSet) daosJoinedByUser;
    mapping(address => bool) isDao;

    IDiamondCut.FacetCut[] facetCuts;

    event DaoCreated(
        address indexed _from,
        address _daoAddress,
        string _name,
        string _firstlifePlaceID
    );
    event DaoJoined(address _daoJoined, address indexed _by);
    event DaoQuit(address _daoQuit, address indexed _by);


    function initialize(
        string memory _factoryName,
        string memory _realm,
        address _diamondCutFacet,
        IDiamondCut.FacetCut[] calldata _firstVersionCuts
    ) public initializer {
        __Ownable_init();
        diamondCutFacet = _diamondCutFacet;
        name = _factoryName;
        realm = _realm;
        for (uint i = 0; i < _firstVersionCuts.length; i++) {
            facetCuts.push(_firstVersionCuts[i]);
        }
    }

    function createDao(
        string memory _name,
        string memory _firstlifePlaceID,
        string memory _description_cid
    ) public {
        LibDao.DaoConstructorArgs memory args;
        args.owner = msg.sender;
        args.realm = realm;
        args.name = _name;
        args.firstlifePlaceID = _firstlifePlaceID;
        args.description_cid = _description_cid;
        args.isInviteOnly = false;

        Diamond diamond = new Diamond(address(this), diamondCutFacet, args);
        address newDaoAddress = address(diamond);
        IDiamondCut(newDaoAddress).diamondCut(facetCuts, address(0), bytes(""));
        //We recognize this new DAO address as DAO in the future
        isDao[newDaoAddress] = true;
        //We add this dao address to the mapping of DAOs created in a specific firstlifeplaceID
        placeDaos[_firstlifePlaceID].push(newDaoAddress);
        //We add this dao address to the mapping of DAOs joined by the creator of the DAO
        daosJoinedByUser[msg.sender].add(newDaoAddress);
        //DAO is now created, we emit its creation event
        emit DaoCreated(msg.sender, newDaoAddress, _name, _firstlifePlaceID);
    }

    function notifyUserQuit(address user) external onlyDao {
        daosJoinedByUser[user].remove(msg.sender);
        emit DaoQuit(msg.sender, user);
    }

    function notifyUserJoin(address user) external onlyDao {
        daosJoinedByUser[user].add(msg.sender);
        emit DaoJoined(msg.sender, user);
    }


    function getCurrentVersion() external pure returns (uint) {
        return 0;
    }


    // function getCurrentFacets() external view returns (address[] memory) {
    //     address[] memory addresses = new address[](otherFacets.length + 1);
    //     for (uint i = 0; i < otherFacets.length; i++) {
    //         addresses[i + 1] = (otherFacets[i]);
    //     }
    //     return addresses;
    // }

    // Getter for diamondCutFacet
    function getDiamondCutFacevalues() external view returns (address) {
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

    function getDaosJoinedBy(address user) external view returns (address[] memory) {
        return daosJoinedByUser[user].values();
    }

    function getPlaceDaos(string calldata firstlifePlaceID) external view returns (address[] memory) {
        return placeDaos[firstlifePlaceID];
    }

    function isDaoAddress(address addr) external view returns (bool) {
        return isDao[addr];
    }
}
