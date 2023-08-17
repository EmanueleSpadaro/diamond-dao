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
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

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

	it('Owner correctness', async () => {
		const acc = await ethers.getSigners()
		
		const daoConstructorArgs: DaoConstructorArgs = {
			owner: acc[1].address,
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
		const acc = await ethers.getSigners()
		const expectedHierarchy = [roles.User, roles.Supervisor, roles.Admin, roles.Owner];
		//FIXME: this is an horrendous way of connecting as a different signer than default to a smart contract call
		const owner_DaoFacet = await daoFacet.connect(acc[1]) as Contract;
		await owner_DaoFacet.addRole(roles.Admin, roles.Owner);
		await owner_DaoFacet.addRole(roles.Supervisor, roles.Admin);
		const daoHierarchy = await daoFacet.getRoleHierarchy();
		assert.sameOrderedMembers(daoHierarchy, expectedHierarchy);
	})
});