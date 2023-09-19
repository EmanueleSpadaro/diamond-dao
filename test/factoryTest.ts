/* global describe it before ethers */
import { Contract } from "ethers";
import { ethers, upgrades } from "hardhat";
import { TransactionReceipt } from "ethers";
import { expect } from "chai";
import {
    getSelector,
    getSelectors,
    FacetCutAction,
    removeSelectors,
    findAddressPositionInFacets,
    DaoConstructorArgs,
    FacetCut
} from "../scripts/libraries/diamond";
import { deployFacets } from "../scripts/libraries/diamondsFramework";
import { assert } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

function contractAs(contract: Contract, asUser: HardhatEthersSigner) {
    return contract.connect(asUser) as Contract;
}


describe("Diamond Factory Test", async () => {

    let factory: Contract;
    let deployedFacets: Contract[];
    let firstDao: Contract;
    let secondDao: Contract;
    let thirdDao: Contract;
    let factoryOwner: HardhatEthersSigner;
    let daoOwner: HardhatEthersSigner;
    let dao2Owner: HardhatEthersSigner; //Owner of the first upgraded DAO version
    let user: HardhatEthersSigner;
    let facetCuts: FacetCut[] = [];
    before(async () => {
        const DiamondFactory = await ethers.getContractFactory('DiamondFactory');
        deployedFacets = await deployFacets([
            'OwnershipFacet',
            'DiamondLoupeFacet',
            'DaoFacet',
            'DaoTokenFacet',
            'DaoExchangeFacet',
            'DaoCrowdsaleFacet'
        ]);
        const diamondCut = await ethers.deployContract('DiamondCutFacet');
        await diamondCut.waitForDeployment();
        console.log(await diamondCut.getAddress());
        const facetsAddresses: string[] = [];
        for (const facet of deployedFacets) {
            facetsAddresses.push(await facet.getAddress())

            facetCuts.push({
                facetAddress: await facet.getAddress(),
                action: FacetCutAction.Add,
                functionSelectors: getSelectors(facet)
            })
        }

        [factoryOwner, daoOwner, user, dao2Owner] = await ethers.getSigners();



        factory = await upgrades.deployProxy(DiamondFactory, ["CommonsDAO Factory", "dao", await diamondCut.getAddress(), facetCuts]);
    })


    it("DiamondFactory has expected values", async () => {
        assert.equal(await factory.getName(), "CommonsDAO Factory");
        assert.equal(await factory.getRealm(), "dao");
    })
    it("DiamondFactory diamond deployment", async () => {
        //const tx = await factory.createDao("123", "123", "123");

        await expect(contractAs(factory, daoOwner).createDao("Residenza Paolo Borsellino", "Quartiere San Paolo", "Una residenza Edisu"))
            .to.emit(factory, "DaoCreated");
        //.withArgs(/* expected event arguments */);

        const placeDaos = await factory.getPlaceDaos('Quartiere San Paolo');
        const joinedByDaoOwner = await factory.getDaosJoinedBy(daoOwner);
        const joinedByFacOwner = await factory.getDaosJoinedBy(factoryOwner);
        assert.equal(placeDaos.length, joinedByDaoOwner.length);
        assert.equal(placeDaos.length, 1);
        assert.equal(joinedByFacOwner.length, 0);


        //FIXME: deployment of DAO with Factory does not install properly the other facets to diamonds
        firstDao = await ethers.getContractAt('DaoFacet', placeDaos[0]);
        assert.equal(await firstDao.getOwner(), daoOwner.address);
        //console.log(placeDaos);
    })
    it("DaoVersionUpgrade", async () => {
        //We deploy two example facets, the first contains a bug fixed by the latter
        const upgradeTest1Facet = await ethers.deployContract('DaoUpgradeTest1Facet');
        const upgradeTest2Facet = await ethers.deployContract('DaoUpgradeTest2Facet');

        //We emulate the case were we set the DAO facets to match the first implementation
        facetCuts.push({
            facetAddress: await upgradeTest1Facet.getAddress(),
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(upgradeTest1Facet)
        });
        //We upgrade the DAO version 
        await expect(factory.upgradeDaoVersion(facetCuts)).to.emit(factory, 'DaoVersionReleased');

        //Bear in mind that staticCall emulates the state-changing execution of a method, but it does not affect the blockchain state
        let newDaoAddr = (await contractAs(factory, dao2Owner).createDao.staticCallResult("Residenza Codegone", "Quartiere San Paolo", "Una residenza Camplus"));

        //We deploy the DAO from the factory contract now that we now the address at which it will be deployed
        let tx = await contractAs(factory, dao2Owner).createDao("Residenza Codegone", "Quartiere San Paolo", "Una residenza Camplus");
        await tx.wait();

        //We make sure that the factory correctly keeps track of DAOs inside of specific FirstLife's place IDs
        const placeDaos = await factory.getPlaceDaos("Quartiere San Paolo");
        assert.equal(placeDaos.length, 2);

        //We retrieve the DaoFacet at the second Dao address, the second DAO has the faulty implementation of .fifteenPlusEighteenEquals()
        secondDao = await ethers.getContractAt('DaoFacet', newDaoAddr.toString());
        await secondDao.waitForDeployment();
        //We make sure the second DAOs is correctly deployed and that the owner of the DAO is properly set
        assert.equal(await secondDao.getOwner(), dao2Owner.address);


        //We test the first implementation, it shouldn't return the exact result of fifteenPlusEighteenEquals()
        const test1SecondDao = await ethers.getContractAt('DaoUpgradeTest1Facet', secondDao);
        const test2SecondDao = await ethers.getContractAt('DaoUpgradeTest2Facet', secondDao);
        assert.equal(await test1SecondDao.fifteenPlusEighteenEquals(), 36);
        assert.equal(await test1SecondDao.greet(), "Hello, UniTo!");

        //We pop the test1facet, emulating a replace for fixing a bug
        facetCuts.pop();

        //We know that the current set of FacetCuts introduce a bugged version of fifteenPlusEighteenEquals()
        //so we set the DaoVersion to a set of FacetCuts that has a fixed implementation of fifteenPlusEighteenEquals() in upgradeTest2Facet
        facetCuts.push({
            facetAddress: await upgradeTest1Facet.getAddress(),
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(upgradeTest1Facet).remove(['fifteenPlusEighteenEquals()']),
        }, {
            facetAddress: await upgradeTest2Facet.getAddress(),
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(upgradeTest2Facet),
        })

        await expect(factory.upgradeDaoVersion(facetCuts)).to.emit(factory, 'DaoVersionReleased');

        //The second DAO was deployed with a bug, it still should be bugged
        assert.equal(await test2SecondDao.fifteenPlusEighteenEquals(), 36);
        assert.equal(await test1SecondDao.greet(), "Hello, UniTo!");


        //We upgrade the DAO version 
        await expect(factory.upgradeDaoVersion(facetCuts)).to.emit(factory, 'DaoVersionReleased');

        //Bear in mind that staticCall emulates the state-changing execution of a method, but it does not affect the blockchain state
        newDaoAddr = (await contractAs(factory, dao2Owner).createDao.staticCallResult("Hotel Politecnico", "Quartiere San Paolo", "Un hotel vicino al Politecnico"));

        //We deploy the DAO from the factory contract now that we now the address at which it will be deployed
        tx = await contractAs(factory, factoryOwner).createDao("Hotel Politecnico", "Quartiere San Paolo", "Un hotel vicino al Politecnico");
        await tx.wait();

        thirdDao = await ethers.getContractAt('DaoFacet', newDaoAddr.toString());
        await thirdDao.waitForDeployment();
        //We make sure the second DAOs is correctly deployed and that the owner of the DAO is properly set
        assert.equal(await thirdDao.getOwner(), factoryOwner.address);

        //The third DAO should have a fixed version of fifteenPlusEighteenEquals()
        const test1ThirdDao = await ethers.getContractAt('DaoUpgradeTest1Facet', thirdDao);
        assert.equal(await test1ThirdDao.fifteenPlusEighteenEquals(), 33);
        assert.equal(await test1ThirdDao.greet(), "Hello, UniTo!");


    })
})