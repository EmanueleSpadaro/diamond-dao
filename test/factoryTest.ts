/* global describe it before ethers */
import { Contract } from "ethers";
import { ethers, upgrades } from "hardhat";
import { TransactionReceipt } from "ethers";
import { expect } from "chai";
import {
    getSelectors,
    FacetCutAction,
    removeSelectors,
    findAddressPositionInFacets,
    DaoConstructorArgs,
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
    let factoryOwner: HardhatEthersSigner;
    let daoOwner: HardhatEthersSigner;
    let user: HardhatEthersSigner;
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
        const cut = [];
        for (const facet of deployedFacets) {
            facetsAddresses.push(await facet.getAddress())

            cut.push({
                facetAddress: await facet.getAddress(),
                action: FacetCutAction.Add,
                functionSelectors: getSelectors(facet)
            })
        }

        [factoryOwner, daoOwner, user] = await ethers.getSigners();



        factory = await upgrades.deployProxy(DiamondFactory, ["CommonsDAO Factory", "dao", await diamondCut.getAddress(), cut])
        //factory = await DiamondFactory.deploy("CommonsDAO Factory", "dao", diamondCut, deployedFacets);
    })


    it("DiamondFactory has expected values", async () => {
        assert.equal(await factory.getName(), "CommonsDAO Factory");
        assert.equal(await factory.getRealm(), "dao");
    })
    it("DiamondFactory diamond deployment", async () => {
        //const tx = await factory.createDao("123", "123", "123");

        await expect(contractAs(factory, daoOwner).createDao("123", "123", "123"))
            .to.emit(factory, "DaoCreated");
        //.withArgs(/* expected event arguments */);

        const placeDaos = await factory.getPlaceDaos('123');
        const joinedByDaoOwner = await factory.getDaosJoinedBy(daoOwner);
        const joinedByFacOwner = await factory.getDaosJoinedBy(factoryOwner);
        assert.equal(placeDaos.length, joinedByDaoOwner.length);
        assert.equal(placeDaos.length, 1);
        assert.equal(joinedByFacOwner.length, 0);


        //FIXME: deployment of DAO with Factory does not install properly the other facets to diamonds
        const dao = await ethers.getContractAt('DaoFacet', placeDaos[0]);
        assert.equal(await dao.getOwner(), daoOwner.address);
        //console.log(placeDaos);
    })
})