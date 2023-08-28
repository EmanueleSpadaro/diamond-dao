/* global describe it before ethers */
import { Contract } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
    getSelectors,
    FacetCutAction,
    removeSelectors,
    findAddressPositionInFacets,
    DaoConstructorArgs,
} from "../scripts/libraries/diamond";
import { deployFacets } from "../scripts/libraries/diamondsFramework";
import { assert } from "chai";



describe("Diamond Factory Test", async () => {

    let factory: Contract;
    let deployedFacets: Contract[];
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
        for(const cc of deployedFacets){
            facetsAddresses.push(await cc.getAddress())
        }
        
        

        factory = await upgrades.deployProxy(DiamondFactory, ["CommonsDAO Factory", "dao", await diamondCut.getAddress(), facetsAddresses])
        //factory = await DiamondFactory.deploy("CommonsDAO Factory", "dao", diamondCut, deployedFacets);
    })


    it("DiamondFactory has expected values", async () => {
        assert.equal(await factory.getName(), "CommonsDAO Factory");
        assert.equal(await factory.getRealm(), "dao");
    })
})