/* global describe it before ethers */
import { Contract } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
    getSelector,
    getSelectors,
    FacetCutAction,
    removeSelectors,
    findAddressPositionInFacets,
    DaoConstructorArgs,
    FacetCut,
    SelectorsObj
} from "../scripts/libraries/diamond";
import { deployFacets } from "../scripts/libraries/diamondsFramework";
import { assert } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FacetCutArray } from "../scripts/libraries/facetCollection"

function contractAs(contract: Contract, asUser: HardhatEthersSigner) {
    return contract.connect(asUser) as Contract;
}


describe("Diamond Upgradability Tools Test", async () => {

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

    it("3.1 UpgradeTo() expected behaviour: ADD case", async () => {
        const OldFacetCut = new FacetCutArray([{
            facetAddress: '0xOld',
            action: FacetCutAction.Remove,
            functionSelectors: ['0xHelloWorld'] as SelectorsObj
        }]);
        const OldFacetCutEmpty = new FacetCutArray([]);

        const NewFacetCut = new FacetCutArray([{
            facetAddress: '0xNew',
            action: FacetCutAction.Add,
            functionSelectors: ['0xHelloWorld'] as SelectorsObj
        }]);
        const expectedFacetCutArray = new FacetCutArray(NewFacetCut);
        assert.deepEqual(OldFacetCut.upgradeTo(NewFacetCut), expectedFacetCutArray);
        assert.deepEqual(OldFacetCutEmpty.upgradeTo(NewFacetCut), expectedFacetCutArray);
    });
    it("3.2.1 UpgradeTo() expected behaviour: NOTHING case", async () => {
        const OldFacetCut = new FacetCutArray([{
            facetAddress: '0xOld',
            action: FacetCutAction.Add,
            functionSelectors: ['0xHelloWorld'] as SelectorsObj
        }]);

        const NewFacetCut = new FacetCutArray([{
            facetAddress: '0xOld',
            action: FacetCutAction.Add,
            functionSelectors: ['0xHelloWorld'] as SelectorsObj
        }]);

        assert.deepEqual(OldFacetCut.upgradeTo(NewFacetCut), new FacetCutArray([]));
    });
    it("3.2.2 UpgradeTo() expected behaviour: REPLACE case", async () => {
        const OldFacetCut = new FacetCutArray([{
            facetAddress: '0xOld',
            action: FacetCutAction.Add,
            functionSelectors: ['0xHelloWorld'] as SelectorsObj
        }]);

        const NewFacetCut = new FacetCutArray([{
            facetAddress: '0xNew',
            action: FacetCutAction.Add,
            functionSelectors: ['0xHelloWorld'] as SelectorsObj
        }]);

        assert.deepEqual(OldFacetCut.upgradeTo(NewFacetCut), [
            {
                facetAddress: '0xNew',
                action: 1,
                functionSelectors: ['0xHelloWorld']
            }
        ]);
    });



    it("3.3 UpgradeTo() expected behaviour: REMOVE", async () => {
        const OldFacetCut = new FacetCutArray([{
            facetAddress: '0xOld',
            action: FacetCutAction.Replace,
            functionSelectors: ['0xHelloWorld'] as SelectorsObj
        }]);
        const OldFacetCutEmpty = new FacetCutArray([]);

        const NewFacetCut = new FacetCutArray([{
            facetAddress: '0xOld',
            action: FacetCutAction.Remove,
            functionSelectors: ['0xHelloWorld'] as SelectorsObj
        }]);
        const NewFacetCutDifferentFacet = new FacetCutArray([{
            facetAddress: '0xNew',
            action: FacetCutAction.Remove,
            functionSelectors: ['0xHelloWorld'] as SelectorsObj
        }]);

        const expectedFacetCutArray = new FacetCutArray([{
            facetAddress: '0xOld',
            action: FacetCutAction.Remove,
            functionSelectors: ['0xHelloWorld'] as SelectorsObj
        }]);

        assert.deepEqual(OldFacetCut.upgradeTo(NewFacetCut), expectedFacetCutArray);
        assert.deepEqual(OldFacetCutEmpty.upgradeTo(NewFacetCut), new FacetCutArray([]));

        assert.deepEqual(OldFacetCut.upgradeTo(NewFacetCutDifferentFacet), expectedFacetCutArray);
        assert.deepEqual(OldFacetCutEmpty.upgradeTo(NewFacetCut), new FacetCutArray([]));
    });
})