import { network, ethers } from "hardhat";
import { providers, Contract, Signer, BigNumber, utils } from "ethers";
import { expect } from "chai";
import { increase, impersonate, mine } from './utils';

const vesting = '0xB08fE5DeBb2838d9f4A91132c3a87678007Da9A3';
const multisig = '0x1f28eD9D4792a567DaD779235c2b766Ab84D8E33';
const governance = '0x5aFeDeF1454CDd11d4705c06aa4D66Aa396343f6';
const timelock = '0x5afedef13bd7b3e363db724420d773caa8b88763';
const robert = '0xc93356bdeaf3cea6284a6cc747fa52dd04afb2a8';
const varmor = '0x5afeDef11AA9CD7DaE4023807810d97C20791dEC';

describe.only('fork test - vesting', async function() {
  let msig: Signer;
  let voter: Signer;
  let vest: Contract;
  let token: Contract;
  let gov: Contract;
  let tlock: Contract;
  let voteToken: Contract;
  beforeEach(async function() {
    const accounts = await ethers.getSigners();
    const VestingFactory = await ethers.getContractFactory('Vesting');
    const newTemplate = await VestingFactory.deploy();
    const proxy = await ethers.getContractAt('IProxy', vesting);
    await accounts[0].sendTransaction({
      to: multisig,
      value: BigNumber.from("10000000000000000000")
    });
    await accounts[0].sendTransaction({
      to: robert,
      value: BigNumber.from("10000000000000000000")
    });
    msig = await impersonate(multisig);
    voter = await impersonate(robert);
    vest = await ethers.getContractAt('Vesting', proxy.address);
    token = await ethers.getContractAt('contracts/interfaces/IERC20.sol:IERC20', '0x1337def16f9b486faed0293eb623dc8395dfe46a');
    voteToken = await ethers.getContractAt('vARMOR', varmor);
    gov = await ethers.getContractAt('GovernorAlpha', governance);
    tlock = await ethers.getContractAt('Timelock', timelock);
  });
  

  it('end', async function(){
    await token.connect(msig).approve(varmor, ethers.constants.MaxUint256);
    await voteToken.connect(msig).deposit("40000000000000000000000000");
    await voteToken.connect(msig).delegate(robert);
    await token.connect(msig).transfer(tlock.address, "650000000000000000000000000");
    await gov.connect(voter).propose([token.address],[0],["transfer(address,uint256)"],["0x000000000000000000000000000000000000000000000000000000000000dead000000000000000000000000000000000000000000cecb8f27f4200f3a000000"], "burn");
    await mine();
    await gov.connect(voter).castVote(1,true);
    for(let i = 0; i<17281; i++){
      await mine();
    }
    await gov.connect(voter).queue(1);
    await increase(172800);
    await gov.connect(voter).execute(1);
  });
});
