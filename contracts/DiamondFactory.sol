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
    uint public currentVersion;
    IDiamondCut.FacetCut[] currentVersionCuts;
    mapping(uint => mapping(uint => DaoVersionUpgradePathStruct))
        public upgradePaths;
    struct DaoVersionUpgradePathStruct {
        uint fromVersion;
        uint toVersion;
        IDiamondCut.FacetCut[] upgradeCuts;
    }

    event DaoCreated(
        address indexed _from,
        address _daoAddress,
        string _name,
        string _firstlifePlaceID
    );
    event DaoJoined(address _daoJoined, address indexed _by);
    event DaoQuit(address _daoQuit, address indexed _by);

    event DaoVersionReleased(IDiamondCut.FacetCut[] cuts, uint indexed version);
    event DaoUpgradeCutsReleased(
        IDiamondCut.FacetCut[] upgradeCuts,
        uint from,
        uint to
    );

    function upgradeDaoVersion(
        IDiamondCut.FacetCut[] calldata newVersionCuts
    ) public onlyOwner {
        delete currentVersionCuts;
        for (uint i = 0; i < newVersionCuts.length; i++) {
            currentVersionCuts.push(newVersionCuts[i]);
        }
        emit DaoVersionReleased(newVersionCuts, currentVersion++);
    }

    function upgradeDaoVersion(
        IDiamondCut.FacetCut[] calldata newVersionCuts,
        DaoVersionUpgradePathStruct[] calldata paths
    ) public onlyOwner {
        delete currentVersionCuts;
        for (uint i = 0; i < newVersionCuts.length; i++) {
            currentVersionCuts.push(newVersionCuts[i]);
        }
        emit DaoVersionReleased(newVersionCuts, currentVersion++);
        setUpgradePaths(paths);
    }

    function setUpgradePaths(
        DaoVersionUpgradePathStruct[] calldata paths
    ) public onlyOwner {
        for (uint i = 0; i < paths.length; i++) {
            setUpgradePath(paths[i]);
            emit DaoUpgradeCutsReleased(
                paths[i].upgradeCuts,
                paths[i].fromVersion,
                paths[i].toVersion
            );
        }
    }

    function setUpgradePath(
        DaoVersionUpgradePathStruct calldata path
    ) internal {
        uint from = path.fromVersion;
        uint to = path.toVersion;
        for (uint i = 0; i < path.upgradeCuts.length; i++) {
            upgradePaths[from][to] = path;
        }
    }

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
        upgradeDaoVersion(_firstVersionCuts);
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
        IDiamondCut(newDaoAddress).diamondCut(
            currentVersionCuts,
            address(0),
            bytes("")
        );
        //We recognize this new DAO address as DAO in the future
        isDao[newDaoAddress] = true;
        //We add this dao address to the mapping of DAOs created in a specific firstlifeplaceID
        placeDaos[_firstlifePlaceID].push(newDaoAddress);
        //We add this dao address to the mapping of DAOs joined by the creator of the DAO
        daosJoinedByUser[msg.sender].add(newDaoAddress);
        //DAO is now created, we emit its creation event
        emit DaoCreated(msg.sender, newDaoAddress, _name, _firstlifePlaceID);
        return address(newDaoAddress);
    }

    function notifyUserQuit(address user) external onlyDao {
        daosJoinedByUser[user].remove(msg.sender);
        emit DaoQuit(msg.sender, user);
    }

    function notifyUserJoin(address user) external onlyDao {
        daosJoinedByUser[user].add(msg.sender);
        emit DaoJoined(msg.sender, user);
    }

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

    function getDaosJoinedBy(
        address user
    ) external view returns (address[] memory) {
        return daosJoinedByUser[user].values();
    }

    function getPlaceDaos(
        string calldata firstlifePlaceID
    ) external view returns (address[] memory) {
        return placeDaos[firstlifePlaceID];
    }

    function isDaoAddress(address addr) external view returns (bool) {
        return isDao[addr];
    }
}
