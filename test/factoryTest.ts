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
        const upgradeTest1Facet = await ethers.deployContract('DaoUpgradeTest1Facet');
        const upgradeTest2Facet = await ethers.deployContract('DaoUpgradeTest2Facet');
        facetCuts.push({
            facetAddress: await upgradeTest1Facet.getAddress(),
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(upgradeTest1Facet)
        });
        await expect(factory.upgradeDaoVersion(facetCuts)).to.emit(factory, 'DaoVersionReleased');
        //Bear in mind that staticCall emulates the state-changing execution of a method, but it does not affect the blockchain state
        let newDaoAddr = (await contractAs(factory, dao2Owner).createDao.staticCallResult("Residenza Codegone", "Quartiere San Paolo", "Una residenza Camplus"));

        const tx = await contractAs(factory, dao2Owner).createDao("Residenza Codegone", "Quartiere San Paolo", "Una residenza Camplus");
        await tx.wait();

        const placeDaos = await factory.getPlaceDaos("Quartiere San Paolo");

        assert.equal(placeDaos.length, 2);

        secondDao = await ethers.getContractAt('DaoFacet', newDaoAddr.toString());
        await secondDao.waitForDeployment();
        assert.equal(await secondDao.getOwner(), dao2Owner.address);

        const test1SecondDao = await ethers.getContractAt('DaoUpgradeTest1Facet', secondDao);

        assert.equal(await test1SecondDao.fifteenPlusEighteenEquals(), 36);
        assert.equal(await test1SecondDao.greet(), "Hello, UniTo!");

        //We pop the test1facet, emulating a replace for fixing a bug

        facetCuts.pop();


        facetCuts.push({
            facetAddress: await upgradeTest1Facet.getAddress(),
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(upgradeTest1Facet).remove(['greet()']),
        }, {
            facetAddress: await upgradeTest2Facet.getAddress(),
            action: FacetCutAction.Replace,
            functionSelectors: getSelectors(upgradeTest2Facet),
        })

        await expect(factory.upgradeDaoVersion(facetCuts)).to.emit(factory, 'DaoVersionReleased');

        const test2SecondDao = await ethers.getContractAt('DaoUpgradeTest2Facet', secondDao);

        assert.equal(await test1SecondDao.fifteenPlusEighteenEquals(), 36);
        assert.equal(await test1SecondDao.greet(), "Hello, UniTo!");
    })
})