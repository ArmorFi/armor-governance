// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity 0.6.12;

import "./interfaces/ITokenHelper.sol";

import "./openzeppelin/token/ERC20/ERC20.sol";

contract vARMOR is ERC20("Voting Armor Token", "vARMOR") {
    using SafeMath for uint256;
    IERC20 public immutable armor;
    address public governance;
    uint48 public withdrawDelay;
    uint256 public pending;
    address[] public tokenHelpers;
    mapping (address => WithdrawRequest) public withdrawRequests;

    struct WithdrawRequest {
        uint208 amount;
        uint48 time;
    }

    constructor(address _armor, address _gov) public {
        armor = IERC20(_armor);
        governance = _gov;
    }

    function addTokenHelper(address _helper) external {
        require(msg.sender == governance, "!gov");
        tokenHelpers.push(_helper);
    }

    function removeTokenHelper(uint256 _idx) external {
        require(msg.sender == governance, "!gov");
        tokenHelpers[_idx] = tokenHelpers[tokenHelpers.length - 1];
        tokenHelpers.pop();
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        _moveDelegates(_delegates[from], _delegates[to], amount);

        for(uint256 i = 0; i<tokenHelpers.length; i++){
            ITokenHelper(tokenHelpers[i]).transferHelper(from, to, amount);
        }
    }

    function slash(uint256 _amount) external {
        require(msg.sender == governance, "!gov");
        armor.transfer(msg.sender, _amount);
    }

    function transferGov(address _newGov) external {
        require(msg.sender == governance, "!gov");
        governance = _newGov;
    }
    
    function changeDelay(uint48 _newDelay) external {
        require(msg.sender == governance, "!gov");
        withdrawDelay = _newDelay;
    }
    
    /// deposit and withdraw functions
    function deposit(uint256 _amount) external {
        uint256 varmor = armorToVArmor(_amount);
        _mint(msg.sender, varmor);
        _moveDelegates(address(0), _delegates[msg.sender], varmor);
        // checkpoint for totalSupply
        _writeCheckpointTotal(totalSupply());
        armor.transferFrom(msg.sender, address(this), _amount);
    }

    /// withdraw share
    function requestWithdrawal(uint256 _amount) external {
        _burn(msg.sender, _amount);
        _moveDelegates(_delegates[msg.sender], address(0), _amount);
        // checkpoint for totalSupply
        _writeCheckpointTotal(totalSupply());
        pending = pending.add(_amount);
        withdrawRequests[msg.sender] = WithdrawRequest(withdrawRequests[msg.sender].amount + uint208(_amount), uint48(block.timestamp));
    }
    
    /// withdraw share
    function finalizeWithdrawal() external {
        WithdrawRequest memory request = withdrawRequests[msg.sender];
        require(request.time > 0 && block.timestamp >= request.time + withdrawDelay, "Withdrawal may not be completed yet.");
        delete withdrawRequests[msg.sender];
        pending = pending.sub(uint256(request.amount));
        armor.transfer( msg.sender, vArmorToArmor(request.amount) );
    }

    function armorToVArmor(uint256 _armor) public view returns(uint256) {
        uint256 _pending = pending;
        if(totalSupply().add(_pending) == 0){
            return _armor;
        }
        return _armor.mul( totalSupply().add(_pending) ).div( armor.balanceOf( address(this) ) );
    }

    function vArmorToArmor(uint256 _varmor) public view returns(uint256) {
        if(armor.balanceOf( address(this) ) == 0){
            return 0;
        }
        return _varmor.mul( armor.balanceOf( address(this) ) ).div( totalSupply().add(pending) );
    }

    /// @notice A record of each accounts delegate
    mapping (address => address) internal _delegates;

    /// @notice A checkpoint for marking number of votes from a given block
    struct Checkpoint {
        uint32 fromBlock;
        uint256 votes;
    }

    /// @notice A record of votes checkpoints for each account, by index
    mapping (address => mapping (uint32 => Checkpoint)) public checkpoints;

    /// @notice The number of checkpoints for each account
    mapping (address => uint32) public numCheckpoints;


    // totalSupply checkpoint
    mapping (uint32 => Checkpoint) public checkpointsTotal;

    uint32 public numCheckpointsTotal;

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /// @notice The EIP-712 typehash for the delegation struct used by the contract
    bytes32 public constant DELEGATION_TYPEHASH = keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    /// @notice A record of states for signing / validating signatures
    mapping (address => uint) public nonces;

    /// @notice An event thats emitted when an account changes its delegate
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);

    /// @notice An event thats emitted when a delegate account's vote balance changes
    event DelegateVotesChanged(address indexed delegate, uint previousBalance, uint newBalance);

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegator The address to get delegatee for
     */
    function delegates(address delegator)
        external
        view
        returns (address)
    {
        return _delegates[delegator];
    }

   /**
    * @notice Delegate votes from `msg.sender` to `delegatee`
    * @param delegatee The address to delegate votes to
    */
    function delegate(address delegatee) external {
        return _delegate(msg.sender, delegatee);
    }

    /**
     * @notice Delegates votes from signatory to `delegatee`
     * @param delegatee The address to delegate votes to
     * @param nonce The contract state required to match the signature
     * @param expiry The time at which to expire the signature
     * @param v The recovery byte of the signature
     * @param r Half of the ECDSA signature pair
     * @param s Half of the ECDSA signature pair
     */
    function delegateBySig(
        address delegatee,
        uint nonce,
        uint expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        external
    {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(name())),
                getChainId(),
                address(this)
            )
        );

        bytes32 structHash = keccak256(
            abi.encode(
                DELEGATION_TYPEHASH,
                delegatee,
                nonce,
                expiry
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
                structHash
            )
        );

        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "vARMOR::delegateBySig: invalid signature");
        require(nonce == nonces[signatory]++, "vARMOR::delegateBySig: invalid nonce");
        require(now <= expiry, "vARMOR::delegateBySig: signature expired");
        return _delegate(signatory, delegatee);
    }

    /**
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account)
        external
        view
        returns (uint256)
    {
        uint32 nCheckpoints = numCheckpoints[account];
        return nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint blockNumber)
        external
        view
        returns (uint256)
    {
        require(blockNumber < block.number, "vARMOR::getPriorVotes: not yet determined");

        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].votes;
    }
    
    function getPriorTotalVotes(uint blockNumber)
        external
        view
        returns (uint256)
    {
        require(blockNumber < block.number, "vARMOR::getPriorTotalVotes: not yet determined");

        uint32 nCheckpoints = numCheckpointsTotal;
        
        // First check most recent balance
        if (checkpointsTotal[nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpointsTotal[nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (checkpointsTotal[0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpointsTotal[center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpointsTotal[lower].votes;
    }

    function _delegate(address delegator, address delegatee)
        internal
    {
        address currentDelegate = _delegates[delegator];
        uint256 delegatorBalance = balanceOf(delegator);
        _delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance);
    }

    function _moveDelegates(address srcRep, address dstRep, uint256 amount) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                // decrease old representative
                uint32 srcRepNum = numCheckpoints[srcRep];
                uint256 srcRepOld = srcRepNum > 0 ? checkpoints[srcRep][srcRepNum - 1].votes : 0;
                uint256 srcRepNew = srcRepOld.sub(amount);
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            } 
            if (dstRep != address(0)) {
                // increase new representative
                uint32 dstRepNum = numCheckpoints[dstRep];
                uint256 dstRepOld = dstRepNum > 0 ? checkpoints[dstRep][dstRepNum - 1].votes : 0;
                uint256 dstRepNew = dstRepOld.add(amount);
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
    }

    function _writeCheckpointTotal(
        uint256 newTotal 
    )
        internal
    {
        uint32 nCheckpoints = numCheckpointsTotal;
        uint32 blockNumber = safe32(block.number, "vARMOR::_writeCheckpoint: block number exceeds 32 bits");

        if (nCheckpoints > 0 && checkpointsTotal[nCheckpoints - 1].fromBlock == blockNumber) {
            checkpointsTotal[nCheckpoints - 1].votes = newTotal;
        } else {
            checkpointsTotal[nCheckpoints] = Checkpoint(blockNumber, newTotal);
            numCheckpointsTotal = nCheckpoints + 1;
        }
    }

    function _writeCheckpoint(
        address delegatee,
        uint32 nCheckpoints,
        uint256 oldVotes,
        uint256 newVotes
    )
        internal
    {
        uint32 blockNumber = safe32(block.number, "vARMOR::_writeCheckpoint: block number exceeds 32 bits");

        if (nCheckpoints > 0 && checkpoints[delegatee][nCheckpoints - 1].fromBlock == blockNumber) {
            checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
        } else {
            checkpoints[delegatee][nCheckpoints] = Checkpoint(blockNumber, newVotes);
            numCheckpoints[delegatee] = nCheckpoints + 1;
        }

        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    function safe32(uint n, string memory errorMessage) internal pure returns (uint32) {
        require(n < 2**32, errorMessage);
        return uint32(n);
    }

    function getChainId() internal pure returns (uint) {
        uint256 chainId;
        assembly { chainId := chainid() }
        return chainId;
    }
}
