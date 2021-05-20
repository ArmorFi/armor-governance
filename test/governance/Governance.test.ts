import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getBlockNumber, getTimestamp, increase, mine } from "../utils";

describe("Governance", function(){
  let timelock: Contract;
  let token: Contract;
  let varmor: Contract;
  let gov: Contract;
  let admin: Signer;
  let against: Signer;
  let anon: Signer;
  let data: string;

  beforeEach(async function(){
    const accounts = await ethers.getSigners();
    admin = accounts[1];
    anon = accounts[2];
    against = accounts[3];
    const TokenFactory = await ethers.getContractFactory("ERC20Mock");
    token = await TokenFactory.deploy();
    const VArmorFactory = await ethers.getContractFactory("vARMOR");
    varmor = await VArmorFactory.deploy(token.address, admin.getAddress());
    const TimelockFactory = await ethers.getContractFactory("Timelock");
    timelock = await TimelockFactory.deploy(admin.getAddress(), 86400 * 2);
    const GovernanceFactory = await ethers.getContractFactory("GovernorAlpha");
    gov = await GovernanceFactory.deploy(admin.getAddress(), timelock.address, varmor.address, "10000000000000000", "10000000000000000");
    const abiCoder = new ethers.utils.AbiCoder();
    const eta = (await getTimestamp()).add(86400*2 + 100);
    await timelock.connect(admin).queueTransaction(timelock.address, 0, "setPendingGov(address)", abiCoder.encode(["address"], [gov.address]), eta);
    await increase(86400*2 + 101);
    await timelock.connect(admin).executeTransaction(timelock.address, 0, "setPendingGov(address)", abiCoder.encode(["address"], [gov.address]), eta);
    await gov.connect(admin).acceptTimelockGov();

    await token.transfer(admin.getAddress(), "10000000000000000");
    await token.connect(admin).approve(varmor.address, "10000000000000000");
    await varmor.connect(admin).deposit("10000000000000000");
    console.log(await varmor.totalSupply());
    console.log(await varmor.balanceOf(admin.getAddress()));
    await mine();
    await varmor.connect(admin).delegate(admin.getAddress());
    console.log(await varmor.getPriorVotes(admin.getAddress(), (await getBlockNumber()).sub(1)));

    await token.transfer(timelock.address, 100);
    data = abiCoder.encode(["address","uint256"],[varmor.address, 100]);
  });

  describe.only("#reject", function(){
    it("should be able to reject admin's proposal", async function(){
      await token.transfer(against.getAddress(), "20000000000000000");
      await token.connect(against).approve(varmor.address, "20000000000000000");
      await varmor.connect(against).deposit("20000000000000000");
      await mine();
      await varmor.connect(against).delegate(against.getAddress());
      await mine();
      await gov.connect(admin).propose([token.address], [0], ["transfer(address,uint256)"],[data], "going through with admin priv");
      await gov.connect(admin).queue(1);
      await gov.connect(against).castVote(1, false);
      console.log(await gov.proposals(1));
      await gov.connect(against).reject(1);
    });
  });
});
