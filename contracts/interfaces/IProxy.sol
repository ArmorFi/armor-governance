// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.0;

interface IProxy {
    function upgradeTo(address _template) external;
}
