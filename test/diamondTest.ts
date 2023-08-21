/* global describe it before ethers */

import {
	getSelectors,
	FacetCutAction,
	removeSelectors,
	findAddressPositionInFacets,
	DaoConstructorArgs,
} from "../scripts/libraries/diamond";
import {
	DaoPermission
} from "../scripts/libraries/daoPermission";
import { deployDiamond } from "../scripts/deploy";
import { assert } from "chai";

import { ethers } from "hardhat";
import { Contract, EnsPlugin } from "ethers";

import { expect } from "chai";
import { it } from "mocha";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

function contractAs(contract: Contract, asUser: HardhatEthersSigner) {
	return contract.connect(asUser) as Contract;
}

function range(start: number, stop?: number, step?: number): number[] {
    if (typeof stop === 'undefined') {
        // one param defined
        stop = start;
        start = 0;
    }

    if (typeof step === 'undefined') {
        step = 1;
    }

    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
        return [];
    }

    const result: number[] = [];
    for (let i = start; (step > 0 ? i < stop : i > stop); i += step) {
        result.push(i);
    }

    return result;
}

describe("DiamondTest", async function () {
	let diamondAddress: string;
	let diamondCutFacet: Contract;
	let diamondLoupeFacet: Contract;
	let ownershipFacet: Contract;
	let daoFacet: Contract;
	let daoTokenFacet: Contract;
	let daoCrowdsaleFacet: Contract;
	let daoExchangeFacet: Contract;
	let tx;
	let receipt;
	let result;
	const addresses: string[] = [];
	let factoryOwner: HardhatEthersSigner;
	let owner: HardhatEthersSigner;
	let admin: HardhatEthersSigner;
	let supervisor: HardhatEthersSigner;
	let user: HardhatEthersSigner;
	let moderator: HardhatEthersSigner;
	const supervisorPermissions: DaoPermission[] = [
		DaoPermission.token_transfer,
		DaoPermission.token_canmanage,
		DaoPermission.crowd_join,
		DaoPermission.crowd_refund,
		DaoPermission.crowd_canmanage,
		DaoPermission.exchange_accept,
		DaoPermission.exchange_refill,
		DaoPermission.exchange_canmanage
	];



	let roles = {
		Owner: await ethers.keccak256(await ethers.toUtf8Bytes('OWNER_ROLE')),
		Admin: await ethers.keccak256(await ethers.toUtf8Bytes('ADMIN_ROLE')),
		Supervisor: await ethers.keccak256(await ethers.toUtf8Bytes('SUPERVISOR_ROLE')),
		User: await ethers.keccak256(await ethers.toUtf8Bytes('USER_ROLE')),
	}

	before(async () => {
		diamondAddress = await deployDiamond();
		//console.log({ diamondAddress });
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
		);
		daoTokenFacet = await ethers.getContractAt("DaoTokenFacet", diamondAddress);
		daoCrowdsaleFacet = await ethers.getContractAt("DaoCrowdsaleFacet", diamondAddress);
		daoExchangeFacet = await ethers.getContractAt("DaoExchangeFacet", diamondAddress);
		const signers = await ethers.getSigners();
		[factoryOwner, owner, admin, supervisor, user, moderator] = await ethers.getSigners();
	});

	it("expected facets number -- call to facetAddresses function", async () => {
		for (const address of await diamondLoupeFacet.facetAddresses()) {
			addresses.push(address);
		}
		//console.log({ addresses });
		assert.equal(addresses.length, 7);
	});
	it("expected amount of permissions available", async () => {
		assert.equal(await daoFacet.getPermissionsCount(), DaoPermission.COUNT);
	})

	it('Owner correctness', async () => {
		const acc = await ethers.getSigners()

		const daoConstructorArgs: DaoConstructorArgs = {
			owner: owner.address,
			realm: "dao",
			name: "Paolo Borsellino",
			firstlifePlaceID: "idididid",
			description_cid: "just dont get in it",
			isInviteOnly: false
		}
		assert.equal(await daoFacet.getOwner(), daoConstructorArgs.owner)
		//console.log({ owner: daoConstructorArgs.owner });
	})

	it('Hierarchy Test (default [USER < OWNER])', async () => {
		const expectedHierarchy = [roles.User, roles.Owner];
		const daoHierarchy = await daoFacet.getRoleHierarchy();
		assert.sameOrderedMembers(daoHierarchy, expectedHierarchy);
		//assert.sameMembers(await daoFacet.getRoleHierarchy(), expectedHierarchy, "Default hierarchy does not comply with specs");
	})
	it('Hierarchy Test after adding roles (USER < SUPERVISOR < ADMIN < OWNER)', async () => {
		const acc = await ethers.getSigners()
		const expectedHierarchy = [roles.User, roles.Supervisor, roles.Admin, roles.Owner];
		const byOwner = contractAs(daoFacet, acc[1]);
		await byOwner.addRole(roles.Admin, roles.Owner, range(0, await daoFacet.getPermissionsCount()));
		await byOwner.addRole(roles.Supervisor, roles.Admin, supervisorPermissions);
		const daoHierarchy = await daoFacet.getRoleHierarchy();
		assert.sameOrderedMembers(daoHierarchy, expectedHierarchy);
	})
	it('Invite hierarchy compliance', async () => {
		//Owner sets invite only
		await contractAs(daoFacet, owner).setInviteOnly(true);
		//User can't join
		await expect(contractAs(daoFacet, user).join()).to.be.reverted;
		//Owner sets DAO joinable freely
		await contractAs(daoFacet, owner).setInviteOnly(false);
		//Owner cannot join again
		await expect(contractAs(daoFacet, owner).join()).to.be.reverted;
		//User joins
		await contractAs(daoFacet, user).join()
		//User cannot join again
		await expect(contractAs(daoFacet, user).join()).to.be.reverted;
		//Owner shouldn't be able to invite users as owner
		await expect(contractAs(daoFacet, owner).invite(admin.address, roles.Owner)).to.be.reverted;
		//The invited user shouldn't be able to accept the reverted invite
		await expect(contractAs(daoFacet, admin).acceptInvite()).to.be.reverted;
		//Owner invites an user as admin
		await contractAs(daoFacet, owner).invite(admin.address, roles.Admin);
		//Admin accepts
		await contractAs(daoFacet, admin).acceptInvite();
		//User can't invite future supervisor as user
		await expect(contractAs(daoFacet, user).invite(supervisor.address, roles.Supervisor)).to.be.reverted;
		//Admin can't invite future supervisor as admin
		await expect(contractAs(daoFacet, admin).invite(supervisor.address, roles.Admin)).to.be.reverted;
		//Admin invites supervisor
		await contractAs(daoFacet, admin).invite(supervisor.address, roles.Supervisor);
		//Supervisor accepts such invite
		await contractAs(daoFacet, supervisor).acceptInvite();
	})
	describe("Promotion/Demotion System", () => {
		//2 Phase Promotion User->Supervisor->Admin
		it("2 Phase Promotion User->Supervisor->Admin", async () => {

			assert.equal(await contractAs(daoFacet, owner).getRole(user), roles.User, "User expected to be user");
			await contractAs(daoFacet, owner).modifyRank(user, roles.Supervisor);
			assert.equal(await contractAs(daoFacet, owner).getRole(user), roles.User, "User expected to be user");
			await contractAs(daoFacet, user).acceptPromotion();
			assert.equal(await contractAs(daoFacet, owner).getRole(user), roles.Supervisor, "User expected to be supervisor after accepting promotion");


			await contractAs(daoFacet, owner).modifyRank(user, roles.Admin);
			assert.equal(await contractAs(daoFacet, owner).getRole(user), roles.Supervisor, "User expected to be supervisor");
			await contractAs(daoFacet, user).acceptPromotion();
			assert.equal(await contractAs(daoFacet, owner).getRole(user), roles.Admin, "User expected to be admin after accepting promotion");

		})
		it("Same role members can't modify each others", async () => {
			//Admin cannot demote User since it's now an admin
			await expect(contractAs(daoFacet, admin).modifyRank(user, roles.User)).to.be.reverted;
		})
		it("Same role members can't kick each others", async () => {
			//Admin cannot kick user since it's now an admin
			await expect(contractAs(daoFacet, admin).kickMember(user)).to.be.reverted;
		})
		it("1Phase Derank Admin->Supervisor->User", async () => {
			//admin->supervisor
			await contractAs(daoFacet, owner).modifyRank(user, roles.Supervisor);
			assert.equal(await contractAs(daoFacet, owner).getRole(user), roles.Supervisor, "User expected to be supervisor");
			//supervisor->user
			await contractAs(daoFacet, owner).modifyRank(user, roles.User);
			assert.equal(await contractAs(daoFacet, owner).getRole(user), roles.User, "User expected to be user");
		})
		it("User can't accept/refuse non-existant promotion", async () => {
			await expect(contractAs(daoFacet, user).acceptPromotion()).to.be.reverted;
			await expect(contractAs(daoFacet, user).refusePromotion()).to.be.reverted;
		})
		it("Owner kicks member (member joins back right after)", async () => {
			await contractAs(daoFacet, owner).kickMember(user);
			await contractAs(daoFacet, user).join();
		})
	})
	describe('Role based micro-permissions', () => {
		describe('Token Create', () => {
			it("Owner can create a Token", async () => {
				await contractAs(daoTokenFacet, owner).createToken();
				await expect(contractAs(daoTokenFacet, user).createToken()).to.be.reverted;
				// const daoInstance = await getUserDao(owner);
				// try{
				//     const {name, symbol, decimals, logoURL, logoHash, hardCap, contractHash} = ownerToken;
				//     await daoInstance.createToken(name, symbol, decimals, logoURL, logoHash, hardCap, contractHash, {from: owner})
				// }catch(_){
				//     throw new Error("Owner should be able to create a token");
				// }
				// return true;
			});
			// it("Admin can create a Token", async () => {
			//     const daoInstance = await getUserDao(owner);
			//     try{
			//         const {name, symbol, decimals, logoURL, logoHash, hardCap, contractHash} = adminToken;
			//         await daoInstance.createToken(name, symbol, decimals, logoURL, logoHash, hardCap, contractHash, {from:admin});
			//     }catch(_){
			//         throw new Error("Admin should be able to create a token");
			//     }
			//     return true;
			// });
			// it("Supervisor can't create a Token", async () => {
			//     const daoInstance = await getUserDao(owner);
			//     try{
			//         const {name, symbol, decimals, logoURL, logoHash, hardCap, contractHash} = notCreatableToken;
			//         await daoInstance.createToken(name, symbol, decimals, logoURL, logoHash, hardCap, contractHash, {from:supervisor});
			//     }catch(_){
			//         return true;

			//     }
			//     throw new Error("Supervisor shouldn't be able to create a token");
			// });
			// it("User can't create a Token", async () => {
			//     const daoInstance = await getUserDao(owner);
			//     try{
			//         const {name, symbol, decimals, logoURL, logoHash, hardCap, contractHash} = notCreatableToken;
			//         await daoInstance.createToken(name, symbol, decimals, logoURL, logoHash, hardCap, contractHash, {from:user});
			//     }catch(_){
			//         return true;

			//     }
			//     throw new Error("User shouldn't be able to create a token");
			// });
		})
		describe("Crowdsale Creation", () => {
			it("Owner can create a Crowdsale", async () => {
				await contractAs(daoCrowdsaleFacet, owner).createCrowdsale();
				await expect(contractAs(daoCrowdsaleFacet, user).createCrowdsale()).to.be.reverted;
				// const daoInstance = await getUserDao(owner);
				// await daoInstance.createCrowdsale(user, user, 0, 0, 0, 0, 0, "desc", "desc", "logo_hash", "tos_hash");
			})
			// it("Admin can create a Crowdsale", async () => {
			//     const daoInstance = await getUserDao(owner);
			//     await daoInstance.createCrowdsale(user, user, 0, 0, 0, 0, 0, "desc", "desc", "logo_hash", "tos_hash", {from:admin});
			// })
			// it("Supervisor can't create a Crowdsale", async () => {
			//     const daoInstance = await getUserDao(owner);
			//     try{
			//         await daoInstance.createCrowdsale(user, user, 0, 0, 0, 0, 0, "desc", "desc", "logo_hash", "tos_hash", {from:supervisor});
			//     }catch(_){
			//         return true;
			//     }
			//     throw new Error("Supervisor shouldn't be able to create a crowdsale");
			// })
			// it("User can't create a Crowdsale", async () => {
			//     const daoInstance = await getUserDao(owner);
			//     try{
			//         await daoInstance.createCrowdsale(user, user, 0, 0, 0, 0, 0, "desc", "desc", "logo_hash", "tos_hash", {from:user});
			//     }catch(_){
			//         return true;
			//     }
			//     throw new Error("User shouldn't be able to create a crowdsale");
			// })
		})
		describe("Exchange Create", () => {
            // const coinsOffered = [];
            // const coinsRequired = [];
            // const amountsOffered = [];
            // const amountsRequired = [];
            // const repeats = 0;
            // const expiration = 0;
            it("Owner can create a Exchange", async () => {
				await contractAs(daoExchangeFacet, owner).createExchange();
				await expect(contractAs(daoExchangeFacet, user).createExchange()).to.be.reverted;
                // const daoInstance = await getUserDao(owner);
                // await daoInstance.createExchange(coinsOffered, coinsRequired, amountsOffered, amountsRequired, repeats, expiration, {from:owner});
            })
            // it("Admin can create a Exchange", async () => {
            //     const daoInstance = await getUserDao(owner);
            //     await daoInstance.createExchange(coinsOffered, coinsRequired, amountsOffered, amountsRequired, repeats, expiration, {from:admin});
            // })
            // it("Supervisor cannot create a Exchange", async () => {
            //     const daoInstance = await getUserDao(owner);
            //     try{
            //         await daoInstance.createExchange(coinsOffered, coinsRequired, amountsOffered, amountsRequired, repeats, expiration, {from:supervisor});
            //     }catch(_){
            //         return true;
            //     }
            //     throw new Error("Supervisor shouldn't be able to create an exchange");
            // })
            // it("User cannot create a Exchange", async () => {
            //     const daoInstance = await getUserDao(owner);
            //     try{
            //         await daoInstance.createExchange(coinsOffered, coinsRequired, amountsOffered, amountsRequired, repeats, expiration, {from:user});
            //     }catch(_){
            //         return true;
            //     }
            //     throw new Error("User shouldn't be able to create an exchange");
            // })
        })
	})
});
