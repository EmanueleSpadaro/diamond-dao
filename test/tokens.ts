import { ethers } from "hardhat"
export interface Token {
    name: string,
    symbol: string,
    decimals: number,
    logoURL: string,
    logoHash: string,
    hardCap: number,
    contractHash: string
}

export const ownerToken: Token = {
    name: "Crowdsale Mintable Token",
    symbol: "CRMNT",
    decimals: 18,
    logoURL:
        "https://apollo-uploads-las.s3.amazonaws.com/1442324623/atlanta-hawks-logo-944556.png",
    logoHash: ethers.hexlify(
        "0x4D021B157A49F472A48AB02A1F2F6E2986C169A7C78CC94179EDAEBD5E96E8E4"
    ),
    hardCap: 100000000000,
    contractHash: ethers.hexlify(
        "0x4D021B157A49F472A48AB02A1F2F6E2986C169A7C78CC94179EDAEBD5E96E8E4"
    )
}

export const adminToken: Token = {
    name: "DAO Capped Token",
    symbol: "DCAP",
    decimals: 18,
    logoURL: "https://apollo-uploads-las.s3.amazonaws.com/1442324623/atlanta-hawks-logo-944556.png",
    logoHash: ethers.hexlify("0x4D021B157A49F472A48AB02A1F2F6E2986C169A7C78CC94179EDAEBD5E96E8E4"), // sha256 hash
    hardCap: 10000,
    contractHash: ethers.hexlify("0x4D021B157A49F472A48AB02A1F2F6E2986C169A7C78CC94179EDAEBD5E96E8E4")
}

export const notCreatableToken: Token = {
    name: "DAO Test Token",
    symbol: "TCAP",
    decimals: 18,
    logoURL: "https://apollo-uploads-las.s3.amazonaws.com/1442324623/atlanta-hawks-logo-944556.png",
    logoHash: ethers.hexlify("0x4D021B157A49F472A48AB02A1F2F6E2986C169A7C78CC94179EDAEBD5E96E8E4"), // sha256 hash
    hardCap: 50000,
    contractHash: ethers.hexlify("0x4D021B157A49F472A48AB02A1F2F6E2986C169A7C78CC94179EDAEBD5E96E8E4")
}