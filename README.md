# Armor Governance

Armor governance follows the basic Compound governance structure.
<br><br>
The only major change in governance itself is that an admin may also queue transactions for time lock then execute. The purpose of this is to allow transactions to be executed without needing approval of the DAO, but also ensure admin transactions can be canceled by the DAO if needed. If the admin begins a transaction, the DAO should be able to cancel it within the time lock period, and vice versa. Neither the DAO nor the multisig should have any way to execute a transaction without the other having the chance to stop it from executing.
<br><br>
vARMOR is a token and vault in which not much happens at the moment. It accepts ARMOR tokens, then wraps them with the ability to use the Compound governance scheme. It has a beforeTokenTransfer function that will be used for a rewards system that is not yet implemented. This will likely start with a fairly default SNX contract where staked users receive dripped rewards, but it should be able to be changed at any time to a new rewards system.
