import { ethers } from "hardhat";
import { FacetCutAction, getSelectors, DaoConstructorArgs } from "./libraries/diamond";

const verbose = false;

export async function deployDiamond() {
  const accounts = await ethers.getSigners()
  const contractOwner = accounts[0]

  // deploy DiamondCutFacet
  const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet')
  const diamondCutFacet = await DiamondCutFacet.deploy()
  await diamondCutFacet.waitForDeployment()
  if (verbose)
    console.log('DiamondCutFacet deployed:', await diamondCutFacet.getAddress())

  // deploy Diamond
  const daoConstructorArgs: DaoConstructorArgs = {
    owner: accounts[1].address,
    realm: "dao",
    name: "Paolo Borsellino",
    firstlifePlaceID: "idididid",
    description_cid: "just dont get in it",
    isInviteOnly: false
  }
  const Diamond = await ethers.getContractFactory('Diamond')
  const diamond = await Diamond.deploy(contractOwner.address, await diamondCutFacet.getAddress(), daoConstructorArgs)
  await diamond.waitForDeployment()
  if (verbose)
    console.log('Diamond deployed:', await diamond.getAddress())

  // deploy DiamondInit
  // DiamondInit provides a function that is called when the diamond is upgraded to initialize state variables
  // Read about how the diamondCut function works here: https://eips.ethereum.org/EIPS/eip-2535#addingreplacingremoving-functions
  const DiamondInit = await ethers.getContractFactory('DiamondInit')
  const diamondInit = await DiamondInit.deploy()
  await diamondInit.waitForDeployment()
  if (verbose)
    console.log('DiamondInit deployed:', await diamondInit.getAddress())

  // deploy facets
  if (verbose) {
    console.log('')
    console.log('Deploying facets')

  }
  const FacetNames = [
    'DiamondLoupeFacet',
    'OwnershipFacet',
    'DaoFacet',
    'DaoTokenFacet',
    'DaoCrowdsaleFacet',
    'DaoExchangeFacet'
  ]
  const cut = []
  for (const FacetName of FacetNames) {
    const Facet = await ethers.getContractFactory(FacetName)
    const facet = await Facet.deploy()
    await facet.waitForDeployment()
    // const facetContract = await ethers.getContractAt(FacetName, await facet.getAddress())
    if (verbose)
      console.log(`${FacetName} deployed: ${await facet.getAddress()}`)
    cut.push({
      facetAddress: await facet.getAddress(),
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(Facet)
    })
  }

  // upgrade diamond with facets
  if (verbose) {
    console.log('')
    console.log('Diamond Cut:', cut)
  }
  const diamondCut = await ethers.getContractAt('IDiamondCut', await diamond.getAddress())
  let tx
  let receipt
  // call to init function
  let functionCall = diamondInit.interface.encodeFunctionData('init')
  tx = await diamondCut.diamondCut(cut, await diamondInit.getAddress(), functionCall)
  if (verbose)
    console.log('Diamond cut tx: ', tx.hash)
  receipt = await tx.wait()
  if (!receipt.status) {
    throw Error(`Diamond upgrade failed: ${tx.hash}`)
  }
  if (verbose)
    console.log('Completed diamond cut')
  else
    console.log('Diamond deployed')
  return await diamond.getAddress()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployDiamond().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
