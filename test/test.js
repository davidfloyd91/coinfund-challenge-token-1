const chai = require("chai");
const BN = require("bn.js");
const bnChai = require("bn-chai");
const { ethers } = require("hardhat");

const daiAbi = require("./abis/dai.json");
const sushiRouterAbi = require("./abis/sushiRouter.json");
const usdcAbi = require("./abis/usdc.json");
const wethAbi = require("./abis/weth.json");

const { expect } = chai;

chai.use(bnChai(BN));

const CHAINLINK_ETH_PRICE_FEED_MAINNET =
  "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
const DAI_MAINNET = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const SUSHI_ROUTER_MAINNET = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
const USDC_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_MAINNET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

describe("CoinFundChallengeToken1", function () {
  let coinFundChallengeToken1;
  let daiContract;
  let owner;
  let sushiRouterContract;
  let usdcContract;
  let wethContract;

  beforeEach(async () => {
    const CoinFundChallengeToken1 = await ethers.getContractFactory(
      "CoinFundChallengeToken1"
    );

    coinFundChallengeToken1 = await CoinFundChallengeToken1.deploy(
      "CoinFundChallengeToken1",
      "CFCT1",
      CHAINLINK_ETH_PRICE_FEED_MAINNET,
      USDC_MAINNET,
      WETH_MAINNET
    );

    decimals = await coinFundChallengeToken1.decimals();

    const [_owner] = await ethers.getSigners();
    owner = _owner;

    daiContract = new ethers.Contract(DAI_MAINNET, daiAbi, owner);
    sushiRouterContract = new ethers.Contract(
      SUSHI_ROUTER_MAINNET,
      sushiRouterAbi,
      owner
    );
    usdcContract = new ethers.Contract(USDC_MAINNET, usdcAbi, owner);
    wethContract = new ethers.Contract(WETH_MAINNET, wethAbi, owner);
  });

  it("should accept a usdc deposit", async function () {
    // get usdc
    await sushiRouterContract.swapExactETHForTokens(
      1000 * 10 ** 6,
      [WETH_MAINNET, USDC_MAINNET],
      owner.address,
      9666868056,
      { value: ethers.utils.parseEther("20") }
    );
    // approve usdc deposit
    await usdcContract.approve(coinFundChallengeToken1.address, 1000 * 10 ** 6);
    // deposit to contract
    await coinFundChallengeToken1.depositToken(1000 * 10 ** 6, USDC_MAINNET);
    // get deposit event
    const tokenDepositedEvents = await coinFundChallengeToken1.queryFilter(
      "TokenDeposited"
    );
    const depositedAsset = tokenDepositedEvents[0].args.asset;

    expect(depositedAsset).to.equal(USDC_MAINNET);
  });

  it("should accept a weth deposit", async function () {
    // wrap eth
    await wethContract.deposit({ value: ethers.utils.parseEther("20") });
    // approve weth
    await wethContract.approve(
      coinFundChallengeToken1.address,
      ethers.utils.parseEther("10")
    );
    // deposit to contract
    await coinFundChallengeToken1.depositToken(
      ethers.utils.parseEther("10"),
      WETH_MAINNET
    );
    // get deposit event
    const tokenDepositedEvents = await coinFundChallengeToken1.queryFilter(
      "TokenDeposited"
    );
    const depositedAsset = tokenDepositedEvents[0].args.asset;

    expect(depositedAsset).to.equal(WETH_MAINNET);
  });

  it("should refuse other token deposits", async function () {
    // get dai
    await sushiRouterContract.swapExactETHForTokens(
      ethers.utils.parseEther("1000"),
      [WETH_MAINNET, DAI_MAINNET],
      owner.address,
      9666868056,
      { value: ethers.utils.parseEther("20") }
    );
    // approve dai
    await daiContract.approve(
      coinFundChallengeToken1.address,
      ethers.utils.parseEther("1000")
    );
    // depositing to contract should fail
    await await expect(
      coinFundChallengeToken1.depositToken(
        ethers.utils.parseEther("1000"),
        DAI_MAINNET
      )
    ).to.be.revertedWith("can only accept weth and usdc");
  });

  it("should issue treasury tokens in proportion to deposit", async function () {
    /* FIRST DEPOSIT */
    // wrap a bunch of eth
    await wethContract.deposit({ value: ethers.utils.parseEther("200") });
    // approve eth
    await wethContract.approve(
      coinFundChallengeToken1.address,
      ethers.utils.parseEther("200")
    );
    // get initial deposited dollar value of contract ($0)
    const totalDollarValueZero =
      await coinFundChallengeToken1.totalDollarValue();
    expect(totalDollarValueZero).to.equal(0);
    // deposit 10 weth to contract
    await coinFundChallengeToken1.depositToken(
      ethers.utils.parseEther("10"),
      WETH_MAINNET
    );
    // get share token mint amount
    const mintedEventsOne = await coinFundChallengeToken1.queryFilter("Minted");
    const mintedAmountOne = mintedEventsOne[0].args.amount;
    // should be 100% of dollar value => 100 CFCT1 (100e18)
    expect(mintedAmountOne).to.equal(ethers.utils.parseEther("100"));

    /* SECOND DEPOSIT */
    // deposit 10 more weth to contract
    await coinFundChallengeToken1.depositToken(
      ethers.utils.parseEther("10"),
      WETH_MAINNET
    );
    const mintedEventsTwo = await coinFundChallengeToken1.queryFilter("Minted");
    const mintedAmountTwo = mintedEventsTwo[1].args.amount;
    // should receive 50 CFCT1 this time (see readme)
    expect(mintedAmountTwo).to.equal(ethers.utils.parseEther("50"));

    /* THIRD DEPOSIT */
    // get, deposit usdc (20 eth worth)
    await sushiRouterContract.swapExactETHForTokens(
      1 * 10 ** 6,
      [WETH_MAINNET, USDC_MAINNET],
      owner.address,
      9666868056,
      { value: ethers.utils.parseEther("20") }
    );
    const usdcBalance = await usdcContract.balanceOf(owner.address);
    await usdcContract.approve(coinFundChallengeToken1.address, usdcBalance);
    await coinFundChallengeToken1.depositToken(usdcBalance, USDC_MAINNET);
    const mintedEventsThree = await coinFundChallengeToken1.queryFilter(
      "Minted"
    );
    const mintedAmountThree = mintedEventsThree[1].args.amount;
    // deposit is 50% of total dollar value -- should get 50 CFCT1
    expect(mintedAmountThree).to.equal(ethers.utils.parseEther("50"));
  });
});
