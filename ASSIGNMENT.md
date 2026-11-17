Project: Campus Election

Build a small election with a fixed list of candidates and an administrator-controlled voting period.

Project-specific requirements

The administrator registers candidates and opens or closes voting. Each address votes at most once while

voting is open. Show each candidate and vote total.

Required technology and implementation

1. Write and deploy a Solidity smart contract to a local Ganache blockchain. Use Ganache test accounts and

test Ether only; never use real funds or private keys.

2. Build a simple Web3 interface using HTML/JavaScript and ethers.js or web3.js. Connect a wallet to

Ganache; show the connected account, contract data, transaction status and errors.

3. Enforce the project rules and address-based permissions in the contract, not only in the interface. Emit

events for important state changes and display the resulting state in the interface.

Demonstration and testing

Register two candidates; cast a vote; demonstrate that a second vote from the same address is rejected.

Also demonstrate the workflow using at least two Ganache accounts. Include at least one successful

transaction and one rejected invalid or unauthorized action; explain the result.

Individual submission

Submit your own Solidity and interface source code, any deployment or test scripts, and a short README

with prerequisites, Ganache network settings, deployment and run steps, and test results. Include

screenshots or a short demonstration recording. Cite any external code or assistance used.

Assessment (100 points)

Contract logic and project-specific rules: 35 | Ganache deployment and Web3 interaction: 25 | Interface and

usability: 15 | Tests and demonstration: 15 | README and individual explanation: 1