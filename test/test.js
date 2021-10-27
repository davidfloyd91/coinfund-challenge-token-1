const chai = require("chai");
const { expect } = chai;
const BN = require("bn.js");
const bnChai = require("bn-chai");

chai.use(bnChai(BN));

const { ethers } = require("hardhat");

const usdcAbi = require("./abis/usdc.json");
const daiAbi = require("./abis/dai.json");
const wethAbi = require("./abis/weth.json");
const sushiRouterAbi = require("./abis/sushiRouter.json");

const WETH_MAINNET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const DAI_MAINNET = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const CHAINLINK_ETH_PRICE_FEED_MAINNET =
  "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
const SUSHI_ROUTER_MAINNET = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";

describe("CoinFundChallengeToken1", function () {
  let coinFundChallengeToken1;
  let owner;
  let sushiRouterContract;
  let usdcContract;
  let wethContract;
  let daiContract;

  beforeEach(async () => {
    const CoinFundChallengeToken1 = await ethers.getContractFactory(
      "CoinFundChallengeToken1"
    );
    coinFundChallengeToken1 = await CoinFundChallengeToken1.deploy(
      "CoinFundChallengeToken1",
      "CFCT1",
      WETH_MAINNET,
      USDC_MAINNET,
      CHAINLINK_ETH_PRICE_FEED_MAINNET
    );
    decimals = await coinFundChallengeToken1.decimals();
    const [_owner] = await ethers.getSigners();
    owner = _owner;
    usdcContract = new ethers.Contract(USDC_MAINNET, usdcAbi, owner);
    sushiRouterContract = new ethers.Contract(
      SUSHI_ROUTER_MAINNET,
      sushiRouterAbi,
      owner
    );
    wethContract = new ethers.Contract(WETH_MAINNET, wethAbi, owner);
    daiContract = new ethers.Contract(DAI_MAINNET, daiAbi, owner);
  });

  it("should accept a usdc deposit", async function () {
    await sushiRouterContract.swapExactETHForTokens(
      1000 * 10 ** 6,
      [WETH_MAINNET, USDC_MAINNET],
      owner.address,
      9666868056,
      { value: ethers.utils.parseEther("20") }
    );
    await usdcContract.approve(coinFundChallengeToken1.address, 1000 * 10 ** 6);
    await coinFundChallengeToken1.depositToken(1000 * 10 ** 6, USDC_MAINNET);
    const tokenDepositedEvents = await coinFundChallengeToken1.queryFilter(
      "TokenDeposited"
    );
    const depositedAsset = tokenDepositedEvents[0].args.asset;
    expect(depositedAsset).to.equal(USDC_MAINNET);
  });

  it("should accept a weth deposit", async function () {
    await wethContract.deposit({ value: ethers.utils.parseEther("20") });
    await wethContract.approve(
      coinFundChallengeToken1.address,
      ethers.utils.parseEther("10")
    );
    await coinFundChallengeToken1.depositToken(
      ethers.utils.parseEther("10"),
      WETH_MAINNET
    );
    const tokenDepositedEvents = await coinFundChallengeToken1.queryFilter(
      "TokenDeposited"
    );
    const depositedAsset = tokenDepositedEvents[0].args.asset;
    expect(depositedAsset).to.equal(WETH_MAINNET);
  });

  it("should refuse other token deposits", async function () {
    await sushiRouterContract.swapExactETHForTokens(
      ethers.utils.parseEther("1000"),
      [WETH_MAINNET, DAI_MAINNET],
      owner.address,
      9666868056,
      { value: ethers.utils.parseEther("20") }
    );
    await daiContract.approve(
      coinFundChallengeToken1.address,
      ethers.utils.parseEther("1000")
    );
    await await expect(
      coinFundChallengeToken1.depositToken(
        ethers.utils.parseEther("1000"),
        DAI_MAINNET
      )
    ).to.be.revertedWith("can only accept weth and usdc");
  });

  it("should issue treasury tokens in proportion to deposit", async function () {
    await wethContract.deposit({ value: ethers.utils.parseEther("200") });
    await wethContract.approve(
      coinFundChallengeToken1.address,
      ethers.utils.parseEther("200")
    );
    const totalDollarValueZero =
      await coinFundChallengeToken1.totalDollarValue();
    expect(totalDollarValueZero).to.equal(0);
    await coinFundChallengeToken1.depositToken(
      ethers.utils.parseEther("10"),
      WETH_MAINNET
    );
    const mintedEventsOne = await coinFundChallengeToken1.queryFilter("Minted");
    const mintedAmountOne = mintedEventsOne[0].args.amount;
    expect(mintedAmountOne).to.equal(ethers.utils.parseEther("1"));
    await coinFundChallengeToken1.depositToken(
      ethers.utils.parseEther("10"),
      WETH_MAINNET
    );
    const mintedEventsTwo = await coinFundChallengeToken1.queryFilter("Minted");
    const mintedAmountTwo = mintedEventsTwo[1].args.amount;
    expect(mintedAmountTwo).to.equal(ethers.utils.parseEther("0.5"));
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
    expect(mintedAmountThree).to.equal(ethers.utils.parseEther("0.5"));
  });
});
