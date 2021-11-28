// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity 0.6.12;
import './interfaces/IERC20.sol';
import './general/Ownable.sol';

contract Faucet is Ownable {

    IERC20 public token;
    address public vArmor;
    uint256 public rewardsPerSec;
    uint256 public lastDisbursed;

    constructor(
        address _token,
        address _vArmor,
        uint256 _rewardsPerSec
    )
      public
    {
        initializeOwnable();
        token = IERC20(_token);
        vArmor = _vArmor;
        rewardsPerSec = _rewardsPerSec;
        lastDisbursed = block.timestamp;
    }

    function disburse()
      external
    {
        uint256 owed = (block.timestamp - lastDisbursed) * rewardsPerSec;
        token.transfer(vArmor, owed);
        lastDisbursed = block.timestamp;
    }

    function changeRate(
        uint256 _newRate
    )
      external
      onlyOwner
    {
        rewardsPerSec = _newRate;
    }

    function withdraw(
        uint256 _amount
    )
      external
      onlyOwner
    {
        token.transfer(owner(), _amount);
    }

}