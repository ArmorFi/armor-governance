import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { toChecksumAddress } from "ethereumjs-util";

async function main() {
    let accounts: Signer[];
    let governance: Contract;
    let timelock: Contract;
    let acct_one: Signer;
    let acct_two: Signer;

    accounts = await ethers.getSigners();

    acct_one = accounts[0];
    acct_two = accounts[1];

    const Timelock = await ethers.getContractFactory("Timelock", acct_one);
    timelock = await Timelock.deploy();
    console.log("Timelock: ",timelock.address);

    const Governance = await ethers.getContractFactory("ArmorGovernor", acct_two);
    governance = await Governance.deploy("0x1f28eD9D4792a567DaD779235c2b766Ab84D8E33",timelock.address,"0x5afeDef11AA9CD7DaE4023807810d97C20791dEC","30000000000000000000000000","1000000000000000000000000",17280);
    console.log("Governance: ",governance.address);

    await timelock.initialize(governance.address,172800)
}

main()