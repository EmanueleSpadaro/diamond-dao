/* global describe it before ethers */

import {
	getSelectors,
	FacetCutAction,
	removeSelectors,
	findAddressPositionInFacets,
	DaoConstructorArgs,
} from "../scripts/libraries/diamond";
import { deployDiamond } from "../scripts/deploy";
import { assert } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { it } from "mocha";

describe("DiamondTest", async function () {
	let diamondAddress: string;
	let diamondCutFacet: Contract;
	let diamondLoupeFacet: Contract;
	let ownershipFacet: Contract;
	let tx;
	let receipt;
	let result;
	const addresses: string[] = [];

	before(async function () {
		diamondAddress = await deployDiamond();
		console.log({ diamondAddress });
		diamondCutFacet = await ethers.getContractAt(
			"DiamondCutFacet",
			diamondAddress
		);
		diamondLoupeFacet = await ethers.getContractAt(
			"DiamondLoupeFacet",
			diamondAddress
		);
		ownershipFacet = await ethers.getContractAt(
			"OwnershipFacet",
			diamondAddress
		);
	});

	it("expected facets number -- call to facetAddresses function", async () => {
		for (const address of await diamondLoupeFacet.facetAddresses()) {
			addresses.push(address);
		}
		console.log({ addresses });
		assert.equal(addresses.length, 4);
	});

	it('Example Dao parameters are correctly set in Smart Contract Storage', async () => {
		const acc = await ethers.getSigners()
		const daoConstructorArgs: DaoConstructorArgs = {
			owner: acc[1].address,
			realm: "dao",
			name: "Paolo Borsellino",
			firstlifePlaceID: "idididid",
			description_cid: "just dont get in it",
			isInviteOnly: false
		}
		const d = await ethers.getContractAt("DaoFacet", diamondAddress)
		await d.waitForDeployment()
		assert.equal(await d.getOwner(), daoConstructorArgs.owner)
		console.log({owner: daoConstructorArgs.owner });
	})
});
