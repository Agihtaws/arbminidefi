// Multi-Asset Contract Configuration
export const MULTI_ASSET_CONTRACT_ADDRESS = "0xE6525B464f050eE44CaceA7711432E1D1Fc14026";
export const USDC_TOKEN_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

export const MULTI_ASSET_ABI = [
  // Deposit functions
  "function depositEth() external payable",
  "function depositUsdc(uint256 amount) external",
  
  // Withdrawal functions
  "function withdrawEth(uint256 amount) external",
  "function withdrawUsdc(uint256 amount) external",
  
  // Borrowing functions
  "function borrowEth(uint256 borrowAmount, uint8 collateralType, uint256 collateralAmount) external payable",
  "function borrowUsdc(uint256 borrowAmount, uint8 collateralType, uint256 collateralAmount) external payable",
  
  // Repayment functions
  "function repayEth() external payable",
  "function repayUsdc(uint256 amount) external",
  
  // View functions - UPDATED WITH CORRECT SIGNATURES
  "function getMultiAssetLenderInfo(address lenderAddress) external view returns (uint256 ethDepositAmount, uint256 usdcDepositAmount, uint256 ethCurrentInterest, uint256 usdcCurrentInterest, uint256 ethTotalBalance, uint256 usdcTotalBalance)",
  "function getMultiAssetPoolStats() external view returns (uint256 ethTotalLiquidity, uint256 usdcTotalLiquidity, uint256 ethUtilizationRate, uint256 usdcUtilizationRate, uint256 ethLendRate, uint256 usdcLendRate, uint256 ethBorrowRate, uint256 usdcBorrowRate)",
  "function getBorrowerInfo(address borrowerAddress) external view returns (bool hasEthLoan, bool hasUsdcLoan, uint256 ethBorrowAmount, uint256 usdcBorrowAmount, uint256 ethCollateralAmount, uint256 usdcCollateralAmount, uint256 ethTotalOwed, uint256 usdcTotalOwed, uint256 healthFactor)",
  
  // Individual total owed functions
  "function getEthTotalOwed(address borrowerAddress) public view returns (uint256)",
  "function getUsdcTotalOwed(address borrowerAddress) public view returns (uint256)",
  
  // Chainlink Price Functions
  "function getEthPriceUsd() public view returns (uint256)",
  "function getEthValueInUsd(uint256 ethAmount) public view returns (uint256)",
  "function getEthAmountForUsdValue(uint256 usdValue) public view returns (uint256)",
  
  // 🎯 NEW: LIMIT FUNCTIONS
  "function getMaxBorrowableEth(address user) public view returns (uint256)",
  "function getMaxBorrowableUsdc(address user) public view returns (uint256)",
  "function getMaxWithdrawableEth(address user) public view returns (uint256)",
  "function getMaxWithdrawableUsdc(address user) public view returns (uint256)",
  "function getRequiredCollateralForEthBorrow(uint256 borrowAmount, uint8 collateralType) public view returns (uint256)",
  "function getRequiredCollateralForUsdcBorrow(uint256 borrowAmount, uint8 collateralType) public view returns (uint256)",
  "function getUserLimits(address user) external view returns (tuple(uint256 maxBorrowableEth, uint256 maxBorrowableUsdc, uint256 maxWithdrawableEth, uint256 maxWithdrawableUsdc, uint256 requiredEthCollateralForEthBorrow, uint256 requiredUsdcCollateralForEthBorrow, uint256 requiredEthCollateralForUsdcBorrow, uint256 requiredUsdcCollateralForUsdcBorrow, bool canBorrowEth, bool canBorrowUsdc, bool hasActiveLoans))",
  "function canBorrow(address user, uint256 amount, uint8 assetType, uint8 collateralType, uint256 collateralAmount) external view returns (bool canBorrow, string memory reason)",
  "function canWithdraw(address user, uint256 amount, uint8 assetType) external view returns (bool canWithdraw, string memory reason)",
  
  // Public mappings
  "function lenders(address) external view returns (uint256 ethDepositAmount, uint256 usdcDepositAmount, uint256 ethAccruedInterest, uint256 usdcAccruedInterest, uint256 ethLastInterestUpdate, uint256 usdcLastInterestUpdate, uint256 depositTimestamp)",
  "function borrowers(address) external view returns (uint256 ethBorrowAmount, uint256 usdcBorrowAmount, uint256 ethCollateralAmount, uint256 usdcCollateralAmount, uint256 ethLastInterestUpdate, uint256 usdcLastInterestUpdate, uint256 borrowTimestamp, bool hasEthLoan, bool hasUsdcLoan)",
  
  // Token reference
  "function usdcToken() external view returns (address)",
  
  // Constants
  "function ETH_LEND_RATE() external view returns (uint256)",
  "function ETH_BORROW_RATE() external view returns (uint256)",
  "function USDC_LEND_RATE() external view returns (uint256)",
  "function USDC_BORROW_RATE() external view returns (uint256)",
  "function COLLATERAL_RATIO() external view returns (uint256)",
  "function LIQUIDATION_THRESHOLD() external view returns (uint256)",
  "function RATE_PRECISION() external view returns (uint256)",
  "function SECONDS_PER_YEAR() external view returns (uint256)",
  "function PRICE_FEED_DECIMALS() external view returns (uint256)",
  "function USDC_DECIMALS() external view returns (uint256)",
  "function ETH_DECIMALS() external view returns (uint256)",
  "function PRICE_STALENESS_THRESHOLD() external view returns (uint256)",
  
  // Pool stats
  "function totalEthDeposits() external view returns (uint256)",
  "function totalUsdcDeposits() external view returns (uint256)",
  "function totalEthBorrowed() external view returns (uint256)",
  "function totalUsdcBorrowed() external view returns (uint256)",
  "function totalEthCollateral() external view returns (uint256)",
  "function totalUsdcCollateral() external view returns (uint256)",
  
  // Admin functions
  "function updatePriceFeed(address newPriceFeed) external",
  "function owner() external view returns (address)",
  "function paused() external view returns (bool)"
];

export const USDC_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

export const ARBITRUM_SEPOLIA = {
  chainId: '0x66eee',
  chainName: 'Arbitrum Sepolia',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
  blockExplorerUrls: ['https://sepolia.arbiscan.io/'],
};

export const AssetType = {
  ETH: 0,
  USDC: 1
} as const;

export const RATE_PRECISION = 1000000;

// Chainlink Integration Constants
export const ETH_USD_PRICE_FEED = "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165";
export const PRICE_DECIMALS = 6; // Price feed returns 6 decimals for USDC compatibility

// 🎯 NEW: Limit Function Types for TypeScript
export interface UserLimits {
  maxBorrowableEth: string;
  maxBorrowableUsdc: string;
  maxWithdrawableEth: string;
  maxWithdrawableUsdc: string;
  requiredEthCollateralForEthBorrow: string;
  requiredUsdcCollateralForEthBorrow: string;
  requiredEthCollateralForUsdcBorrow: string;
  requiredUsdcCollateralForUsdcBorrow: string;
  canBorrowEth: boolean;
  canBorrowUsdc: boolean;
  hasActiveLoans: boolean;
}

export interface ValidationResult {
  canPerform: boolean;
  reason: string;
}
