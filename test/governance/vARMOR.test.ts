import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getTimestamp, increase, mine } from "../utils";

describe("vARMOR", function(){
  let armor: Contract;
  let varmor: Contract;
  let gov: Signer;
  let user: Signer;
  let delegator: Signer;
  let delegator2: Signer;
  let delegatee: Signer;
  let newDelegatee: Signer;
  let others: Signer[];

  const AMOUNT = BigNumber.from("1000000000000000000");
  beforeEach(async function(){
    const accounts = await ethers.getSigners();
    gov = accounts[0];
    user = accounts[1];
    delegator = accounts[2];
    delegator2 = accounts[3];
    delegatee = accounts[4];
    newDelegatee = accounts[5];
    others = accounts.slice(6);
    const ArmorFactory = await ethers.getContractFactory("ERC20Mock");
    armor = await ArmorFactory.deploy();
    await armor.transfer(user.getAddress(), AMOUNT);
    const VArmorFactory = await ethers.getContractFactory("vARMOR");
    varmor = await VArmorFactory.deploy(armor.address, gov.getAddress());
  });
  
  describe("#deposit", function(){
    beforeEach(async function(){
      await armor.connect(user).approve(varmor.address, AMOUNT);
    });
    describe("when totalSupply == 0", function(){
      it("sanity check", async function(){
        expect(await varmor.totalSupply()).to.equal(0);
      });
      describe("effect", function(){
        beforeEach( async function(){
          await varmor.connect(user).deposit(AMOUNT);
        });

        it("totalSupply should increase", async function(){
          expect(await varmor.totalSupply()).to.equal(AMOUNT);
        });

        it("balanceOf should increase", async function(){
          expect(await varmor.balanceOf(user.getAddress())).to.equal(AMOUNT);
        });
      });
    });
    describe("when totalSupply != 0", function(){
      beforeEach(async function(){
        await varmor.connect(user).deposit(AMOUNT);
        await armor.transfer(user.getAddress(), AMOUNT);
        await armor.connect(user).approve(varmor.address, AMOUNT);
      });
      it("sanity check", async function(){
        expect(await varmor.totalSupply()).to.not.equal(0);
      });
      describe("effect", function(){
        beforeEach( async function(){
          await varmor.connect(user).deposit(AMOUNT);
        });

        it("totalSupply should increase", async function(){
          expect(await varmor.totalSupply()).to.equal(AMOUNT.mul(2));
        });

        it("balanceOf should increase", async function(){
          expect(await varmor.balanceOf(user.getAddress())).to.equal(AMOUNT.mul(2));
        });
      });
      describe("when totalSupply != armor.balanceOf(varmor)",function(){
        beforeEach( async function(){
          await varmor.connect(user).deposit(AMOUNT);
          await armor.transfer(varmor.address, AMOUNT.mul(2));
          await armor.transfer(user.getAddress(), AMOUNT);
          await armor.connect(user).approve(varmor.address, AMOUNT);
          await varmor.connect(user).deposit(AMOUNT);
        });

        it("totalSupply should increase", async function(){
          expect(await varmor.totalSupply()).to.equal(AMOUNT.mul(5).div(2) );
        });

        it("balanceOf should increase", async function(){
          expect(await varmor.balanceOf(user.getAddress())).to.equal(AMOUNT.mul(5).div(2));
        });
      });
    });
  });

  describe.only("#withdraw", function(){
    beforeEach(async function(){
      await armor.connect(user).approve(varmor.address, AMOUNT);
      await varmor.connect(user).deposit(AMOUNT);
      await varmor.connect(user).approve(varmor.address, AMOUNT);
    });
    // test armor amounts
    // test withdraw request and finalize
    describe("when totalSupply == 0", function(){
      it("sanity check", async function(){
        expect(await varmor.totalSupply()).to.equal(AMOUNT);
      });
      describe("effect", function(){
        beforeEach( async function(){
          await varmor.connect(user).requestWithdrawal(AMOUNT);
        });

        it("totalSupply should decrease", async function(){
          expect(await varmor.totalSupply()).to.equal(0);
        });

        it("user balanceOf should decrease", async function(){
          expect(await varmor.balanceOf(user.getAddress())).to.equal(0);
        });

        it("user armor should not increase", async function(){
          expect(await armor.balanceOf(user.getAddress())).to.equal(0);
        });

        it("pending armor withdrawals should increase", async function(){
          expect(await varmor.pending().to.equal(AMOUNT));
        });
      
        it("vArmorToArmor should be 0", async function(){
          let resp = await varmor.vArmorToArmor(AMOUNT)
          expect(resp.to.equal(0));
        });
      });
    });
    describe("when totalSupply != 0", function(){
      beforeEach(async function(){
        await varmor.connect(user).deposit(AMOUNT);
        await armor.transfer(user.getAddress(), AMOUNT);
        await armor.connect(user).approve(varmor.address, AMOUNT);
      });
      it("sanity check", async function(){
        expect(await varmor.totalSupply()).to.not.equal(0);
      });
      describe("effect", function(){
        beforeEach( async function(){
          await varmor.connect(user).deposit(AMOUNT);
        });

        it("totalSupply should increase", async function(){
          expect(await varmor.totalSupply()).to.equal(AMOUNT.mul(2));
        });

        it("balanceOf should increase", async function(){
          expect(await varmor.balanceOf(user.getAddress())).to.equal(AMOUNT.mul(2));
        });
      });
      describe("when totalSupply != armor.balanceOf(varmor)",function(){
        beforeEach( async function(){
          await varmor.connect(user).deposit(AMOUNT);
          await armor.transfer(varmor.address, AMOUNT.mul(2));
          await armor.transfer(user.getAddress(), AMOUNT);
          await armor.connect(user).approve(varmor.address, AMOUNT);
          await varmor.connect(user).deposit(AMOUNT);
        });

        it("totalSupply should increase", async function(){
          expect(await varmor.totalSupply()).to.equal(AMOUNT.mul(5).div(2) );
        });

        it("balanceOf should increase", async function(){
          expect(await varmor.balanceOf(user.getAddress())).to.equal(AMOUNT.mul(5).div(2));
        });
      });
    });
  });

  describe('vARMOR spec', function() {
    const totalAmount = BigNumber.from('10000');
    const voteAmount = BigNumber.from('10');
    beforeEach(async function(){
      await armor.approve(varmor.address, AMOUNT);
      await varmor.deposit(AMOUNT);
    });

    describe('#delegate()', function() {
      beforeEach(async function() {
        await varmor.transfer(delegator.getAddress(), voteAmount);
        await varmor.transfer(delegator2.getAddress(), voteAmount);
      });

      describe('Delegation: address(0) -> address(0)', async function() {
        beforeEach(async function() {
          await varmor.connect(delegator).delegate(constants.AddressZero);
        });

        it('Nothing happens', async function() {
          const numVotes = await varmor.getCurrentVotes(delegatee.getAddress());
          const currentDelegatee = await varmor.delegates(delegator.getAddress());
          expect(numVotes).to.equal(0);
          expect(currentDelegatee).to.equal(constants.AddressZero);
        });
      });


      describe('Delegation: address(0) -> delegatee', async function() {
        beforeEach(async function() {
          await varmor.connect(delegator).delegate(delegatee.getAddress());
        });

        it('delegatee Votes changes', async function() {
          const numVotes = await varmor.getCurrentVotes(delegatee.getAddress());
          const currentDelegatee = await varmor.delegates(delegator.getAddress());
          expect(numVotes).to.equal(voteAmount);
          expect(currentDelegatee).to.equal(await delegatee.getAddress());
        });
      });

      describe('Delegation: nonzero delegatee -> new nonzero delegatee', function() {
        beforeEach(async function() {
          await varmor.connect(delegator).delegate(delegatee.getAddress());
          await varmor.connect(delegator).delegate(newDelegatee.getAddress());
        });

        it('delegatee Votes change', async function() {
          const previousDelegateeNumVotes = await varmor.getCurrentVotes(delegatee.getAddress());
          const currentDelegateeNumVotes = await varmor.getCurrentVotes(newDelegatee.getAddress());
          const currentDelegatee = await varmor.delegates(delegator.getAddress());
          expect(previousDelegateeNumVotes).to.equal(0);
          expect(currentDelegateeNumVotes).to.equal(voteAmount);
          expect(currentDelegatee).to.equal(await newDelegatee.getAddress());
        });

      }); // End of 'Delegation: delegatee -> same delegatee'

      describe('Delegation: nonzero delegatee -> address(0)', function() {
        beforeEach(async function() {
          await varmor.connect(delegator).delegate(delegatee.getAddress());
          await varmor.connect(delegator).delegate(constants.AddressZero);
        });

        it('delegatee Votes change', async function() {
          const previousDelegateeNumVotes = await varmor.getCurrentVotes(delegatee.getAddress());
          const currentDelegatee = await varmor.delegates(delegator.getAddress());
          expect(previousDelegateeNumVotes).to.equal(0);
          expect(currentDelegatee).to.equal(constants.AddressZero);
        });
      }); // End of 'Delegation: nonzero delegatee -> address(0)'

      describe('Delegation: multiple delegator set same delegatee', function() {
        beforeEach(async function() {
          await varmor.connect(delegator).delegate(delegatee.getAddress());
          await varmor.connect(delegator2).delegate(delegatee.getAddress());
        });

        it('delegatee Votes change', async function() {
          const delegateeNumVotes = await varmor.getCurrentVotes(delegatee.getAddress());
          expect(delegateeNumVotes).to.equal(voteAmount.mul(2));
        });
      }); // End of 'Delegation: multiple delegator set same delegatee'
    }); // End of #delegate()

    describe('#getPriorVotes()', function() {
      const totalAmount = BigNumber.from('10000');
      const voteAmount = BigNumber.from('10');

      beforeEach(async function() {
        await varmor.transfer(delegator.getAddress(), voteAmount);
        await varmor.transfer(delegator2.getAddress(), voteAmount);
      });

      it('should fail if blockNumber is not finalized', async function() { 
        await expect(
          varmor.getPriorVotes(delegatee.getAddress(), BigNumber.from('10000'))).to.be.revertedWith(
          "vARMOR::getPriorVotes: not yet determined"
        );
      });

      it('should return 0 if account does not have any checkpoint', async function() {
        const numVotes = await varmor.getPriorVotes(delegatee.getAddress(), 0);
        expect(numVotes).to.equal(0);
      });

      describe('valid case - numCheckpoints == 1', function() {
        it('return the appropriate number of votes', async function() {
          const receipt = await varmor.connect(delegator).delegate(delegatee.getAddress());
          const txBlkNum = BigNumber.from(receipt.blockNumber);
          // for delay block Number
          for(let i = 0 ; i < 10 ; i++) {
            await varmor.transfer(others[0].getAddress(), voteAmount);
          }
          const numVotes = await varmor.getPriorVotes(delegatee.getAddress(), txBlkNum.add(1));
          expect(numVotes).to.equal(voteAmount);
        });
      });

      describe('valid case - numCheckpoints > 1', function() {
        it('return the appropriate number of votes', async function() {
          let checkpoints = [];
          let receipt : any;
          let numVotes : BigNumber;

          for(let i = 0 ; i < others.length ; i++) {
            await varmor.transfer(others[i].getAddress(), voteAmount);
          }
          for(let i = 0 ; i < others.length ; i++) {
            receipt = await varmor.connect(others[i]).delegate(delegatee.getAddress());
            checkpoints.push(BigNumber.from(receipt.blockNumber));
            for(let j = 0 ; j < 10 ; j++) {
              await varmor.transfer(delegator.getAddress(), voteAmount);
            }
          }

          for(let i = 0 ; i < checkpoints.length ; i++) {
            let numVotes;
            numVotes = await varmor.getPriorVotes(delegatee.getAddress(), checkpoints[i].sub(1));
            expect(numVotes).to.be.equal(voteAmount.mul(i));
            // The number of votes when checkpoints[i] == blkNum
            numVotes = await varmor.getPriorVotes(delegatee.getAddress(), checkpoints[i]);
            expect(numVotes).to.equal(voteAmount.mul(i+1));
            // The number of votes when checkpoints[i] < blkNum < checkpoints[i+1]
            numVotes = await varmor.getPriorVotes(delegatee.getAddress(), checkpoints[i].add(1));
            expect(numVotes).to.equal(voteAmount.mul(i+1));
          }
        });
      });

    }); // End of #getPriorVotes()
  }); // End of Midas Spec
});
