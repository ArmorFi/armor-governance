import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getBlockNumber, getTimestamp, increase, mine, ether } from "../utils";
import { MAX_INTEGER } from "ethereumjs-util";

const duration = {
  seconds: function (val: Number) { return BigNumber.from(val); },
  minutes: function (val: Number) { return BigNumber.from(val).mul(this.seconds('60')); },
  hours: function (val: Number) { return BigNumber.from(val).mul(this.minutes('60')); },
  days: function (val: Number) { return BigNumber.from(val).mul(this.hours('24')); },
  weeks: function (val: Number) { return BigNumber.from(val).mul(this.days('7')); },
  years: function (val: Number) { return BigNumber.from(val).mul(this.days('365')); },
};

async function latestTime() {
  const block = await ethers.provider.getBlock('latest');
  return BigNumber.from(block.timestamp);
}

async function increaseTime(duration: BigNumber) {
  await ethers.provider.send("evm_increaseTime", [duration.toNumber()]);
  await ethers.provider.send("evm_mine", []);
}

describe("Governance", () => {
  let timelock: Contract;
  let armor: Contract;
  let varmor: Contract;
  let gov: Contract;

  let accounts: Signer[];
  let contractOwner: Signer;
  let admin: Signer;
  let user1: Signer;
  let user2: Signer;
  let user3: Signer;
  let user4: Signer;
  let others: Signer[];

  let data: string;
  
  const QUORUM_RATIO = ether('1').div(100);
  const THRESHOLD_RATIO = ether('1').div(100);

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    [contractOwner, admin, user1, user2, user3, user4,  ...others] = accounts;

    const TIMELOCK_FACTORY = await ethers.getContractFactory('Timelock');
    const TOKEN_FACTORY = await ethers.getContractFactory('ERC20Mock');
    const VARMOR_FACTORY = await ethers.getContractFactory('vARMOR');
    const GOV_FACTORY = await ethers.getContractFactory('GovernorAlpha');

    armor = await TOKEN_FACTORY.deploy();
    varmor = await VARMOR_FACTORY.deploy(armor.address, admin.getAddress());
    timelock = await TIMELOCK_FACTORY.deploy(await admin.getAddress(), duration.days(2));
    gov = await GOV_FACTORY.deploy(admin.getAddress(), timelock.address, varmor.address, QUORUM_RATIO, THRESHOLD_RATIO);
    let eta:any;
    eta = (await latestTime()).add(duration.days(3));
    await timelock.connect(admin).queueTransaction(gov.address, BigNumber.from(0), "", gov.interface.encodeFunctionData('setPendingAdmin', [await admin.getAddress()]), eta);
    await increase(duration.days(4).toNumber());
    await timelock.connect(admin).executeTransaction(gov.address, BigNumber.from(0), "", gov.interface.encodeFunctionData('setPendingAdmin', [await admin.getAddress()]), eta);
    await gov.connect(admin).acceptAdmin();
    // change timelock gov
    eta = (await latestTime()).add(duration.days(3));
    await timelock.connect(admin).queueTransaction(timelock.address, BigNumber.from(0), "", timelock.interface.encodeFunctionData('setPendingGov', [gov.address]), eta);
    await increase(duration.days(4).toNumber());
    await timelock.connect(admin).executeTransaction(timelock.address, BigNumber.from(0), "", timelock.interface.encodeFunctionData('setPendingGov', [gov.address]), eta);

    eta = (await latestTime()).add(duration.days(3));
    await timelock.connect(admin).queueTransaction(timelock.address, BigNumber.from(0), "", timelock.interface.encodeFunctionData('setDelay', [duration.days(2)]), eta);
    await increase(duration.days(4).toNumber());
    await timelock.connect(admin).executeTransaction(timelock.address, BigNumber.from(0), "", timelock.interface.encodeFunctionData('setDelay', [duration.days(2)]), eta);

    await gov.connect(admin).acceptTimelockGov();
  });

  describe('#constructor()', () => {
    it('should fail if quorum ratio is too big', async () => {
      const GOV_FACTORY = await ethers.getContractFactory('GovernorAlpha');
      const shouldFail = GOV_FACTORY.deploy(admin.getAddress(), timelock.address, varmor.address, constants.MaxUint256, THRESHOLD_RATIO);
      await expect(shouldFail).to.be.reverted;
    });

    it('should fail if quorum ratio is too big', async () => {
      const GOV_FACTORY = await ethers.getContractFactory('GovernorAlpha');
      const shouldFail = GOV_FACTORY.deploy(admin.getAddress(), timelock.address, varmor.address, QUORUM_RATIO, constants.MaxUint256);
      await expect(shouldFail).to.be.reverted;
    });

    describe('deployed', () => {
      it('admin set properly', async () => {
        const res = await gov.admin();
        expect(res).to.equal(await admin.getAddress());
      });

      it('timelock contract set properly', async () => {
        const res = await gov.timelock();
        expect(res).to.equal(timelock.address);
      });

      it('varmor set properly', async () => {
        const res = await gov.varmor();
        expect(res).to.equal(varmor.address);
      });

      it('quorumRatio set properly', async () => {
        const res = await gov.quorumRatio();
        expect(res).to.equal(QUORUM_RATIO);
      });

      it('thresholdRatio set properly', async () => {
        const res = await gov.thresholdRatio();
        expect(res).to.equal(THRESHOLD_RATIO);
      });
    });
  }); // #constructor()

  describe('#propose()', () => {
    const AMOUNT1 = ether('4');
    const AMOUNT2 = ether('2');
    const AMOUNT3 = ether('3');
    const AMOUNT4 = ether('1');

    let target: string;
    let value: BigNumber;
    let signature: any;
    let calldata: any;

    beforeEach(async () => {
      // admin set votingPeriod
      await gov.connect(admin).propose([gov.address], [BigNumber.from(0)], [""], [gov.interface.encodeFunctionData('setVotingPeriod', [BigNumber.from(10)])], "testing");
      await gov.connect(admin).queue(BigNumber.from(1));
      await increase(duration.days(3).toNumber());
      await gov.connect(admin).execute(BigNumber.from(1));

      await armor.transfer(await user1.getAddress(), AMOUNT1);
      await armor.transfer(await user2.getAddress(), AMOUNT2);
      await armor.transfer(await user3.getAddress(), AMOUNT3);
      await armor.transfer(await user4.getAddress(), AMOUNT4);
      await armor.connect(user1).approve(varmor.address, AMOUNT1);
      await armor.connect(user2).approve(varmor.address, AMOUNT2);
      await armor.connect(user3).approve(varmor.address, AMOUNT3);
      await armor.connect(user4).approve(varmor.address, AMOUNT4);
      await varmor.connect(user1).deposit(AMOUNT1);
      await varmor.connect(user2).deposit(AMOUNT2);
      await varmor.connect(user3).deposit(AMOUNT3);
      await varmor.connect(user4).deposit(AMOUNT4);
      await varmor.connect(user1).delegate(await user1.getAddress());
      await varmor.connect(user2).delegate(await user2.getAddress());
      await varmor.connect(user3).delegate(await user3.getAddress());
      await varmor.connect(user4).delegate(await user4.getAddress());
      
      target = gov.address;
      value = BigNumber.from(0);
      signature = "";
      calldata = gov.interface.encodeFunctionData('setThresholdRatio', [ether('2').div(100)]);
    });

    it('pre-condition check', async () => {
      expect(await varmor.balanceOf(await user1.getAddress())).to.equal(ether('4'));
      expect(await varmor.balanceOf(await user2.getAddress())).to.equal(ether('2'));
      expect(await varmor.balanceOf(await user3.getAddress())).to.equal(ether('3'));
      expect(await varmor.balanceOf(await user4.getAddress())).to.equal(ether('1'));
      console.log((await varmor.balanceOf(await user1.getAddress())).toString());
      console.log((await gov.proposalThreshold((await getBlockNumber()).sub(1))).toString());
      const check = await varmor.getPriorVotes(await user1.getAddress(), (await getBlockNumber()).sub(1));
      console.log(check);
    });

    it('should fail if msg.sender does not have enough votes', async () => {
      const shouldFail = gov.connect(others[0]).propose([target], [value], [signature], [calldata], "test");
      await expect(shouldFail).to.be.revertedWith("GovernorAlpha::propose: proposer votes below proposal threshold");
    });

    it('should fail if parameter\'s length mismatch', async () => {
      const shouldFail = gov.connect(user1).propose([target], [value], [signature, ""], [calldata], "test");
      await expect(shouldFail).to.be.revertedWith("GovernorAlpha::propose: proposal function information arity mismatch");
    });

    it('should fail if no target exist', async () => {
      const shouldFail = gov.connect(user1).propose([], [], [], [], "test");
      await expect(shouldFail).to.be.revertedWith("GovernorAlpha::propose: must provide actions");
    });

    it('should fail if too many targets', async () => {
      const shouldFail = gov.connect(user1).propose(Array(11).fill(target), Array(11).fill(value), Array(11).fill(signature), Array(11).fill(calldata), "test");
      await expect(shouldFail).to.be.revertedWith("GovernorAlpha::propose: too many actions");
    });

    it('should fail if more than one live proposal per proposer', async () => {
      await gov.connect(user1).propose([target], [value], [signature], [calldata], "test");
      const shouldFail = gov.connect(user1).propose([target], [value], [signature], [calldata], "test");
      await expect(shouldFail).to.be.revertedWith("GovernorAlpha::propose: one live proposal per proposer, found an already pending proposal");
    });

    describe('valid case', () => {
      let receipt: any;

      beforeEach(async () => {
        receipt = gov.connect(user1).propose([target], [value], [signature], [calldata], "test");
        await receipt;
      });

      it('proposed', async () => {
        const res = await gov.state(BigNumber.from(2));
        expect(res).to.equal(0);

        await mine();
        await mine();
        await mine();
        await mine();

        const res1 = await gov.state(BigNumber.from(2));
        expect(res1).to.equal(1);

        const res2 = await gov.getActions(BigNumber.from(2));
      });

      it('should emit ProposalCreated event', async () => {
        await expect(receipt)
          .to.emit(gov, 'ProposalCreated');
      });
    });
  }); //#propose

  describe('#queue()', async () => {
    const AMOUNT1 = ether('4');
    const AMOUNT2 = ether('2');
    const AMOUNT3 = ether('3');
    const AMOUNT4 = ether('1');

    let target: string;
    let value: BigNumber;
    let signature: any;
    let calldata: any;

    beforeEach(async () => {
      // admin set votingPeriod
      await gov.connect(admin).propose([gov.address], [BigNumber.from(0)], [""], [gov.interface.encodeFunctionData('setVotingPeriod', [BigNumber.from(5)])], "testing");
      await gov.connect(admin).queue(BigNumber.from(1));
      await increase(duration.days(3).toNumber());
      await gov.connect(admin).execute(BigNumber.from(1));

      await armor.transfer(await user1.getAddress(), AMOUNT1);
      await armor.transfer(await user2.getAddress(), AMOUNT2);
      await armor.transfer(await user3.getAddress(), AMOUNT3);
      await armor.transfer(await user4.getAddress(), AMOUNT4);
      await armor.connect(user1).approve(varmor.address, AMOUNT1);
      await armor.connect(user2).approve(varmor.address, AMOUNT2);
      await armor.connect(user3).approve(varmor.address, AMOUNT3);
      await armor.connect(user4).approve(varmor.address, AMOUNT4);
      await varmor.connect(user1).deposit(AMOUNT1);
      await varmor.connect(user2).deposit(AMOUNT2);
      await varmor.connect(user3).deposit(AMOUNT3);
      await varmor.connect(user4).deposit(AMOUNT4);
      await varmor.connect(user1).delegate(await user1.getAddress());
      await varmor.connect(user2).delegate(await user2.getAddress());
      await varmor.connect(user3).delegate(await user3.getAddress());
      await varmor.connect(user4).delegate(await user4.getAddress());
      
      target = gov.address;
      value = BigNumber.from(0);
      signature = "";
      calldata = gov.interface.encodeFunctionData('setThresholdRatio', [ether('2').div(100)]);
      await mine();
      await gov.connect(user1).propose([target], [value], [signature], [calldata], "test");
      await mine();
    });

    it('should fail if proposal is rejected', async () => {
      await gov.connect(user1).castVote(BigNumber.from(2), false);
      await mine();
      const shouldFail = gov.queue(BigNumber.from(2));
      await expect(shouldFail).to.be.revertedWith("GovernorAlpha::queue: proposal can only be queued if it is succeeded");
    });

    it('should fail if already queued', async () => {
      await gov.connect(user1).castVote(BigNumber.from(2), true);
      await mine();
      await mine();
      await mine();
      await mine();
      await mine();
      await gov.queue(BigNumber.from(2));
      const shouldFail = gov.queue(BigNumber.from(2));
      await expect(shouldFail).to.be.revertedWith("GovernorAlpha::queue: proposal can only be queued if it is succeeded");
    });

    describe('valid case', () => {
      let receipt: any;

      beforeEach(async () => {
        await gov.connect(user1).castVote(BigNumber.from(2), true);
        await mine();
        await mine();
        await mine();
        await mine();
        await mine();
        receipt = gov.queue(BigNumber.from(2));
        await receipt;
      });

      it('queued', async () => {
        await expect(receipt)
          .to.emit(timelock, 'QueueTransaction');
      });

      it('should emit ProposalQueued event', async () => {
        await expect(receipt)
          .to.emit(gov, 'ProposalQueued');
      });
    });
  }); // #queue

  describe('#execute', () => {
    const AMOUNT1 = ether('4');
    const AMOUNT2 = ether('2');
    const AMOUNT3 = ether('3');
    const AMOUNT4 = ether('1');

    let target: string;
    let value: BigNumber;
    let signature: any;
    let calldata: any;

    beforeEach(async () => {
      // admin set votingPeriod
      await gov.connect(admin).propose([gov.address], [BigNumber.from(0)], [""], [gov.interface.encodeFunctionData('setVotingPeriod', [BigNumber.from(5)])], "testing");
      await gov.connect(admin).queue(BigNumber.from(1));
      await increase(duration.days(3).toNumber());
      await gov.connect(admin).execute(BigNumber.from(1));

      await armor.transfer(await user1.getAddress(), AMOUNT1);
      await armor.transfer(await user2.getAddress(), AMOUNT2);
      await armor.transfer(await user3.getAddress(), AMOUNT3);
      await armor.transfer(await user4.getAddress(), AMOUNT4);
      await armor.connect(user1).approve(varmor.address, AMOUNT1);
      await armor.connect(user2).approve(varmor.address, AMOUNT2);
      await armor.connect(user3).approve(varmor.address, AMOUNT3);
      await armor.connect(user4).approve(varmor.address, AMOUNT4);
      await varmor.connect(user1).deposit(AMOUNT1);
      await varmor.connect(user2).deposit(AMOUNT2);
      await varmor.connect(user3).deposit(AMOUNT3);
      await varmor.connect(user4).deposit(AMOUNT4);
      await varmor.connect(user1).delegate(await user1.getAddress());
      await varmor.connect(user2).delegate(await user2.getAddress());
      await varmor.connect(user3).delegate(await user3.getAddress());
      await varmor.connect(user4).delegate(await user4.getAddress());
      
      target = gov.address;
      value = BigNumber.from(0);
      signature = "";
      calldata = gov.interface.encodeFunctionData('setThresholdRatio', [ether('2').div(100)]);
      await mine();
      await gov.connect(user1).propose([target], [value], [signature], [calldata], "test");
      await mine();

      await gov.connect(user1).castVote(BigNumber.from(2), true);
      await mine();
      await mine();
      await mine();
      await mine();
      await mine();
      await gov.queue(BigNumber.from(2));
    });

    it('should fail if proposal is not queued', async () => {
      const shouldFail = gov.execute(BigNumber.from(1));
      await expect(shouldFail).to.be.revertedWith("GovernorAlpha::execute: proposal can only be executed if it is queued");
    });

    describe('valid case', () => {
      let receipt: any;

      beforeEach(async () => {
        await gov.getReceipt(BigNumber.from(2), await user1.getAddress());

        await increase(duration.days(3).toNumber());
        receipt = gov.execute(BigNumber.from(2));
        await receipt;
      });

      it('exectued', async () => {
        const res = await gov.thresholdRatio();
        expect(res).to.equal(ether('2').div(100));
        const res2 = await gov.state(BigNumber.from(2));
        expect(res2).to.equal(7);
      });

      it('should emit ProposalExecuted event', async () => {
        await expect(receipt)
          .to.emit(gov, 'ProposalExecuted')
          .withArgs(BigNumber.from(2));
      });
    });
  }); //#execute

  describe('#reject()', () => {
    const AMOUNT1 = ether('4');
    const AMOUNT2 = ether('2');
    const AMOUNT3 = ether('3');
    const AMOUNT4 = ether('1');

    let target: string;
    let value: BigNumber;
    let signature: any;
    let calldata: any;

    beforeEach(async () => {
      // admin set votingPeriod
      await gov.connect(admin).propose([gov.address], [BigNumber.from(0)], [""], [gov.interface.encodeFunctionData('setVotingPeriod', [BigNumber.from(5)])], "testing");
      await gov.connect(admin).queue(BigNumber.from(1));
      await increase(duration.days(3).toNumber());
      await gov.connect(admin).execute(BigNumber.from(1));

      await gov.connect(admin).propose([gov.address], [BigNumber.from(0)], [""], [gov.interface.encodeFunctionData('setQuorumRatio', [QUORUM_RATIO])], "testing");
      await gov.connect(admin).queue(BigNumber.from(2));
      await increase(duration.days(3).toNumber());
      await gov.connect(admin).execute(BigNumber.from(2));

      await armor.transfer(await user1.getAddress(), AMOUNT1);
      await armor.transfer(await user2.getAddress(), AMOUNT2);
      await armor.transfer(await user3.getAddress(), AMOUNT3);
      await armor.transfer(await user4.getAddress(), AMOUNT4);
      await armor.connect(user1).approve(varmor.address, AMOUNT1);
      await armor.connect(user2).approve(varmor.address, AMOUNT2);
      await armor.connect(user3).approve(varmor.address, AMOUNT3);
      await armor.connect(user4).approve(varmor.address, AMOUNT4);
      await varmor.connect(user1).deposit(AMOUNT1);
      await varmor.connect(user2).deposit(AMOUNT2);
      await varmor.connect(user3).deposit(AMOUNT3);
      await varmor.connect(user4).deposit(AMOUNT4);
      await varmor.connect(user1).delegate(await user1.getAddress());
      await varmor.connect(user2).delegate(await user2.getAddress());
      await varmor.connect(user3).delegate(await user3.getAddress());
      await varmor.connect(user4).delegate(await user4.getAddress());
      
      target = gov.address;
      value = BigNumber.from(0);
      signature = "";
      calldata = gov.interface.encodeFunctionData('setThresholdRatio', [ether('2').div(100)]);
      await mine();
      await gov.connect(user1).propose([target], [value], [signature], [calldata], "test");
      await mine();
    });

    it('should fail if proposal is not defeated', async () => {
      await gov.connect(user1).castVote(BigNumber.from(3), true);
      await mine();
      await mine();
      await mine();
      await mine();
      await mine();
      const shouldFail = gov.reject(BigNumber.from(3));
      await expect(shouldFail).to.be.revertedWith("GovernorAlpha::reject: proposal has not been defeated");
    });

    describe('valid case', () => {
      let receipt: any;

      beforeEach(async () => {
        await gov.connect(user1).castVote(BigNumber.from(3), false);
        await mine();
        await mine();
        await mine();
        await mine();
        await mine();
        receipt = gov.reject(BigNumber.from(3));
        await receipt;
      });

      it('cancled', async () => {
        const res = await gov.state(BigNumber.from(3));
        expect(res).to.equal(2);
      });

      it('should emit ProposalCancled event', async () => {
        await expect(receipt)
          .to.emit(gov, 'ProposalCanceled')
          .withArgs(BigNumber.from(3));
      });
    });
  });

  describe('#cancle()', () => {
    const AMOUNT1 = ether('4');
    const AMOUNT2 = ether('2');
    const AMOUNT3 = ether('3');
    const AMOUNT4 = ether('1');

    let target: string;
    let value: BigNumber;
    let signature: any;
    let calldata: any;

    beforeEach(async () => {
      // admin set votingPeriod
      await gov.connect(admin).propose([gov.address], [BigNumber.from(0)], [""], [gov.interface.encodeFunctionData('setVotingPeriod', [BigNumber.from(5)])], "testing");
      await gov.connect(admin).queue(BigNumber.from(1));
      await increase(duration.days(3).toNumber());
      await gov.connect(admin).execute(BigNumber.from(1));

      await armor.transfer(await user1.getAddress(), AMOUNT1);
      await armor.transfer(await user2.getAddress(), AMOUNT2);
      await armor.transfer(await user3.getAddress(), AMOUNT3);
      await armor.transfer(await user4.getAddress(), AMOUNT4);
      await armor.connect(user1).approve(varmor.address, AMOUNT1);
      await armor.connect(user2).approve(varmor.address, AMOUNT2);
      await armor.connect(user3).approve(varmor.address, AMOUNT3);
      await armor.connect(user4).approve(varmor.address, AMOUNT4);
      await varmor.connect(user1).deposit(AMOUNT1);
      await varmor.connect(user2).deposit(AMOUNT2);
      await varmor.connect(user3).deposit(AMOUNT3);
      await varmor.connect(user4).deposit(AMOUNT4);
      await varmor.connect(user1).delegate(await user1.getAddress());
      await varmor.connect(user2).delegate(await user2.getAddress());
      await varmor.connect(user3).delegate(await user3.getAddress());
      await varmor.connect(user4).delegate(await user4.getAddress());
      
      target = gov.address;
      value = BigNumber.from(0);
      signature = "";
      calldata = gov.interface.encodeFunctionData('setThresholdRatio', [ether('2').div(100)]);
      await mine();
      await gov.connect(user1).propose([target], [value], [signature], [calldata], "test");
      await mine();
    });

    it('should fail if proposal is already executed', async () => {
      const shouldFail = gov.cancel(BigNumber.from(1));
      await expect(shouldFail).to.be.revertedWith("GovernorAlpha::cancel: cannot cancel executed proposal");
    });

    it('should fail if proposal proposal votes exceeds the threshold', async () => {
      await gov.connect(user1).castVote(BigNumber.from(2), false);
      await mine();
      await mine();
      await mine();
      await mine();
      await mine();
      const shouldFail = gov.cancel(BigNumber.from(2));
      await expect(shouldFail).to.be.revertedWith("GovernorAlpha::cancel: proposer above threshold");
    });

    describe('valid case', () => {
      let receipt: any;

      beforeEach(async () => {
        await varmor.connect(user1).delegate(constants.AddressZero);
        receipt = gov.cancel(BigNumber.from(2));
        await receipt;
      });

      it('cancled', async () => {
        const res = await gov.state(BigNumber.from(2));
        expect(res).to.equal(2);
      });

      it('should emit ProposalCancled event', async () => {
        await expect(receipt)
          .to.emit(gov, 'ProposalCanceled')
          .withArgs(BigNumber.from(2));
      });
    });

  });
});
