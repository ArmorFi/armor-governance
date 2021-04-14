import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getTimestamp, increase, mine } from "../utils";

describe("Timelock", function(){
  let timelock: Contract;
  let token: Contract;
  let admin: Signer;
  let gov: Signer;

});
