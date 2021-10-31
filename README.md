# CoinFundChallengeToken1

## Requirements

Develop a smart contract treasury that does the following: 
* Accepts deposits in WETH and USDC 
* Uses ChainLink price oracles to track the value of funds deposited 
* Issues ERC20 token shares proportional to the depositors % share in the pool 

Note: implementing a withdrawal and redemption system and frontend is not required. 

## Notes on implementation

The contract follows the following procedure:

1. the user deposits WETH or USDC ("current deposit")
2. the contract fetches the latest WETH price from Chainlink (it assumes USDC has maintained its peg)
3. the contract adds the current deposit to its runninng tallies of USDC and WETH deposits (these are the raw numbers of tokens deposited, with no adjustment for price)
4. using the prices from step 2, the contract calculates the dollar value of the current deposit
5. using the prices from step 2, the contract recalculates the value of all user deposits (incuding current deposit, due to step 3)
6. the contract calculates the curent deposit's dollar value as a share of the value of all deposits
7. the contract mints tokens representing the result of step 6 and transfers them to the user

Early in the contract's life, this sytem will yield strange results. The first user to interact with the contract deposits 10 WETH and gets 100 CFCT1. (They'd get 100 CFCT1 for depositing any amount.) Assuming no price change, the second user might expect to receive the same payout, 100 tokens, for depositing 10 WETH. Instead, they'll receive 50.

As more deposits are made to the contract, however, this effect dissipates. The nth user who deposits 1000 USDC to a contract holding $1 billion worth of deposits will receive 0.0001 CFCT1. The n+1th user who deposits the same amount will receive a nearly identical payout: 0.0000999999 CFCT1.
