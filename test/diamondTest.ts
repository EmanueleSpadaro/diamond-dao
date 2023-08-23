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
import { ownerToken, adminToken, notCreatableToken } from "./tokens";

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
	let recipientUser: HardhatEthersSigner;
	let crowdsaleID: HardhatEthersSigner; //FIXME: This MUST be an actual crowdsale address
	let exchangeID: HardhatEthersSigner; //FIXME: This MUST be an actual crowdsale address
	const supervisorPermissions: DaoPermission[] = [
		DaoPermission.token_specific,
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
		[factoryOwner, owner, admin, supervisor, user, moderator, recipientUser, crowdsaleID] = await ethers.getSigners();
		exchangeID = crowdsaleID;
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
				const { name, symbol, decimals, logoURL, logoHash, hardCap, contractHash } = ownerToken;
				await contractAs(daoTokenFacet, owner).createToken(name, symbol, decimals, logoURL, logoHash, hardCap, contractHash);
			});
			it("Admin can create a Token", async () => {
				const { name, symbol, decimals, logoURL, logoHash, hardCap, contractHash } = adminToken;
				await contractAs(daoTokenFacet, admin).createToken(name, symbol, decimals, logoURL, logoHash, hardCap, contractHash);
			});
			it("Supervisor can't create a Token", async () => {
				const { name, symbol, decimals, logoURL, logoHash, hardCap, contractHash } = notCreatableToken;
				await expect(contractAs(daoTokenFacet, supervisor).createToken(name, symbol, decimals, logoURL, logoHash, hardCap, contractHash)).to.be.reverted;
			});
			it("User can't create a Token", async () => {
				const { name, symbol, decimals, logoURL, logoHash, hardCap, contractHash } = notCreatableToken;
				await expect(contractAs(daoTokenFacet, user).createToken(name, symbol, decimals, logoURL, logoHash, hardCap, contractHash)).to.be.reverted;
			});
		})
		describe('Token Transfer', () => {
			it("Owner can transfer token", async () => {
				await contractAs(daoTokenFacet, owner).transferToken(ownerToken.symbol, 250, recipientUser);
			})
			it("Admin can transfer token", async () => {
				await contractAs(daoTokenFacet, admin).transferToken(ownerToken.symbol, 250, recipientUser);
			})
			it("Supervisor without token auth can't transfer token", async () => {
				await expect(contractAs(daoTokenFacet, supervisor).transferToken(ownerToken.symbol, 250, recipientUser)).to.be.reverted;
			})
			it("Admin authorizes Supervisor for Token", async () => {
				await contractAs(daoTokenFacet, admin).setTokenAuth(ownerToken.symbol, supervisor);
			})
			it("Authorized Supervisor can transfer token", async () => {
				await contractAs(daoTokenFacet, supervisor).transferToken(ownerToken.symbol, 250, recipientUser);
			})
		})
		describe("Token Mint", () => {
			it("Owner can mint token", async () => {
				await contractAs(daoTokenFacet, owner).mintToken(ownerToken.symbol, 250);
			})
			it("Admin can mint token", async () => {
				await contractAs(daoTokenFacet, admin).mintToken(ownerToken.symbol, 250);
			})
			it("Supervisor cannot mint token", async () => {
				await expect(contractAs(daoTokenFacet, supervisor).mintToken(ownerToken.symbol, 250)).to.be.reverted;
			})
			it("User cannot mint token", async () => {
				await expect(contractAs(daoTokenFacet, user).mintToken(ownerToken.symbol, 250)).to.be.reverted;
			})
		})
		describe("Token Authorizations", () => {
			it("Supervisor can't authorize himself", async () => {
				await expect(contractAs(daoTokenFacet, supervisor).setTokenAuth(ownerToken.symbol, supervisor)).to.be.reverted;
			})
			//FIXME: getTokenAuth externally callable [https://discord.com/channels/730508054143172710/730508054877175911/1143574236603109487]
			// it("Supervisor getTokenAuth consistence (true)", async () => {
			//     const daoInstance = await getUserDao(owner);
			//     assert.equal(
			//         await daoInstance.getTokenAuth(ownerToken.symbol, supervisor),
			//         true,
			//         "Supervisor getTokenAuth not consistent with previous assignments"
			//     );
			// })
			it("Admin reverts Supervisor authorization for Token", async () => {
				await contractAs(daoTokenFacet, admin).removeTokenAuth(ownerToken.symbol, supervisor);
				//FIXME: getTokenAuth externally callable [https://discord.com/channels/730508054143172710/730508054877175911/1143574236603109487]
				// assert.equal(
				//     await daoInstance.getTokenAuth(ownerToken.symbol, supervisor),
				//     false,
				//     "Supervisor shouldn't be consider authorized for a token after being unset by admin"
				// )
			})
			it("User can't be authorized for tokens", async () => {
				await expect(contractAs(daoTokenFacet, owner).setTokenAuth(ownerToken.symbol, user)).to.be.reverted;
			})
			it("Owner reapplies token Authorization for Supervisor", async () => {
				await contractAs(daoTokenFacet, owner).setTokenAuth(ownerToken.symbol, supervisor);
			})
		})
		describe("Crowdsale Creation", () => {
			//TODO: similiarly to test/tokens.ts, we might want to implement an interface for Crowdsales
			it("Owner can create a Crowdsale", async () => {
				await contractAs(daoCrowdsaleFacet, owner).createCrowdsale(user, user, 0, 0, 0, 0, 0, "desc", "desc", "logo_hash", "tos_hash");
			})
			it("Admin can create a Crowdsale", async () => {
				await contractAs(daoCrowdsaleFacet, admin).createCrowdsale(user, user, 0, 0, 0, 0, 0, "desc", "desc", "logo_hash", "tos_hash");
			})
			it("Supervisor can't create a Crowdsale", async () => {
				await expect(contractAs(daoCrowdsaleFacet, supervisor).createCrowdsale(user, user, 0, 0, 0, 0, 0, "desc", "desc", "logo_hash", "tos_hash")).to.reverted;
			})
			it("User can't create a Crowdsale", async () => {
				await expect(contractAs(daoCrowdsaleFacet, user).createCrowdsale(user, user, 0, 0, 0, 0, 0, "desc", "desc", "logo_hash", "tos_hash")).to.reverted;
			})
		})
		describe("Crowdsale Unlock", () => {
			it("Owner can unlock Crowdsale", async () => {
				await contractAs(daoCrowdsaleFacet, owner).unlockCrowdsale(user, user, 0);
			})
			it("Admin can unlock Crowdsale", async () => {
				await contractAs(daoCrowdsaleFacet, admin).unlockCrowdsale(user, user, 0);
			})
			it("Supervisor cannot unlock Crowdsale", async () => {
				await expect(contractAs(daoCrowdsaleFacet, supervisor).unlockCrowdsale(user, user, 0)).to.be.reverted;
			})
			it("User cannot unlock Crowdsale", async () => {
				await expect(contractAs(daoCrowdsaleFacet, user).unlockCrowdsale(user, user, 0)).to.be.reverted;
			})
		})
		describe("Crowdsale Stop", () => {
			it("Owner can stop Crowdsale", async () => {
				await contractAs(daoCrowdsaleFacet, owner).stopCrowdsale(user);
			})
			it("Admin can stop Crowdsale", async () => {
				await contractAs(daoCrowdsaleFacet, admin).stopCrowdsale(user);
			})
			it("Supervisor cannot stop Crowdsale", async () => {
				await expect(contractAs(daoCrowdsaleFacet, supervisor).stopCrowdsale(user)).to.be.reverted;
			})
			it("User cannot stop Crowdsale", async () => {
				await expect(contractAs(daoCrowdsaleFacet, user).stopCrowdsale(user)).to.be.reverted;
			})
		})
		describe("Crowdsale Join", () => {
			it("Owner can join Crowdsale", async () => {
				await contractAs(daoCrowdsaleFacet, owner).joinCrowdsale(user, 0, ownerToken.symbol);
			})
			it("Admin can join Crowdsale", async () => {
				await contractAs(daoCrowdsaleFacet, admin).joinCrowdsale(user, 0, ownerToken.symbol);
			})
			//FIXME: Shall the supervisor actually be able to join or not crowdsales? Previous tests stated we'll eventually have to change this when we'll implemented commonshood logic 
			it("Supervisor can join Crowdsale", async () => {
				await contractAs(daoCrowdsaleFacet, supervisor).joinCrowdsale(user, 0, ownerToken.symbol);
				//try{
				//    await daoInstance.joinCrowdsale(user, 0, ownerToken.symbol, {from:supervisor});
				//}catch(_){
				//    return true;
				//}
				//throw new Error("Supervisor shouldn't be able to join a Crowdsale");
			})
			it("User cannot join Crowdsale", async () => {
				await expect(contractAs(daoCrowdsaleFacet, user).joinCrowdsale(user, 0, ownerToken.symbol)).to.be.reverted;
			})
		})
		describe("Crowdsale Refund", () => {
			it("Owner can refund Crowdsale", async () => {
				await contractAs(daoCrowdsaleFacet, owner).refundMeCrowdsale(user, 0);
			})
			it("Admin can refund Crowdsale", async () => {
				await contractAs(daoCrowdsaleFacet, admin).refundMeCrowdsale(user, 0);
			})
			//FIXME: Shall the supervisor actually be able to join or not crowdsales? Previous tests stated we'll eventually have to change this when we'll implemented commonshood logic
			it("Supervisor can refund Crowdsale", async () => {
				await contractAs(daoCrowdsaleFacet, supervisor).refundMeCrowdsale(user, 0);
			})
			it("User cannot refund Crowdsale", async () => {
				await expect(contractAs(daoCrowdsaleFacet, user).refundMeCrowdsale(user, 0)).to.be.reverted;
			})
		})
		describe("Crowdsale Permissions Grant/Revoke", () => {

			it("Owner grants/revokes to Supervisor", async () => {
				assert.equal(await contractAs(daoCrowdsaleFacet, owner).getCrowdsaleManagement(crowdsaleID, supervisor), false, "Supervisor shouldn't have permissions for given crowdsale before assignment");
				await contractAs(daoCrowdsaleFacet, owner).makeAdminCrowdsale(crowdsaleID, supervisor);
				assert.equal(await contractAs(daoCrowdsaleFacet, owner).getCrowdsaleManagement(crowdsaleID, supervisor), true, "Supervisor should have now permissions for given crowdsale");
				await contractAs(daoCrowdsaleFacet, owner).removeAdminCrowdsale(crowdsaleID, supervisor);
				assert.equal(await contractAs(daoCrowdsaleFacet, owner).getCrowdsaleManagement(crowdsaleID, supervisor), false, "Supervisor shouldn't have permissions for given crowdsale");
			})
			it("Admin grants/revokes to Supervisor", async () => {
				assert.equal(await contractAs(daoCrowdsaleFacet, admin).getCrowdsaleManagement(crowdsaleID, supervisor), false, "Supervisor shouldn't have permissions for given crowdsale before assignment");
				await contractAs(daoCrowdsaleFacet, admin).makeAdminCrowdsale(crowdsaleID, supervisor);
				assert.equal(await contractAs(daoCrowdsaleFacet, admin).getCrowdsaleManagement(crowdsaleID, supervisor), true, "Supervisor should have now permissions for given crowdsale");
				await contractAs(daoCrowdsaleFacet, admin).removeAdminCrowdsale(crowdsaleID, supervisor);
				assert.equal(await contractAs(daoCrowdsaleFacet, admin).getCrowdsaleManagement(crowdsaleID, supervisor), false, "Supervisor shouldn't have permissions for given crowdsale");
			})
			it("Supervisor cannot grant/revoke", async () => {
				assert.equal(await daoCrowdsaleFacet.getCrowdsaleManagement(crowdsaleID, user), false);
				await expect(contractAs(daoCrowdsaleFacet, supervisor).makeAdminCrowdsale(crowdsaleID, user)).to.be.reverted;
				assert.equal(await daoCrowdsaleFacet.getCrowdsaleManagement(crowdsaleID, user), false);
			})
			it("User cannot grant/revoke", async () => {
				await expect(contractAs(daoCrowdsaleFacet, user).makeAdminCrowdsale(crowdsaleID, supervisor)).to.be.reverted;
			})
			it("User cannot receive crowdsale permissions", async () => {
				await expect(contractAs(daoCrowdsaleFacet, owner).makeAdminCrowdsale(crowdsaleID, user)).to.be.reverted;
			})
		})
		describe("Exchange Create", () => {
			//TODO: similiarly to test/tokens.ts, we might want to implement an interface for Exchanges
			const coinsOffered: any[] = [];
			const coinsRequired: any[] = [];
			const amountsOffered: any[] = [];
			const amountsRequired: any[] = [];
			const repeats = 0;
			const expiration = 0;
			it("Owner can create a Exchange", async () => {
				await contractAs(daoExchangeFacet, owner).createExchange(coinsOffered, coinsRequired, amountsOffered, amountsRequired, repeats, expiration);

				// const daoInstance = await getUserDao(owner);
				// await daoInstance.createExchange(coinsOffered, coinsRequired, amountsOffered, amountsRequired, repeats, expiration, {from:owner});
			})
			it("Admin can create a Exchange", async () => {
				await contractAs(daoExchangeFacet, admin).createExchange(coinsOffered, coinsRequired, amountsOffered, amountsRequired, repeats, expiration);
			})
			it("Supervisor cannot create a Exchange", async () => {
				await expect(contractAs(daoExchangeFacet, supervisor).createExchange(coinsOffered, coinsRequired, amountsOffered, amountsRequired, repeats, expiration)).to.be.reverted;
			})
			it("User cannot create a Exchange", async () => {
				await expect(contractAs(daoExchangeFacet, user).createExchange(coinsOffered, coinsRequired, amountsOffered, amountsRequired, repeats, expiration)).to.be.reverted;
			})
		})
		describe("Exchange Cancel", () => {
			it("Owner can cancel a Exchange", async () => {
				await contractAs(daoExchangeFacet, owner).cancelExchange(exchangeID);
			})
			it("Admin can cancel a Exchange", async () => {
				await contractAs(daoExchangeFacet, admin).cancelExchange(exchangeID);
			})
			it("Supervisor cannot cancel a Exchange", async () => {
				await expect(contractAs(daoExchangeFacet, supervisor).cancelExchange(exchangeID)).to.be.reverted;
			})
			it("User cannot cancel a Exchange", async () => {
				await expect(contractAs(daoExchangeFacet, user).cancelExchange(exchangeID)).to.be.reverted;
			})
		})
		describe("Exchange Renew", () => {
			it("Owner can renew a Exchange", async () => {
				await contractAs(daoExchangeFacet, owner).renewExchange(exchangeID, { from: owner });
			})
			it("Admin can renew a Exchange", async () => {
				await contractAs(daoExchangeFacet, admin).renewExchange(exchangeID);
			})
			it("Supervisor cannot renew a Exchange", async () => {
				await expect(contractAs(daoExchangeFacet, supervisor).renewExchange(exchangeID)).to.be.reverted;
			})
			it("User cannot renew a Exchange", async () => {
				await expect(contractAs(daoExchangeFacet, user).renewExchange(exchangeID)).to.be.reverted;
			})
		})
		describe("Exchange Accept", () => {
			//TODO: similiarly to test/tokens.ts, we might want to implement an interface for Exchanges
			const coinsRequired: any[] = [];
			const coinsAmounts: any[] = [];
			const repeats = 0;
			it("Owner can accept a Exchange", async () => {
				await contractAs(daoExchangeFacet, owner).acceptExchange(exchangeID, coinsRequired, coinsAmounts, repeats);
			})
			it("Admin can accept a Exchange", async () => {
				await contractAs(daoExchangeFacet, admin).acceptExchange(exchangeID, coinsRequired, coinsAmounts, repeats);
			})
			it("Supervisor cannot accept a Exchange", async () => {
				//FIXME: Tests says cannot, but previously written like it should be able to do so
				await contractAs(daoExchangeFacet, supervisor).acceptExchange(exchangeID, coinsRequired, coinsAmounts, repeats);
			})
			it("User cannot accept a Exchange", async () => {
				await expect(contractAs(daoExchangeFacet, user).acceptExchange(exchangeID, coinsRequired, coinsAmounts, repeats)).to.be.reverted;
			})
		})
		describe("Exchange Refill", () => {
			const coinsOffered: any[] = [];
			const coinsAmounts: any[] = [];
			const repeats = 0;
			it("Owner can refill a Exchange", async () => {
				await contractAs(daoExchangeFacet, owner).refillExchange(exchangeID, coinsOffered, coinsAmounts, repeats);
			})
			it("Admin can refill a Exchange", async () => {
				await contractAs(daoExchangeFacet, admin).refillExchange(exchangeID, coinsOffered, coinsAmounts, repeats);
			})
			it("Supervisor cannot refill a Exchange", async () => {
				//FIXME: Tests says cannot, but previously written like it should be able to do so
				await expect(contractAs(daoExchangeFacet, supervisor).refillExchange(exchangeID, coinsOffered, coinsAmounts, repeats));
			})
			it("User cannot refill a Exchange", async () => {
				await expect(contractAs(daoExchangeFacet, user).refillExchange(exchangeID, coinsOffered, coinsAmounts, repeats)).to.be.reverted;
			})
		})
		describe("Exchange Permissions Grant/Revoke", () => {
			it("Owner grants/revokes to Supervisor", async () => {
				assert.equal(await contractAs(daoExchangeFacet, owner).getExchangeManagement(exchangeID, supervisor), false, "Supervisor shouldn't have permissions for given exchange before assignment");
				await contractAs(daoExchangeFacet, owner).makeAdminExchange(exchangeID, supervisor, { from: owner });
				assert.equal(await contractAs(daoExchangeFacet, owner).getExchangeManagement(exchangeID, supervisor), true, "Supervisor should have now permissions for given exchange");
				await contractAs(daoExchangeFacet, owner).removeAdminExchange(exchangeID, supervisor, { from: owner });
				assert.equal(await contractAs(daoExchangeFacet, owner).getExchangeManagement(exchangeID, supervisor), false, "Supervisor shouldn't have permissions for given exchange");
			})
			it("Admin grants/revokes to Supervisor", async () => {
				assert.equal(await contractAs(daoExchangeFacet, admin).getExchangeManagement(exchangeID, supervisor), false, "Supervisor shouldn't have permissions for given exchange before assignment");
				await contractAs(daoExchangeFacet, admin).makeAdminExchange(exchangeID, supervisor, { from: admin });
				assert.equal(await contractAs(daoExchangeFacet, admin).getExchangeManagement(exchangeID, supervisor), true, "Supervisor should have now permissions for given exchange");
				await contractAs(daoExchangeFacet, admin).removeAdminExchange(exchangeID, supervisor, { from: admin });
				assert.equal(await contractAs(daoExchangeFacet, admin).getExchangeManagement(exchangeID, supervisor), false, "Supervisor shouldn't have permissions for given exchange");
			})
			it("Supervisor cannot grant/revoke", async () => {
				assert.equal(await daoExchangeFacet.getExchangeManagement(exchangeID, supervisor), false, "Supervisor shouldn't have permissions for given exchange before assignment");
				await expect(contractAs(daoExchangeFacet, supervisor).makeAdminExchange(exchangeID, supervisor)).to.be.reverted;
				assert.equal(await daoExchangeFacet.getExchangeManagement(exchangeID, supervisor), false, "Supervisor shouldn't have permissions for given exchange");
			})
			it("User cannot grant/revoke", async () => {
				assert.equal(await daoExchangeFacet.getExchangeManagement(exchangeID, user), false, "User shouldn't have permissions for given exchange before assignment");
				await expect(contractAs(daoExchangeFacet, user).makeAdminExchange(exchangeID, user)).to.be.reverted;
				assert.equal(await daoExchangeFacet.getExchangeManagement(exchangeID, user), false, "User shouldn't have permissions for given exchange");
			})
			it("User cannot receive exchange permissions", async () => {
				await expect(contractAs(daoExchangeFacet, owner).makeAdminExchange(exchangeID, user)).to.be.reverted;
				assert.equal(await daoExchangeFacet.getExchangeManagement(exchangeID, user), false, "User shouldn't have permissions for given exchange");
			})
		})
	})
});
