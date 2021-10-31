// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./interfaces/AggregatorV3Interface.sol";

contract CoinFundChallengeToken1 is ERC20 {
    using SafeMath for uint256;

    address public chainlinkEthPriceFeed;
    address public usdc;
    address public weth;

    uint256 public totalDollarValue = 0;
    uint256 public totalUsdcDeposited = 0;
    uint256 public totalWethDeposited = 0;

    uint256 internal wethPrice;

    uint256 internal USDC_DECIMALS;
    uint256 internal WETH_DECIMALS;

    event Minted(address holder, uint256 amount);
    event TokenDeposited(uint256 amount, address asset);
    event UpdatedTotalDollarValue(uint256 newValue);

    constructor(
        string memory name,
        string memory symbol,
        address _chainlinkEthPriceFeed,
        address _usdc,
        address _weth
    ) ERC20(name, symbol) {
        chainlinkEthPriceFeed = _chainlinkEthPriceFeed;
        usdc = _usdc;
        weth = _weth;

        USDC_DECIMALS = IERC20Metadata(usdc).decimals();
        WETH_DECIMALS = IERC20Metadata(weth).decimals();
    }

    function getWethPrice() internal view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            chainlinkEthPriceFeed
        );
        (, int256 price, , , ) = priceFeed.latestRoundData();

        return uint256(price).mul(10**(uint256(18).sub(priceFeed.decimals())));
    }

    function getWethDepositDollarValue(uint256 amount)
        internal
        view
        returns (uint256)
    {
        uint256 adjustedAmount = amount
            .div(10**(uint256(18).sub(WETH_DECIMALS)))
            .mul(wethPrice);

        return adjustedAmount;
    }

    function getNewTotalDollarValue() internal view returns (uint256) {
        uint256 wethAmount = totalWethDeposited
            .div(10**(uint256(18).sub(WETH_DECIMALS)))
            .mul(wethPrice);

        return wethAmount.add(totalUsdcDeposited);
    }

    function depositToken(uint256 amount, address asset) public {
        require(
            asset == weth || asset == usdc,
            "can only accept weth and usdc"
        );
        bool success = IERC20(asset).transferFrom(
            msg.sender,
            address(this),
            amount
        );
        require(success, "deposit failed");
        emit TokenDeposited(amount, asset);

        wethPrice = getWethPrice();

        uint256 depositDollarValue;
        if (asset == weth) {
            totalWethDeposited = totalWethDeposited.add(amount);
            depositDollarValue = getWethDepositDollarValue(amount);
        } else if (asset == usdc) {
            totalUsdcDeposited = totalUsdcDeposited.add(amount);
            depositDollarValue = amount.mul(10**(18 - USDC_DECIMALS));
        }

        uint256 newTotalDollarValue = getNewTotalDollarValue();
        totalDollarValue = newTotalDollarValue;
        emit UpdatedTotalDollarValue(newTotalDollarValue);

        uint256 depositShareOfTotal = depositDollarValue
            .mul(10**decimals())
            .div(newTotalDollarValue)
            .mul(100);

        _mint(msg.sender, depositShareOfTotal);
        emit Minted(msg.sender, depositShareOfTotal);
    }
}
