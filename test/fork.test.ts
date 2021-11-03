import { network, ethers } from "hardhat";
import { providers, Contract, Signer, BigNumber, utils } from "ethers";
import { expect } from "chai";
import { increase, impersonate } from './utils';

const vesting = '0xB08fE5DeBb2838d9f4A91132c3a87678007Da9A3';
const governance = '0x1f28eD9D4792a567DaD779235c2b766Ab84D8E33';

describe.only('fork test - vesting', async function() {
  let gov: Signer;
  let vest: Contract;
  let token: Contract;
  beforeEach(async function() {
    const VestingFactory = await ethers.getContractFactory('Vesting');
    const newTemplate = await VestingFactory.deploy();
    const proxy = await ethers.getContractAt('IProxy', vesting);
    gov = await impersonate(governance);
    await proxy.connect(gov).upgradeTo(newTemplate.address);
    vest = await ethers.getContractAt('Vesting', proxy.address);
    token = await ethers.getContractAt('contracts/interfaces/IERC20.sol:IERC20', '0x1337def16f9b486faed0293eb623dc8395dfe46a');
  });
  

  it('end', async function(){
    {
      const target = '0x5aeee4eada0bdc762ba33f8422f2003d7afe8593';
      const releasable = await vest.released(target);
      const granted = await vest.grantedToken(target);
      const balance = await token.balanceOf(governance);
      await vest.connect(gov).end(target);
      expect(await vest.releasable(target)).to.equal(0);
      expect(await vest.grantedToken(target)).to.equal(0);
      expect(await token.balanceOf(governance)).to.equal(balance.add(granted).add(releasable));
    }
    {
      const target = '0xBd4668408dA346e58b80B765F94AEbbc60E3D8C8';
      const releasable = await vest.released(target);
      const granted = await vest.grantedToken(target);
      const balance = await token.balanceOf(governance);
      await vest.connect(gov).end(target);
      expect(await vest.releasable(target)).to.equal(0);
      expect(await vest.grantedToken(target)).to.equal(0);
      expect(await token.balanceOf(governance)).to.equal(balance.add(granted).add(releasable));
    }
  });
});
