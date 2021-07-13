import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber, constants } from "ethers";
import { getTimestamp, increase, mine, ether } from "../utils";
import { MAX_INTEGER } from "ethereumjs-util";

describe("vARMOR", () => {
  const TOKEN_NAME = 'Voting Armor Token';
  const TOKEN_SYMBOL = 'vARMOR';
  const DECIMALS = BigNumber.from('18');

  let armor: Contract;
  let varmor: Contract;

  let gov: Signer;
  let user: Signer;
  let delegator: Signer;
  let delegator2: Signer;
  let delegatee: Signer;
  let newDelegatee: Signer;
  let others: Signer[];

  const AMOUNT = ether('1');

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    [gov, user, delegator, delegator2, delegatee, newDelegatee, ...others] = accounts;

    const ARMOR_FACTORY = await ethers.getContractFactory("ERC20Mock");
    const VARMOR_FACTORY = await ethers.getContractFactory("vARMOR");
    const TOKEN_HELPER = await ethers.getContractFactory("TokenHelper");

    armor = await ARMOR_FACTORY.deploy();
    varmor = await VARMOR_FACTORY.deploy(armor.address, gov.getAddress());
    const helper = await TOKEN_HELPER.deploy();

    await armor.transfer(user.getAddress(), AMOUNT);

    // for cov
    await varmor.connect(gov).addTokenHelper(helper.address);
    await varmor.connect(gov).removeTokenHelper(0);
    await varmor.connect(gov).transferGov(await others[0].getAddress());
    await varmor.connect(others[0]).transferGov(await gov.getAddress());

    await armor.transfer(varmor.address, AMOUNT);
    await varmor.connect(gov).slash(AMOUNT);
  });

  describe('#constructor()', () => {
    it('token name set properly', async () => {
      const res = await varmor.name();
      expect(res).to.equal(TOKEN_NAME);
    });

    it('token symbol set properly', async () => {
      const res = await varmor.symbol();
      expect(res).to.equal(TOKEN_SYMBOL);
    });

    it('token decimals set properly', async () => {
      const res = await varmor.decimals();
      expect(res).to.equal(DECIMALS);
    });

    it('armor address set properly', async () => {
      const res = await varmor.armor();
      expect(res).to.equal(armor.address);
    });

    it('governance address set properly', async () => {
      const res = await varmor.governance();
      expect(res).to.equal(await gov.getAddress());
    });
  });

  describe('#deposit()', () => {
    it('should fail if msg.sender does not approve vARMOR', async () => {
      const shouldFail = varmor.connect(user).deposit(AMOUNT);
      await expect(shouldFail).to.be.reverted;
    });

    it('should fail if msg.sender does not have enoungh ARMOR', async () => {
      await armor.connect(user).approve(varmor.address, AMOUNT);
      const shouldFail = varmor.connect(user).deposit(AMOUNT.mul(2));
      await expect(shouldFail).to.be.reverted;
    });

    describe('when succeed', () => {
      beforeEach(async () => {
        await armor.connect(user).approve(varmor.address, AMOUNT);
      });

      describe('totalSupply.add(pending) == 0', () => {
        // armorToVArmor(_amount) == _amount
        beforeEach(async () => {
          await varmor.connect(user).deposit(AMOUNT);
        });

        it('totalSupply should increase', async () => {
          const res = await varmor.totalSupply();
          expect(res).to.equal(AMOUNT);
        });

        it("user's vARMOR should increase", async () => {
          const res = await varmor.balanceOf(await user.getAddress());
          expect(res).to.equal(AMOUNT);
        }); 
      }); // totalSupply.add(pending) == 0

      describe('totalSupply != 0', () => {
        beforeEach(async () => {
          await varmor.connect(user).deposit(AMOUNT);
          await armor.transfer(await user.getAddress(), AMOUNT);
          await armor.connect(user).approve(varmor.address, AMOUNT);
        });

        it('pre-condition check', async () => {
          const res = await varmor.totalSupply();
          expect(res).to.equal(AMOUNT);
        });

        describe('process', () => {
          beforeEach(async () => {
            await varmor.connect(user).deposit(AMOUNT);
          });

          it('totalSupply should increase', async () => {
            const res = await varmor.totalSupply();
            expect(res).to.equal(AMOUNT.mul(2));
          });

          it("user's vARMOR should increase", async () => {
            const res = await varmor.balanceOf(await user.getAddress());
            expect(res).to.equal(AMOUNT.mul(2));
          }); 
        });
      }); // totalSupply != 0

      describe('vARMOR totalSupply != armor.balanceOf(vARMOR)', () => {
        beforeEach(async () => {
          await varmor.connect(user).deposit(AMOUNT);
          await armor.transfer(await user.getAddress(), AMOUNT.mul(2));
          await armor.connect(user).transfer(varmor.address, AMOUNT);
          await armor.connect(user).approve(varmor.address, AMOUNT);
        });

        // varmor totalSupply = AMOUNT
        // armor.balanceOf(vARMOR) = AMOUNT * 2
        // varmor.balanceOf(user) = AMOUNT
        it('pre-condition check', async () => {
          const res = await varmor.totalSupply();
          expect(res).to.equal(AMOUNT);
          const res2 = await armor.balanceOf(varmor.address);
          expect(res2).to.equal(AMOUNT.mul(2));
          const res3 = await varmor.balanceOf(await user.getAddress());
          expect(res3).to.equal(AMOUNT);
        });

        describe('process', () => {
          beforeEach(async () => {
            await varmor.connect(user).deposit(AMOUNT);
          });

          it('vARMOR totalSupply should increase', async () => {
            const res = await varmor.totalSupply();
            expect(res).to.equal(AMOUNT.mul(3).div(2));
          });

          it("user's vARMOR balance should increase", async () => {
            const res = await varmor.balanceOf(await user.getAddress());
            expect(res).to.equal(AMOUNT.mul(3).div(2));
          }); 
        });
      }); // totalSupply != armor.balanceOf(vARMOR)
    });
  });

  describe('#requestWithdrawal()', () => {
    beforeEach(async () => {
      await armor.connect(user).approve(varmor.address, AMOUNT.mul(2));
      await varmor.connect(user).deposit(AMOUNT)
    });

    describe("process", () => {
      beforeEach( async () => {
        await varmor.connect(user).requestWithdrawal(AMOUNT);
      });

      it("totalSupply should decrease", async () => {
        const res = await varmor.totalSupply();
        expect(res).to.equal(0);
      });

      it("user's varmor should decrease(burn)", async () => {
        const res = await varmor.balanceOf(await user.getAddress());
        expect(res).to.equal(0);
      });

      it("user's armor does not change before finalize", async () => {
        const res = await armor.balanceOf(await user.getAddress());
        expect(res).to.equal(0);
      });

      it("pending varmor should increase", async function(){
        const res = await varmor.pending();
        expect(res).to.equal(AMOUNT);
      });
    
      it("vArmorToArmor should be AMOUNT", async function(){
        expect(await varmor.vArmorToArmor(AMOUNT)).to.equal(AMOUNT);
      });

      it("should finalize correctly", async function(){
        await increase(1000000);
        await varmor.connect(user).finalizeWithdrawal();
        expect(await varmor.pending()).to.equal(0);
        expect(await armor.balanceOf(user.getAddress())).to.equal(AMOUNT);
        expect(await varmor.totalSupply()).to.equal(0);
      });
    });
  }); // #requestWithdrawal()

  describe('#finalizeWithdrawal()', () => {
    beforeEach(async () => {
      await armor.connect(user).approve(varmor.address, AMOUNT.mul(2));
      await varmor.connect(user).deposit(AMOUNT);
      await varmor.connect(gov).changeDelay(BigNumber.from(1000));
      await varmor.connect(user).requestWithdrawal(AMOUNT);
    });

    it('should fail if no withdrawal request', async () => {
      const shouldFail = varmor.finalizeWithdrawal();
      await expect(shouldFail).to.be.revertedWith("Withdrawal may not be completed yet.");
    });

    it('should fail if try to finalize before the withdrawDelay passed', async () => {
      const shouldFail = varmor.connect(user).finalizeWithdrawal();
      await expect(shouldFail).to.be.revertedWith("Withdrawal may not be completed yet.");
    });
    
    describe('valid case', () => {
      beforeEach(async () => {
        await increase(10000);
        await varmor.connect(user).finalizeWithdrawal();
          expect(await varmor.totalSupply()).to.equal(0);
      });

      it('pending varmor should decrease', async () => {
        expect(await varmor.pending()).to.equal(0);
      });

      it("user's armor should increase", async () => {
        const res = await armor.balanceOf(await user.getAddress());
        expect(res).to.equal(AMOUNT);
      });

      it("varmor contract's armor should decrease", async () => {
        const res = await armor.balanceOf(varmor.address);
        expect(res).to.equal(0);
      });
    });
  }); // #finalizeWithdrawal()

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

    describe('#getPriorTotalVotes()', function() {
      const totalAmount = BigNumber.from('10000');
      const voteAmount = BigNumber.from('10');

      beforeEach(async function() {
        await armor.transfer(await user.getAddress(), AMOUNT.mul(4));
        await armor.connect(user).approve(varmor.address, AMOUNT.mul(4));
      });

      it('should fail if blockNumber is not finalized', async function() { 
        await expect(
          varmor.getPriorTotalVotes(BigNumber.from('10000'))).to.be.revertedWith(
          "vARMOR::getPriorTotalVotes: not yet determined"
        );
      });

      it('should return 0 if account does not have any checkpoint', async function() {
        const numVotes = await varmor.getPriorTotalVotes(0);
        expect(numVotes).to.equal(0);
      });

      describe('valid case - numCheckpoints == 1', function() {
        it('return the appropriate number of votes', async function() {
          const receipt = await varmor.connect(user).deposit(AMOUNT);
          const txBlkNum = BigNumber.from(receipt.blockNumber);
          // for delay block Number
          for(let i = 0 ; i < 10 ; i++) {
            await mine();
          }
          const numVotes = await varmor.getPriorTotalVotes(txBlkNum.add(1));
          console.log(numVotes.toString());
          console.log(AMOUNT.toString());
          expect(numVotes).to.equal(AMOUNT.mul(2));
        });
      });

      describe('valid case - numCheckpoints > 1', function() {
        it('return the appropriate number of votes', async function() {
          let checkpoints = [];
          let receipt : any;
          let numVotes : BigNumber;

          await mine();
          await mine();
          await mine();

          for(let i = 0 ; i < 4 ; i++) {
            receipt = await varmor.connect(user).deposit(AMOUNT);
            checkpoints.push(BigNumber.from(receipt.blockNumber));
            for(let j = 0 ; j < 10 ; j++) {
              await mine();
            }
          }

          for(let i = 0 ; i < checkpoints.length ; i++) {
            let numVotes;
            numVotes = await varmor.getPriorTotalVotes(checkpoints[i].sub(1));
            expect(numVotes).to.be.equal(AMOUNT.mul(i+1));
            // The number of votes when checkpoints[i] == blkNum
            numVotes = await varmor.getPriorTotalVotes(checkpoints[i]);
            expect(numVotes).to.equal(AMOUNT.mul(i+2));
            // The number of votes when checkpoints[i] < blkNum < checkpoints[i+1]
            numVotes = await varmor.getPriorTotalVotes(checkpoints[i].add(1));
            expect(numVotes).to.equal(AMOUNT.mul(i+2));
          }
        });
      });
    }); // End of #getPriorVotes()
  }); // End of vARMOR Spec
});
