import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getTimestamp, increase, mine } from "../utils";

describe("Faucet", function(){
  let faucet: Contract;
  let token: Contract;
  let owner: Signer;
  let user: Signer;
  let vArmor: Signer;

  beforeEach(async function(){
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[1];
    vArmor = accounts[2];
    const TokenFactory = await ethers.getContractFactory("ERC20Mock");
    token = await TokenFactory.connect(user).deploy();
    const Faucet = await ethers.getContractFactory("Faucet");
    faucet = await Faucet.connect(owner).deploy(token.address, vArmor.getAddress(), "826719576720000000");
    await token.mint(faucet.address, "1000000000000000000000000");
  });

  describe("disburse", function(){
    it("should set initial variables correctly", async function(){
        let reward = await faucet.rewardsPerSec();
        let lastDisbursed = await faucet.lastDisbursed();
        let ownerSet = await faucet.owner();
        let contToken = await faucet.token();
        let contvArmor = await faucet.vArmor();

        expect(lastDisbursed).to.not.be.equal(0);
        expect(ownerSet).to.be.equal(await owner.getAddress());
        expect(reward).to.be.equal("826719576720000000");
        expect(contToken.toString()).to.be.equal(token.address);
        expect(contvArmor).to.be.equal(await vArmor.getAddress());
    });
    it("should disburse correctly", async function(){
        await increase(86400 * 7);
        await faucet.disburse();
        let afterBal = await token.balanceOf(vArmor.getAddress());
        expect(afterBal.toString()).to.be.equal("500000826719832720000000")
    });
  });

  describe("onlyOwner", function(){
    it("should change rewards from owner", async function(){
        await faucet.connect(owner).changeRate("50000000000");
        let reward = await faucet.rewardsPerSec();
        expect(reward).to.be.equal("50000000000");
    });
    it("should withdraw rewards from owner", async function(){
        let reward = await faucet.connect(owner).withdraw("1000000000000000000000");
        let balance = await token.balanceOf(owner.getAddress());
        expect(balance.toString()).to.be.equal("1000000000000000000000");
    });
    it("should not change rewards from user", async function(){
        await expect(faucet.connect(user).changeRate("500000000000000000000")).to.be.revertedWith("msg.sender is not owner");
    });
    it("should not withdraw rewards from user", async function(){
        await expect(faucet.connect(user).withdraw("1000000000000000000000")).to.be.revertedWith("msg.sender is not owner");
    });
  });
});
