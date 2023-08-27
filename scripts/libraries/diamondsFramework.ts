import { Contract } from "ethers";
import { ethers } from "hardhat";


export async function deployFacets(contractNames: string[]){
    //TODO: controllare che non ci siano nomi uguali per non deployare due volte le facette
    console.log('eskere');
    
    console.log(contractNames);
    
    const contracts: Contract[] = [];
    for(const facetName of contractNames){
        if(!facetName.endsWith('Facet'))
            throw new Error(facetName + " is not a conventional Facet name. Facets contract must end with Facet.");
        const ContractFactory = await ethers.getContractFactory(facetName);
        const contract = await ContractFactory.deploy();
        console.log(facetName + ' deployed at ' + await contract.getAddress());
        contracts.push(contract);
    }
    return contracts;
}