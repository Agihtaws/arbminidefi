// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract MultiAssetLendingPool is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;
    
    enum AssetType { ETH, USDC }
    
    struct LenderInfo {
        uint256 ethDepositAmount;
        uint256 usdcDepositAmount;
        uint256 ethAccruedInterest;
        uint256 usdcAccruedInterest;
        uint256 ethLastInterestUpdate;
        uint256 usdcLastInterestUpdate;
        uint256 depositTimestamp;
    }
    
    struct BorrowerInfo {
        uint256 ethBorrowAmount;
        uint256 usdcBorrowAmount;
        uint256 ethCollateralAmount;
        uint256 usdcCollateralAmount;
        uint256 ethLastInterestUpdate;
        uint256 usdcLastInterestUpdate;
        uint256 borrowTimestamp;
        bool hasEthLoan;
        bool hasUsdcLoan;
    }

    // NEW: Struct for limit information
    struct LimitInfo {
        uint256 maxBorrowableEth;
        uint256 maxBorrowableUsdc;
        uint256 maxWithdrawableEth;
        uint256 maxWithdrawableUsdc;
        uint256 requiredEthCollateralForEthBorrow;
        uint256 requiredUsdcCollateralForEthBorrow;
        uint256 requiredEthCollateralForUsdcBorrow;
        uint256 requiredUsdcCollateralForUsdcBorrow;
        bool canBorrowEth;
        bool canBorrowUsdc;
        bool hasActiveLoans;
    }
    
    mapping(address => LenderInfo) public lenders;
    mapping(address => BorrowerInfo) public borrowers;
    
    // Pool statistics for each asset
    uint256 public totalEthDeposits;
    uint256 public totalUsdcDeposits;
    uint256 public totalEthBorrowed;
    uint256 public totalUsdcBorrowed;
    uint256 public totalEthCollateral;
    uint256 public totalUsdcCollateral;
    
    // USDC token contract
    IERC20 public immutable usdcToken;
    
    // Chainlink Price Feed
    AggregatorV3Interface internal ethUsdPriceFeed;
    
    // Interest rates for each asset
    uint256 public constant ETH_LEND_RATE = 50000; // 5% APY
    uint256 public constant ETH_BORROW_RATE = 80000; // 8% APY
    uint256 public constant USDC_LEND_RATE = 40000; // 4% APY (lower due to stability)
    uint256 public constant USDC_BORROW_RATE = 60000; // 6% APY
    
    uint256 public constant COLLATERAL_RATIO = 1500000; // 150%
    uint256 public constant LIQUIDATION_THRESHOLD = 1200000; // 120%
    uint256 public constant RATE_PRECISION = 1000000;
    uint256 public constant SECONDS_PER_YEAR = 31536000;
    uint256 public constant PRICE_FEED_DECIMALS = 8; // Chainlink ETH/USD has 8 decimals
    uint256 public constant USDC_DECIMALS = 6;
    uint256 public constant ETH_DECIMALS = 18;
    
    // Price staleness threshold (24 hours)
    uint256 public constant PRICE_STALENESS_THRESHOLD = 86400;
    
    // Events for multi-asset operations
    event EthDeposited(address indexed lender, uint256 amount);
    event UsdcDeposited(address indexed lender, uint256 amount);
    event EthWithdrawn(address indexed lender, uint256 amount, uint256 interest);
    event UsdcWithdrawn(address indexed lender, uint256 amount, uint256 interest);
    event EthBorrowed(address indexed borrower, uint256 borrowAmount, uint256 collateralAmount, AssetType collateralType);
    event UsdcBorrowed(address indexed borrower, uint256 borrowAmount, uint256 collateralAmount, AssetType collateralType);
    event EthRepaid(address indexed borrower, uint256 repayAmount, uint256 interest);
    event UsdcRepaid(address indexed borrower, uint256 repayAmount, uint256 interest);
    event Liquidated(address indexed borrower, address indexed liquidator, uint256 collateralSeized, AssetType assetType);
    event PriceFeedUpdated(address indexed newPriceFeed);
    
    constructor(address _usdcTokenAddress, address _ethUsdPriceFeed) {
        usdcToken = IERC20(_usdcTokenAddress);
        ethUsdPriceFeed = AggregatorV3Interface(_ethUsdPriceFeed);
    }
    
    // Get current ETH price in USD with 6 decimals (to match USDC)
    function getEthPriceUsd() public view returns (uint256) {
        (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = ethUsdPriceFeed.latestRoundData();
        
        require(price > 0, "Invalid price from oracle");
        require(updatedAt > 0, "Price data not available");
        require(block.timestamp - updatedAt <= PRICE_STALENESS_THRESHOLD, "Price data is stale");
        require(answeredInRound >= roundId, "Price data is stale");
        
        // Convert from 8 decimals to 6 decimals (USDC format)
        return uint256(price) / 100; // 8 decimals to 6 decimals
    }
    
    // Calculate USD value of ETH amount (returns value with 6 decimals)
    function getEthValueInUsd(uint256 ethAmount) public view returns (uint256) {
        uint256 ethPrice = getEthPriceUsd(); // 6 decimals
        return (ethAmount * ethPrice) / 1e18;
    }
    
    // Calculate ETH amount needed for USD value (returns ETH amount with 18 decimals)
    function getEthAmountForUsdValue(uint256 usdValue) public view returns (uint256) {
        uint256 ethPrice = getEthPriceUsd(); // 6 decimals
        return (usdValue * 1e18) / ethPrice;
    }

    // ========================================
    // NEW: COMPREHENSIVE LIMIT FUNCTIONS
    // ========================================

    // Get maximum borrowable ETH amount for a user
    function getMaxBorrowableEth(address user) public view returns (uint256) {
        BorrowerInfo storage borrower = borrowers[user];
        
        // Can't borrow if already has ETH loan
        if (borrower.hasEthLoan) return 0;
        
        // Pool liquidity limit
        uint256 poolLimit = address(this).balance;
        
        // Lending capacity limit
        uint256 capacityLimit = totalEthDeposits > totalEthBorrowed ? 
            totalEthDeposits - totalEthBorrowed : 0;
        
        // Take minimum of pool and capacity limits
        return poolLimit < capacityLimit ? poolLimit : capacityLimit;
    }

    // Get maximum borrowable USDC amount for a user
    function getMaxBorrowableUsdc(address user) public view returns (uint256) {
        BorrowerInfo storage borrower = borrowers[user];
        
        // Can't borrow if already has USDC loan
        if (borrower.hasUsdcLoan) return 0;
        
        // Pool liquidity limit
        uint256 poolLimit = usdcToken.balanceOf(address(this));
        
        // Lending capacity limit
        uint256 capacityLimit = totalUsdcDeposits > totalUsdcBorrowed ? 
            totalUsdcDeposits - totalUsdcBorrowed : 0;
        
        // Take minimum of pool and capacity limits
        return poolLimit < capacityLimit ? poolLimit : capacityLimit;
    }

    // Get maximum withdrawable ETH amount for a user
    function getMaxWithdrawableEth(address user) public view returns (uint256) {
        LenderInfo storage lender = lenders[user];
        
        if (lender.ethDepositAmount == 0) return 0;
        
        // Calculate current interest
        uint256 timeElapsed = block.timestamp - lender.ethLastInterestUpdate;
        uint256 pendingInterest = (lender.ethDepositAmount * ETH_LEND_RATE * timeElapsed) / 
                                 (RATE_PRECISION * SECONDS_PER_YEAR);
        
        // User's total available balance
        uint256 userBalance = lender.ethDepositAmount + lender.ethAccruedInterest + pendingInterest;
        
        // Pool liquidity limit
        uint256 poolLimit = address(this).balance;
        
        // Solvency limit (can't withdraw more than what would cause insolvency)
        uint256 solvencyLimit = totalEthDeposits > totalEthBorrowed ? 
            totalEthDeposits - totalEthBorrowed : 0;
        
        // Return minimum of all limits
        uint256 maxWithdrawable = userBalance;
        if (poolLimit < maxWithdrawable) maxWithdrawable = poolLimit;
        if (solvencyLimit < maxWithdrawable) maxWithdrawable = solvencyLimit;
        
        return maxWithdrawable;
    }

    // Get maximum withdrawable USDC amount for a user
    function getMaxWithdrawableUsdc(address user) public view returns (uint256) {
        LenderInfo storage lender = lenders[user];
        
        if (lender.usdcDepositAmount == 0) return 0;
        
        // Calculate current interest
        uint256 timeElapsed = block.timestamp - lender.usdcLastInterestUpdate;
        uint256 pendingInterest = (lender.usdcDepositAmount * USDC_LEND_RATE * timeElapsed) / 
                                 (RATE_PRECISION * SECONDS_PER_YEAR);
        
        // User's total available balance
        uint256 userBalance = lender.usdcDepositAmount + lender.usdcAccruedInterest + pendingInterest;
        
        // Pool liquidity limit
        uint256 poolLimit = usdcToken.balanceOf(address(this));
        
        // Solvency limit
        uint256 solvencyLimit = totalUsdcDeposits > totalUsdcBorrowed ? 
            totalUsdcDeposits - totalUsdcBorrowed : 0;
        
        // Return minimum of all limits
        uint256 maxWithdrawable = userBalance;
        if (poolLimit < maxWithdrawable) maxWithdrawable = poolLimit;
        if (solvencyLimit < maxWithdrawable) maxWithdrawable = solvencyLimit;
        
        return maxWithdrawable;
    }

    // Get required collateral for borrowing specific ETH amount
    function getRequiredCollateralForEthBorrow(uint256 borrowAmount, AssetType collateralType) 
        public view returns (uint256) {
        if (borrowAmount == 0) return 0;
        
        uint256 borrowValueUsd = getEthValueInUsd(borrowAmount);
        uint256 requiredCollateralValueUsd = (borrowValueUsd * COLLATERAL_RATIO) / RATE_PRECISION;
        
        if (collateralType == AssetType.ETH) {
            return getEthAmountForUsdValue(requiredCollateralValueUsd);
        } else {
            return requiredCollateralValueUsd; // Already in USDC format
        }
    }

    // Get required collateral for borrowing specific USDC amount
    function getRequiredCollateralForUsdcBorrow(uint256 borrowAmount, AssetType collateralType) 
        public view returns (uint256) {
        if (borrowAmount == 0) return 0;
        
        uint256 requiredCollateralValueUsd = (borrowAmount * COLLATERAL_RATIO) / RATE_PRECISION;
        
        if (collateralType == AssetType.ETH) {
            return getEthAmountForUsdValue(requiredCollateralValueUsd);
        } else {
            return requiredCollateralValueUsd; // Already in USDC format
        }
    }

    // Get comprehensive limit information for a user
    function getUserLimits(address user) external view returns (LimitInfo memory) {
        BorrowerInfo storage borrower = borrowers[user];
        
        LimitInfo memory limits;
        
        // Maximum borrowable amounts
        limits.maxBorrowableEth = getMaxBorrowableEth(user);
        limits.maxBorrowableUsdc = getMaxBorrowableUsdc(user);
        
        // Maximum withdrawable amounts
        limits.maxWithdrawableEth = getMaxWithdrawableEth(user);
        limits.maxWithdrawableUsdc = getMaxWithdrawableUsdc(user);
        
        // Required collateral for borrowing max amounts
        if (limits.maxBorrowableEth > 0) {
            limits.requiredEthCollateralForEthBorrow = getRequiredCollateralForEthBorrow(
                limits.maxBorrowableEth, AssetType.ETH);
            limits.requiredUsdcCollateralForEthBorrow = getRequiredCollateralForEthBorrow(
                limits.maxBorrowableEth, AssetType.USDC);
        }
        
        if (limits.maxBorrowableUsdc > 0) {
            limits.requiredEthCollateralForUsdcBorrow = getRequiredCollateralForUsdcBorrow(
                limits.maxBorrowableUsdc, AssetType.ETH);
            limits.requiredUsdcCollateralForUsdcBorrow = getRequiredCollateralForUsdcBorrow(
                limits.maxBorrowableUsdc, AssetType.USDC);
        }
        
        // Borrowing capability flags
        limits.canBorrowEth = !borrower.hasEthLoan && limits.maxBorrowableEth > 0;
        limits.canBorrowUsdc = !borrower.hasUsdcLoan && limits.maxBorrowableUsdc > 0;
        limits.hasActiveLoans = borrower.hasEthLoan || borrower.hasUsdcLoan;
        
        return limits;
    }

    // Check if a specific borrow amount is valid
    function canBorrow(address user, uint256 amount, AssetType assetType, AssetType collateralType, uint256 collateralAmount) 
        external view returns (bool canBorrow, string memory reason) {
        
        BorrowerInfo storage borrower = borrowers[user];
        
        if (assetType == AssetType.ETH) {
            if (borrower.hasEthLoan) return (false, "Active ETH loan exists");
            if (amount > getMaxBorrowableEth(user)) return (false, "Exceeds maximum borrowable ETH");
            
            uint256 requiredCollateral = getRequiredCollateralForEthBorrow(amount, collateralType);
            if (collateralAmount < requiredCollateral) return (false, "Insufficient collateral provided");
            
        } else {
            if (borrower.hasUsdcLoan) return (false, "Active USDC loan exists");
            if (amount > getMaxBorrowableUsdc(user)) return (false, "Exceeds maximum borrowable USDC");
            
            uint256 requiredCollateral = getRequiredCollateralForUsdcBorrow(amount, collateralType);
            if (collateralAmount < requiredCollateral) return (false, "Insufficient collateral provided");
        }
        
        return (true, "");
    }

    // Check if a specific withdrawal amount is valid
    function canWithdraw(address user, uint256 amount, AssetType assetType) 
        external view returns (bool canWithdraw, string memory reason) {
        
        if (assetType == AssetType.ETH) {
            uint256 maxWithdrawable = getMaxWithdrawableEth(user);
            if (amount > maxWithdrawable) return (false, "Exceeds maximum withdrawable ETH");
        } else {
            uint256 maxWithdrawable = getMaxWithdrawableUsdc(user);
            if (amount > maxWithdrawable) return (false, "Exceeds maximum withdrawable USDC");
        }
        
        return (true, "");
    }

    // ========================================
    // EXISTING FUNCTIONS (unchanged)
    // ========================================
    
    // ETH Deposit Function
    function depositEth() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        
        LenderInfo storage lender = lenders[msg.sender];
        
        if (lender.ethDepositAmount > 0) {
            _updateEthLenderInterest(msg.sender);
        } else {
            lender.ethLastInterestUpdate = block.timestamp;
        }
        
        lender.ethDepositAmount += msg.value;
        lender.depositTimestamp = block.timestamp;
        totalEthDeposits += msg.value;
        
        emit EthDeposited(msg.sender, msg.value);
    }
    
    // USDC Deposit Function
    function depositUsdc(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Deposit amount must be greater than 0");
        
        LenderInfo storage lender = lenders[msg.sender];
        
        if (lender.usdcDepositAmount > 0) {
            _updateUsdcLenderInterest(msg.sender);
        } else {
            lender.usdcLastInterestUpdate = block.timestamp;
        }
        
        lender.usdcDepositAmount += amount;
        lender.depositTimestamp = block.timestamp;
        totalUsdcDeposits += amount;
        
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        
        emit UsdcDeposited(msg.sender, amount);
    }
    
    // ETH Withdrawal Function
    function withdrawEth(uint256 amount) external nonReentrant whenNotPaused {
        LenderInfo storage lender = lenders[msg.sender];
        require(lender.ethDepositAmount > 0, "No ETH deposits found");
        
        _updateEthLenderInterest(msg.sender);
        
        uint256 totalAvailable = lender.ethDepositAmount + lender.ethAccruedInterest;
        require(amount <= totalAvailable, "Insufficient ETH balance");
        require(address(this).balance >= amount, "Insufficient ETH pool liquidity");
        require(totalEthDeposits >= totalEthBorrowed + amount, "Would cause ETH pool insolvency");
        
        if (amount <= lender.ethAccruedInterest) {
            lender.ethAccruedInterest -= amount;
        } else {
            uint256 principalWithdraw = amount - lender.ethAccruedInterest;
            lender.ethAccruedInterest = 0;
            lender.ethDepositAmount -= principalWithdraw;
            totalEthDeposits -= principalWithdraw;
        }
        
        payable(msg.sender).transfer(amount);
        emit EthWithdrawn(msg.sender, amount, lender.ethAccruedInterest);
    }
    
    // USDC Withdrawal Function
    function withdrawUsdc(uint256 amount) external nonReentrant whenNotPaused {
        LenderInfo storage lender = lenders[msg.sender];
        require(lender.usdcDepositAmount > 0, "No USDC deposits found");
        
        _updateUsdcLenderInterest(msg.sender);
        
        uint256 totalAvailable = lender.usdcDepositAmount + lender.usdcAccruedInterest;
        require(amount <= totalAvailable, "Insufficient USDC balance");
        require(usdcToken.balanceOf(address(this)) >= amount, "Insufficient USDC pool liquidity");
        require(totalUsdcDeposits >= totalUsdcBorrowed + amount, "Would cause USDC pool insolvency");
        
        if (amount <= lender.usdcAccruedInterest) {
            lender.usdcAccruedInterest -= amount;
        } else {
            uint256 principalWithdraw = amount - lender.usdcAccruedInterest;
            lender.usdcAccruedInterest = 0;
            lender.usdcDepositAmount -= principalWithdraw;
            totalUsdcDeposits -= principalWithdraw;
        }
        
        usdcToken.safeTransfer(msg.sender, amount);
        emit UsdcWithdrawn(msg.sender, amount, lender.usdcAccruedInterest);
    }
    
    // Borrow ETH with ETH or USDC collateral
    function borrowEth(uint256 borrowAmount, AssetType collateralType, uint256 collateralAmount) 
        external payable nonReentrant whenNotPaused {
        require(borrowAmount > 0, "Borrow amount must be greater than 0");
        
        BorrowerInfo storage borrower = borrowers[msg.sender];
        require(!borrower.hasEthLoan, "Active ETH loan exists");
        
        // Calculate required collateral in USD value
        uint256 borrowValueUsd = getEthValueInUsd(borrowAmount);
        uint256 requiredCollateralValueUsd = (borrowValueUsd * COLLATERAL_RATIO) / RATE_PRECISION;
        
        if (collateralType == AssetType.ETH) {
            uint256 ethCollateralValueUsd = getEthValueInUsd(msg.value);
            require(ethCollateralValueUsd >= requiredCollateralValueUsd, "Insufficient ETH collateral");
            borrower.ethCollateralAmount = msg.value;
            totalEthCollateral += msg.value;
        } else {
            // USDC collateral - collateralAmount is already in USD (6 decimals)
            require(collateralAmount >= requiredCollateralValueUsd, "Insufficient USDC collateral");
            usdcToken.safeTransferFrom(msg.sender, address(this), collateralAmount);
            borrower.usdcCollateralAmount = collateralAmount;
            totalUsdcCollateral += collateralAmount;
        }
        
        require(address(this).balance >= borrowAmount, "Insufficient ETH pool liquidity");
        require(totalEthDeposits >= totalEthBorrowed + borrowAmount, "Exceeds ETH lending capacity");
        
        borrower.ethBorrowAmount = borrowAmount;
        borrower.ethLastInterestUpdate = block.timestamp;
        borrower.borrowTimestamp = block.timestamp;
        borrower.hasEthLoan = true;
        
        totalEthBorrowed += borrowAmount;
        
        payable(msg.sender).transfer(borrowAmount);
        emit EthBorrowed(msg.sender, borrowAmount, 
            collateralType == AssetType.ETH ? msg.value : collateralAmount, collateralType);
    }
    
    // Borrow USDC with ETH or USDC collateral
    function borrowUsdc(uint256 borrowAmount, AssetType collateralType, uint256 collateralAmount) 
        external payable nonReentrant whenNotPaused {
        require(borrowAmount > 0, "Borrow amount must be greater than 0");
        
        BorrowerInfo storage borrower = borrowers[msg.sender];
        require(!borrower.hasUsdcLoan, "Active USDC loan exists");
        
        // borrowAmount is already in USD (6 decimals)
        uint256 requiredCollateralValueUsd = (borrowAmount * COLLATERAL_RATIO) / RATE_PRECISION;
        
        if (collateralType == AssetType.ETH) {
            uint256 ethCollateralValueUsd = getEthValueInUsd(msg.value);
            require(ethCollateralValueUsd >= requiredCollateralValueUsd, "Insufficient ETH collateral");
            borrower.ethCollateralAmount = msg.value;
            totalEthCollateral += msg.value;
        } else {
            require(collateralAmount >= requiredCollateralValueUsd, "Insufficient USDC collateral");
            usdcToken.safeTransferFrom(msg.sender, address(this), collateralAmount);
            borrower.usdcCollateralAmount = collateralAmount;
            totalUsdcCollateral += collateralAmount;
        }
        
        require(usdcToken.balanceOf(address(this)) >= borrowAmount, "Insufficient USDC pool liquidity");
        require(totalUsdcDeposits >= totalUsdcBorrowed + borrowAmount, "Exceeds USDC lending capacity");
        
        borrower.usdcBorrowAmount = borrowAmount;
        borrower.usdcLastInterestUpdate = block.timestamp;
        borrower.borrowTimestamp = block.timestamp;
        borrower.hasUsdcLoan = true;
        
        totalUsdcBorrowed += borrowAmount;
        
        usdcToken.safeTransfer(msg.sender, borrowAmount);
        emit UsdcBorrowed(msg.sender, borrowAmount, 
            collateralType == AssetType.ETH ? msg.value : collateralAmount, collateralType);
    }
    
    // Repay ETH loan
    function repayEth() external payable nonReentrant whenNotPaused {
        BorrowerInfo storage borrower = borrowers[msg.sender];
        require(borrower.hasEthLoan, "No active ETH loan");
        
        _updateEthBorrowerInterest(msg.sender);
        
        uint256 totalOwed = borrower.ethBorrowAmount;
        require(msg.value >= totalOwed, "Insufficient repayment amount");
        
        uint256 excessPayment = msg.value - totalOwed;

        totalEthBorrowed -= (borrower.ethBorrowAmount - (totalOwed - excessPayment));
        totalEthCollateral -= borrower.ethCollateralAmount;
        totalUsdcCollateral -= borrower.usdcCollateralAmount;
        
        uint256 ethCollateralToReturn = borrower.ethCollateralAmount;
        uint256 usdcCollateralToReturn = borrower.usdcCollateralAmount;

        borrower.ethBorrowAmount = 0;
        borrower.ethCollateralAmount = 0;
        borrower.usdcCollateralAmount = 0;
        borrower.hasEthLoan = false;
        
        if (excessPayment > 0) {
            payable(msg.sender).transfer(excessPayment);
        }
        
        if (ethCollateralToReturn > 0) {
            payable(msg.sender).transfer(ethCollateralToReturn);
        }
        if (usdcCollateralToReturn > 0) {
            usdcToken.safeTransfer(msg.sender, usdcCollateralToReturn);
        }
        
        emit EthRepaid(msg.sender, totalOwed, 0);
    }
    
    // Repay USDC loan
    function repayUsdc(uint256 amount) external nonReentrant whenNotPaused {
        BorrowerInfo storage borrower = borrowers[msg.sender];
        require(borrower.hasUsdcLoan, "No active USDC loan");
        
        _updateUsdcBorrowerInterest(msg.sender);
        
        uint256 totalOwed = borrower.usdcBorrowAmount;
        require(amount >= totalOwed, "Insufficient repayment amount");
        
        uint256 excessPayment = amount - totalOwed;

        usdcToken.safeTransferFrom(msg.sender, address(this), totalOwed);
        
        totalUsdcBorrowed -= (borrower.usdcBorrowAmount - (totalOwed - excessPayment));
        totalEthCollateral -= borrower.ethCollateralAmount;
        totalUsdcCollateral -= borrower.usdcCollateralAmount;

        uint256 ethCollateralToReturn = borrower.ethCollateralAmount;
        uint256 usdcCollateralToReturn = borrower.usdcCollateralAmount;
        
        borrower.usdcBorrowAmount = 0;
        borrower.ethCollateralAmount = 0;
        borrower.usdcCollateralAmount = 0;
        borrower.hasUsdcLoan = false;
        
        if (excessPayment > 0) {
            usdcToken.safeTransfer(msg.sender, excessPayment);
        }

        if (ethCollateralToReturn > 0) {
            payable(msg.sender).transfer(ethCollateralToReturn);
        }
        if (usdcCollateralToReturn > 0) {
            usdcToken.safeTransfer(msg.sender, usdcCollateralToReturn);
        }
        
        emit UsdcRepaid(msg.sender, totalOwed, 0);
    }
    
    // Get borrower information with real-time price calculations
    function getBorrowerInfo(address borrowerAddress) external view returns (
        bool hasEthLoan,
        bool hasUsdcLoan,
        uint256 ethBorrowAmount,
        uint256 usdcBorrowAmount,
        uint256 ethCollateralAmount,
        uint256 usdcCollateralAmount,
        uint256 ethTotalOwed,
        uint256 usdcTotalOwed,
        uint256 healthFactor
    ) {
        BorrowerInfo storage borrower = borrowers[borrowerAddress];
        
        uint256 currentEthTotalOwed = getEthTotalOwed(borrowerAddress);
        uint256 currentUsdcTotalOwed = getUsdcTotalOwed(borrowerAddress);

        // Calculate health factor using real-time prices
        uint256 currentHealthFactor = 0;
        if (borrower.ethCollateralAmount > 0 || borrower.usdcCollateralAmount > 0) {
            // Convert all values to USD (6 decimals)
            uint256 ethCollateralValueUsd = getEthValueInUsd(borrower.ethCollateralAmount);
            uint256 totalCollateralValueUsd = ethCollateralValueUsd + borrower.usdcCollateralAmount;
            
            uint256 ethBorrowedValueUsd = getEthValueInUsd(currentEthTotalOwed);
            uint256 totalBorrowedValueUsd = ethBorrowedValueUsd + currentUsdcTotalOwed;

                        if (totalBorrowedValueUsd > 0) {
                currentHealthFactor = (totalCollateralValueUsd * RATE_PRECISION) / totalBorrowedValueUsd;
            } else {
                currentHealthFactor = type(uint256).max;
            }
        } else if (currentEthTotalOwed == 0 && currentUsdcTotalOwed == 0) {
            currentHealthFactor = type(uint256).max;
        }

        return (
            borrower.hasEthLoan,
            borrower.hasUsdcLoan,
            borrower.ethBorrowAmount,
            borrower.usdcBorrowAmount,
            borrower.ethCollateralAmount,
            borrower.usdcCollateralAmount,
            currentEthTotalOwed,
            currentUsdcTotalOwed,
            currentHealthFactor
        );
    }

    // Get total ETH owed (principal + accrued interest)
    function getEthTotalOwed(address borrowerAddress) public view returns (uint256) {
        BorrowerInfo storage borrower = borrowers[borrowerAddress];
        if (!borrower.hasEthLoan) return 0;

        uint256 timeElapsed = block.timestamp - borrower.ethLastInterestUpdate;
        uint256 interest = (borrower.ethBorrowAmount * ETH_BORROW_RATE * timeElapsed) / 
                          (RATE_PRECISION * SECONDS_PER_YEAR);
        return borrower.ethBorrowAmount + interest;
    }

    // Get total USDC owed (principal + accrued interest)
    function getUsdcTotalOwed(address borrowerAddress) public view returns (uint256) {
        BorrowerInfo storage borrower = borrowers[borrowerAddress];
        if (!borrower.hasUsdcLoan) return 0;

        uint256 timeElapsed = block.timestamp - borrower.usdcLastInterestUpdate;
        uint256 interest = (borrower.usdcBorrowAmount * USDC_BORROW_RATE * timeElapsed) / 
                          (RATE_PRECISION * SECONDS_PER_YEAR);
        return borrower.usdcBorrowAmount + interest;
    }
    
    // Interest calculation functions for each asset
    function _updateEthLenderInterest(address lenderAddress) internal {
        LenderInfo storage lender = lenders[lenderAddress];
        if (lender.ethDepositAmount > 0) {
            uint256 timeElapsed = block.timestamp - lender.ethLastInterestUpdate;
            uint256 interest = (lender.ethDepositAmount * ETH_LEND_RATE * timeElapsed) / 
                              (RATE_PRECISION * SECONDS_PER_YEAR);
            lender.ethAccruedInterest += interest;
            lender.ethLastInterestUpdate = block.timestamp;
        }
    }
    
    function _updateUsdcLenderInterest(address lenderAddress) internal {
        LenderInfo storage lender = lenders[lenderAddress];
        if (lender.usdcDepositAmount > 0) {
            uint256 timeElapsed = block.timestamp - lender.usdcLastInterestUpdate;
            uint256 interest = (lender.usdcDepositAmount * USDC_LEND_RATE * timeElapsed) / 
                              (RATE_PRECISION * SECONDS_PER_YEAR);
            lender.usdcAccruedInterest += interest;
            lender.usdcLastInterestUpdate = block.timestamp;
        }
    }
    
    function _updateEthBorrowerInterest(address borrowerAddress) internal {
        BorrowerInfo storage borrower = borrowers[borrowerAddress];
        if (borrower.ethBorrowAmount > 0) {
            uint256 timeElapsed = block.timestamp - borrower.ethLastInterestUpdate;
            uint256 interest = (borrower.ethBorrowAmount * ETH_BORROW_RATE * timeElapsed) / 
                              (RATE_PRECISION * SECONDS_PER_YEAR);
            borrower.ethBorrowAmount += interest;
            borrower.ethLastInterestUpdate = block.timestamp;
        }
    }
    
    function _updateUsdcBorrowerInterest(address borrowerAddress) internal {
        BorrowerInfo storage borrower = borrowers[borrowerAddress];
        if (borrower.usdcBorrowAmount > 0) {
            uint256 timeElapsed = block.timestamp - borrower.usdcLastInterestUpdate;
            uint256 interest = (borrower.usdcBorrowAmount * USDC_BORROW_RATE * timeElapsed) / 
                              (RATE_PRECISION * SECONDS_PER_YEAR);
            borrower.usdcBorrowAmount += interest;
            borrower.usdcLastInterestUpdate = block.timestamp;
        }
    }
    
    // View functions for multi-asset information
    function getMultiAssetLenderInfo(address lenderAddress) external view returns (
        uint256 ethDepositAmount,
        uint256 usdcDepositAmount,
        uint256 ethCurrentInterest,
        uint256 usdcCurrentInterest,
        uint256 ethTotalBalance,
        uint256 usdcTotalBalance
    ) {
        LenderInfo storage lender = lenders[lenderAddress];
        
        uint256 ethTimeElapsed = block.timestamp - lender.ethLastInterestUpdate;
        uint256 ethPendingInterest = (lender.ethDepositAmount * ETH_LEND_RATE * ethTimeElapsed) / 
                                    (RATE_PRECISION * SECONDS_PER_YEAR);
        
        uint256 usdcTimeElapsed = block.timestamp - lender.usdcLastInterestUpdate;
        uint256 usdcPendingInterest = (lender.usdcDepositAmount * USDC_LEND_RATE * usdcTimeElapsed) / 
                                     (RATE_PRECISION * SECONDS_PER_YEAR);
        
        ethDepositAmount = lender.ethDepositAmount;
        usdcDepositAmount = lender.usdcDepositAmount;
        ethCurrentInterest = lender.ethAccruedInterest + ethPendingInterest;
        usdcCurrentInterest = lender.usdcAccruedInterest + usdcPendingInterest;
        ethTotalBalance = ethDepositAmount + ethCurrentInterest;
        usdcTotalBalance = usdcDepositAmount + usdcCurrentInterest;
    }
    
    function getMultiAssetPoolStats() external view returns (
        uint256 ethTotalLiquidity,
        uint256 usdcTotalLiquidity,
        uint256 ethUtilizationRate,
        uint256 usdcUtilizationRate,
        uint256 ethLendRate,
        uint256 usdcLendRate,
        uint256 ethBorrowRate,
        uint256 usdcBorrowRate
    ) {
        ethTotalLiquidity = address(this).balance;
        usdcTotalLiquidity = usdcToken.balanceOf(address(this));
        ethUtilizationRate = totalEthDeposits > 0 ? (totalEthBorrowed * RATE_PRECISION) / totalEthDeposits : 0;
        usdcUtilizationRate = totalUsdcDeposits > 0 ? (totalUsdcBorrowed * RATE_PRECISION) / totalUsdcDeposits : 0;
        ethLendRate = ETH_LEND_RATE;
        usdcLendRate = USDC_LEND_RATE;
        ethBorrowRate = ETH_BORROW_RATE;
        usdcBorrowRate = USDC_BORROW_RATE;
    }
    
    // Admin function to update price feed
    function updatePriceFeed(address newPriceFeed) external onlyOwner {
        require(newPriceFeed != address(0), "Invalid price feed address");
        ethUsdPriceFeed = AggregatorV3Interface(newPriceFeed);
        emit PriceFeedUpdated(newPriceFeed);
    }
    
    // Emergency functions
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function emergencyWithdrawEth() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    function emergencyWithdrawUsdc() external onlyOwner {
        usdcToken.safeTransfer(owner(), usdcToken.balanceOf(address(this)));
    }
}
