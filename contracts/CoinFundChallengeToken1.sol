// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./interfaces/AggregatorV3Interface.sol";

import "hardhat/console.sol";

contract CoinFundChallengeToken1 is ERC20 {
    using SafeMath for uint256;

    address public weth;
    address public usdc;
    address public chainlinkEthPriceFeed;

    uint256 public totalDollarValue = 0;

    event TokenDeposited(uint256 amount, address asset);
    event UpdatedTotalDollarValue(uint256 newValue);
    event Minted(address holder, uint256 amount);

    constructor(
        string memory name,
        string memory symbol,
        address _weth,
        address _usdc,
        address _chainlinkEthPriceFeed
    ) ERC20(name, symbol) {
        weth = _weth;
        usdc = _usdc;
        chainlinkEthPriceFeed = _chainlinkEthPriceFeed;
    }

    function updateTotalDollarValue(uint256 newTotalDollarValue) internal {
        totalDollarValue = newTotalDollarValue;
    }

    function getDepositDollarValue(
        address asset,
        uint256 amount
    ) internal view returns (uint256) {
        uint256 adjustedAmount;
        uint256 assetDecimals = IERC20Metadata(asset).decimals();

        if (asset == usdc) {
            adjustedAmount = amount.mul(10 ** (uint256(18).sub(assetDecimals)));
        } else if (asset == weth) {
            AggregatorV3Interface priceFeed = AggregatorV3Interface(chainlinkEthPriceFeed);
            (, int price, , ,) = priceFeed.latestRoundData();
            uint256 priceDecimals = priceFeed.decimals();
            uint256 adjustedPrice = uint256(price).mul(10 ** (uint256(18).sub(priceDecimals)));
            adjustedAmount = amount.mul(adjustedPrice).div(10 ** 18).mul(10 ** (uint256(18).sub(assetDecimals)));       
        }

        return adjustedAmount;
    }

    function depositToken(
        uint256 amount,
        address asset
    ) public {
        require(asset == weth || asset == usdc, "can only accept weth and usdc");
        bool success = IERC20(asset).transferFrom(msg.sender, address(this), amount);
        require(success, "deposit failed");
        emit TokenDeposited(amount, asset);

        uint256 depositDollarValue = getDepositDollarValue(asset, amount);
        uint256 newTotalDollarValue = totalDollarValue.add(depositDollarValue);
        updateTotalDollarValue(newTotalDollarValue);
        emit UpdatedTotalDollarValue(newTotalDollarValue);

        uint256 depositShareOfTotal = depositDollarValue.mul(10 ** decimals()).div(newTotalDollarValue);
        _mint(msg.sender, depositShareOfTotal);
        emit Minted(msg.sender, depositShareOfTotal);
    }
}
