# Multi-Asset DeFi Protocol

![Multi-Asset DeFi Protocol](https://raw.githubusercontent.com/Agihtaws/arbminidefi/main/frontend/public/ChatGPT%20Image%20Sep%205%2C%202025%2C%2008_35_16%20PM.png)

A cutting-edge decentralized finance (DeFi) platform built on the Arbitrum Sepolia testnet, enabling users to seamlessly lend, borrow, and manage their crypto assets with advanced real-time validation and a robust user experience.

## 🚀 Live Demo

- **Contract Address (MultiAssetLendingPool)**: `0xE6525B464f050eE44CaceA7711432E1D1Fc14026`
- **USDC Token Address (Arbitrum Sepolia)**: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
- **Frontend Application**: [https://arbminidefi.vercel.app/]
- **View on Arbiscan**: [MultiAssetLendingPool](https://sepolia.arbiscan.io/address/0xE6525B464f050eE44CaceA7711432E1D1Fc14026) | [USDC Token](https://sepolia.arbiscan.io/token/0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d)

## ✨ Features

-   **Multi-Asset Lending & Borrowing**: Deposit ETH or USDC to earn interest, or use them as collateral to borrow other assets.
-   **Cross-Collateral Borrowing**: Flexibility to borrow ETH using USDC collateral, or borrow USDC using ETH collateral.
-   **Real-Time Validation**: Comprehensive checks for user balance, pool liquidity, and borrowing/withdrawal limits *before* transactions are submitted.
-   **Dynamic Interest Rates**: Competitive lending (5% ETH, 4% USDC) and borrowing (8% ETH, 6% USDC) APYs.
-   **Chainlink Oracle Integration**: Utilizes Chainlink ETH/USD price feeds for accurate, real-time collateral valuation and health factor calculations.
-   **Inline Transaction Status**: Provides clear, contextual feedback on transaction progress (pending, success, error) directly within the interface, eliminating disruptive popups.
-   **Advanced Limit Management**: Displays maximum borrowable and withdrawable amounts, along with required collateral, updated in real-time.
-   **Liquidity Buffer**: Maintains a configurable buffer (e.g., 0.03 ETH, 30 USDC) in the lending pool to ensure continuous liquidity for withdrawals.
-   **Health Factor Monitoring**: Users can track the health of their loans to avoid liquidation.
-   **Secure Protocol**: Built with industry-standard OpenZeppelin contracts for reentrancy protection, ownership, and pausability.
-   **Responsive Design**: A user-friendly interface optimized for both desktop and mobile viewing.

## 🛠️ Tech Stack

-   **Smart Contract**: Solidity 0.8.19
-   **Blockchain**: Arbitrum Sepolia Testnet
-   **Frontend**: React.js, TypeScript
-   **Web3 Integration**: Ethers.js
-   **Styling**: Tailwind CSS
-   **Oracles**: Chainlink Price Feeds
-   **Security**: OpenZeppelin Contracts (ReentrancyGuard, Ownable, Pausable)
-   **Development Environment**: Hardhat


## 🚀 Getting Started

### Prerequisites

-   Node.js (v18.x or higher)
-   npm (v8.x or higher)
-   MetaMask browser extension installed
-   Arbitrum Sepolia testnet ETH (for gas fees and testing)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Agihtaws/arbminidefi.git
    cd arbminidefi
    ```

2.  **Install root dependencies**:
    ```bash
    npm install
    ```

3.  **Smart Contract Deployment**:
    *   Create a `.env` file in the root directory and add your private key and Arbitrum Sepolia RPC URL:
        ```
        PRIVATE_KEY="YOUR_METAMASK_PRIVATE_KEY"
        ARB_SEPOLIA_RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"
        ```
    *   Compile and deploy the `MultiAssetLendingPool` contract:
        ```bash
        npx hardhat clean
        npx hardhat compile
        npx hardhat run scripts/deployMultiAsset.js --network arbitrumSepolia
        ```
    *   **Note the deployed `MultiAssetLendingPool` address and update it in `frontend/src/contracts/config.ts`**. The USDC token address is already configured.

4.  **Frontend Setup**:
    *   Navigate to the `frontend` directory:
        ```bash
        cd frontend
        ```
    *   Install frontend dependencies:
        ```bash
        npm install
        ```
    *   Start the development server:
        ```bash
        npm start
        ```
    *   The application will be accessible at `http://localhost:3000`.

### Getting Arbitrum Sepolia Testnet ETH

-   You can typically get testnet ETH from public faucets. Search for "Arbitrum Sepolia Faucet" online.

## 🎮 How to Use

1.  **Connect Wallet**: Connect your MetaMask wallet to the Arbitrum Sepolia network.
2.  **Monitor Overview**: View real-time pool statistics and your personal account limits (borrowable, withdrawable).
3.  **Deposit Assets**:
    *   Navigate to the "Multi-Asset Lending" section.
    *   Select "ETH" or "USDC".
    *   Enter the amount you wish to deposit.
    *   For USDC, you may need to approve the contract to spend your USDC first.
    *   Click "Deposit".
4.  **Borrow Assets**:
    *   Navigate to the "Multi-Asset Borrowing" section.
    *   Select "Borrow ETH" or "Borrow USDC".
    *   Enter the amount you wish to borrow.
    *   Choose your collateral type (ETH or USDC).
    *   The UI will show the required collateral and how much you can borrow with your current collateral.
    *   For USDC collateral, ensure you have sufficient allowance.
    *   Click "Borrow".
5.  **Repay Loans**:
    *   In the "Your Active Loans" section, click "Repay" for your active ETH or USDC loan.
    *   The system will automatically calculate the total amount owed (principal + interest).
    *   For USDC repayment, ensure you have sufficient allowance.
6.  **Withdraw Funds**:
    *   In the "Multi-Asset Lending" section, select "ETH" or "USDC".
    *   Enter the amount you wish to withdraw (or click "Max" to withdraw the maximum available, respecting the pool's liquidity buffer).
    *   Click "Withdraw".

## 🔗 Smart Contract Details

The core logic is handled by the `MultiAssetLendingPool.sol` smart contract.

-   **Deployed Address (MultiAssetLendingPool)**: `0xE6525B464f050eE44CaceA7711432E1D1Fc14026`
-   **USDC Token Address**: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`

### Key Contract Functions:

-   `depositEth()`: Deposit native ETH into the lending pool.
-   `depositUsdc(uint256 amount)`: Deposit USDC into the lending pool.
-   `withdrawEth(uint256 amount)`: Withdraw ETH from your deposited balance.
-   `withdrawUsdc(uint256 amount)`: Withdraw USDC from your deposited balance.
-   `borrowEth(uint256 borrowAmount, uint8 collateralType, uint256 collateralAmount)`: Borrow ETH with specified collateral.
-   `borrowUsdc(uint256 borrowAmount, uint8 collateralType, uint256 collateralAmount)`: Borrow USDC with specified collateral.
-   `repayEth()`: Repay your outstanding ETH loan.
-   `repayUsdc(uint256 amount)`: Repay your outstanding USDC loan.
-   `getMultiAssetLenderInfo(address lenderAddress)`: Retrieve detailed information about a lender's position.
-   `getBorrowerInfo(address borrowerAddress)`: Retrieve detailed information about a borrower's loan.
-   `getUserLimits(address user)`: Get comprehensive borrowing and withdrawal limits for a user.
-   `getEthPriceUsd()`: Get the current ETH price from the Chainlink Oracle.

## 🎯 Future Enhancements

-   **Liquidation Mechanism**: Implement a robust liquidation process for undercollateralized loans.
-   **Flash Loans**: Explore integrating flash loan capabilities.
-   **Additional Asset Support**: Expand to include more ERC-20 tokens.
-   **Governance Integration**: Decentralized governance for protocol parameter adjustments (interest rates, collateral ratios).
-   **Advanced Analytics**: Integrate charting and historical data for pool performance.
-   **Cross-Chain Compatibility**: Enable lending/borrowing across different blockchain networks.
-   **NFT Collateral**: Allow unique digital assets (NFTs) as collateral.

## 📄 License

This project is licensed under the Apache License 2.0 - see the `LICENSE` file for details.

## 👥 Contributors

-   **Swathiga Agihtaws** - Lead Developer

## 🙏 Acknowledgements

-   **OpenZeppelin**: For battle-tested smart contract libraries.
-   **Chainlink**: For reliable and decentralized price oracle services.
-   **Ethers.js**: For seamless interaction with the Ethereum blockchain.
-   **React & Tailwind CSS**: For building a modern and responsive user interface.
-   **Arbitrum Sepolia**: For providing a high-performance Layer 2 testnet environment.
