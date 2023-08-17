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

import { expect } from "chai";
import { it } from "mocha";

describe("DiamondTest", async function () {
	let diamondAddress: string;
	let diamondCutFacet: Contract;
	let diamondLoupeFacet: Contract;
	let ownershipFacet: Contract;
	let daoFacet: Contract;
	let tx;
	let receipt;
	let result;
	const addresses: string[] = [];
	let signers;



	let roles = {
		Owner: await ethers.keccak256(await ethers.toUtf8Bytes('OWNER_ROLE')),
		Admin: await ethers.keccak256(await ethers.toUtf8Bytes('ADMIN_ROLE')),
		Supervisor: await ethers.keccak256(await ethers.toUtf8Bytes('SUPERVISOR_ROLE')),
		User: await ethers.keccak256(await ethers.toUtf8Bytes('USER_ROLE')),
	}

	before(async () => {
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
		daoFacet = await ethers.getContractAt(
			"DaoFacet",
			diamondAddress
		)
		signers = await ethers.getSigners();
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
			owner: acc[0].address,
			realm: "dao",
			name: "Paolo Borsellino",
			firstlifePlaceID: "idididid",
			description_cid: "just dont get in it",
			isInviteOnly: false
		}
		assert.equal(await daoFacet.getOwner(), daoConstructorArgs.owner)
		console.log({owner: daoConstructorArgs.owner });
	})

	it('Hierarchy Test (default [USER < OWNER])', async () => {
		const expectedHierarchy = [roles.User, roles.Owner];
		const daoHierarchy = await daoFacet.getRoleHierarchy();
		assert.sameOrderedMembers(daoHierarchy, expectedHierarchy);
		//assert.sameMembers(await daoFacet.getRoleHierarchy(), expectedHierarchy, "Default hierarchy does not comply with specs");
	})
	it('Hierarchy Test (USER < SUPERVISOR < ADMIN < OWNER)', async () => {
		const expectedHierarchy = [roles.User, roles.Supervisor, roles.Admin, roles.Owner];
		//await daoFacet.connect(daoOwner).addRole();
		//FIXME: cannot call from other signers with .connect on Contract
		await daoFacet.addRole(roles.Admin, roles.Owner, (await ethers.getSigners())[1]);
		await daoFacet.addRole(roles.Supervisor, roles.Admin, (await ethers.getSigners())[1]);
		const daoHierarchy = await daoFacet.getRoleHierarchy();
		assert.sameOrderedMembers(daoHierarchy, expectedHierarchy);
	})
});
