const { ethers } = require('ethers');

const CONTRACT_ADDRESS = "0x7D40D11D1F33175B3Cda01fb54794b1E4B1dA6fC";
const YOUR_ADDRESS = "0xc3950893Ba7E35Ea49a9B60F204DAB4E1aFDA70F";

const ABI = [
  "function getMultiAssetLenderInfo(address lenderAddress) external view returns (uint256 ethDepositAmount, uint256 usdcDepositAmount, uint256 ethCurrentInterest, uint256 usdcCurrentInterest, uint256 ethTotalBalance, uint256 usdcTotalBalance)",
  "function lenders(address) external view returns (uint256 ethDepositAmount, uint256 usdcDepositAmount, uint256 ethAccruedInterest, uint256 usdcAccruedInterest, uint256 ethLastInterestUpdate, uint256 usdcLastInterestUpdate, uint256 depositTimestamp)"
];

async function checkInterest() {
  // Use the older ethers.js syntax
  const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  
  try {
    console.log("Checking interest for address:", YOUR_ADDRESS);
    console.log("Contract address:", CONTRACT_ADDRESS);
    
    // Method 1: Get complete lender info
    const lenderInfo = await contract.getMultiAssetLenderInfo(YOUR_ADDRESS);
    console.log("\n=== Your Interest Earned ===");
    console.log("ETH Interest:", ethers.utils.formatEther(lenderInfo.ethCurrentInterest), "ETH");
    console.log("USDC Interest:", ethers.utils.formatUnits(lenderInfo.usdcCurrentInterest, 6), "USDC");
    console.log("ETH Total Balance:", ethers.utils.formatEther(lenderInfo.ethTotalBalance), "ETH");
    console.log("USDC Total Balance:", ethers.utils.formatUnits(lenderInfo.usdcTotalBalance, 6), "USDC");
    
    // Method 2: Get from lenders mapping
    const lenderData = await contract.lenders(YOUR_ADDRESS);
    console.log("\n=== From Lenders Mapping ===");
    console.log("ETH Deposit Amount:", ethers.utils.formatEther(lenderData.ethDepositAmount), "ETH");
    console.log("USDC Deposit Amount:", ethers.utils.formatUnits(lenderData.usdcDepositAmount, 6), "USDC");
    console.log("ETH Accrued Interest:", ethers.utils.formatEther(lenderData.ethAccruedInterest), "ETH");
    console.log("USDC Accrued Interest:", ethers.utils.formatUnits(lenderData.usdcAccruedInterest, 6), "USDC");
    
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Make sure you have deposited funds in the contract");
  }
}

checkInterest();
