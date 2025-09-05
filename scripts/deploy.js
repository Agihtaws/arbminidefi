const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment to Arbitrum Sepolia...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  // Check deployer balance
  const balance = await deployer.getBalance();
  console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");
  
  if (balance.lt(ethers.utils.parseEther("0.01"))) {
    console.error("Insufficient balance for deployment. Need at least 0.01 ETH");
    console.log("Get testnet ETH from: https://faucet.quicknode.com/arbitrum/sepolia");
    process.exit(1);
  }
  
  // Deploy MicroLendingPool contract
  console.log("\nDeploying MicroLendingPool contract...");
  const MicroLendingPool = await ethers.getContractFactory("MicroLendingPool");
  
  const microLendingPool = await MicroLendingPool.deploy();
  await microLendingPool.deployed();
  
  console.log("MicroLendingPool deployed to:", microLendingPool.address);
  console.log("Transaction hash:", microLendingPool.deployTransaction.hash);
  
  // Wait for a few confirmations
  console.log("Waiting for confirmations...");
  await microLendingPool.deployTransaction.wait(3);
  
  // Verify deployment by calling a view function
  console.log("\nVerifying deployment...");
  try {
    const poolStats = await microLendingPool.getPoolStats();
    console.log("Pool Stats Retrieved Successfully:");
    console.log("- Total Liquidity:", ethers.utils.formatEther(poolStats.totalLiquidity), "ETH");
    console.log("- Utilization Rate:", poolStats.utilizationRate.toString() / 10000, "%");
    console.log("- Lend Rate:", poolStats.currentLendRate.toString() / 10000, "%");
    console.log("- Borrow Rate:", poolStats.currentBorrowRate.toString() / 10000, "%");
  } catch (error) {
    console.error("Error verifying deployment:", error.message);
  }
  
  // Save deployment info
  const deploymentInfo = {
    network: "arbitrumSepolia",
    contractAddress: microLendingPool.address,
    deployerAddress: deployer.address,
    transactionHash: microLendingPool.deployTransaction.hash,
    blockNumber: microLendingPool.deployTransaction.blockNumber,
    deploymentTime: new Date().toISOString(),
    contractABI: JSON.stringify(MicroLendingPool.interface.format('json'))
  };
  
  // Write deployment info to file
  const fs = require('fs');
  const path = require('path');
  
  const deploymentDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir);
  }
  
  fs.writeFileSync(
    path.join(deploymentDir, 'arbitrumSepolia.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n=== DEPLOYMENT SUCCESSFUL ===");
  console.log("Contract Address:", microLendingPool.address);
  console.log("Network: Arbitrum Sepolia");
  console.log("Explorer URL: https://sepolia.arbiscan.io/address/" + microLendingPool.address);
  console.log("Deployment info saved to: deployments/arbitrumSepolia.json");
  
  console.log("\n=== NEXT STEPS ===");
  console.log("1. Verify contract on Arbiscan:");
  console.log(`   npx hardhat verify --network arbitrumSepolia ${microLendingPool.address}`);
  console.log("2. Test contract functions:");
  console.log("   - Send small ETH deposit to test");
  console.log("   - Try borrowing with collateral");
  console.log("3. Use contract address in frontend:");
  console.log(`   const CONTRACT_ADDRESS = "${microLendingPool.address}";`);
  
  console.log("\n=== CONTRACT FUNCTIONS AVAILABLE ===");
  console.log("- deposit() - Deposit ETH to earn 5% APY");
  console.log("- withdraw(amount) - Withdraw deposits + interest");
  console.log("- borrow(amount) - Borrow ETH with 150% collateral");
  console.log("- repay() - Repay loan + interest");
  console.log("- liquidate(borrower) - Liquidate unhealthy positions");
  console.log("- getLenderInfo(address) - Get lender details");
  console.log("- getBorrowerInfo(address) - Get borrower details");
  console.log("- getPoolStats() - Get pool statistics");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
