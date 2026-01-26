# Proof of Restrain - Blockchain Self-Discipline Platform

A blockchain-based platform for creating accountability contracts with real financial stakes.

## í³‹ Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MetaMask wallet
- Alchemy account (for blockchain RPC)

## íº€ Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/riddhi-rathi/proof-of-restrain.git
cd proof-of-restrain
```

### 2. Environment Setup

Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit `.env` and add your actual keys:
- **Alchemy API**: Get from https://www.alchemy.com/
- **Private Key**: From MetaMask (Settings > Security & Privacy)
- **OpenAI/Anthropic**: Get API keys if using AI features

### 3. Install Dependencies

**Root (Smart Contracts):**
```bash
npm install
```

**Frontend:**
```bash
cd proof-of-restrain
npm install
cd ..
```

### 4. Run the Application

**Start Frontend:**
```bash
cd proof-of-restrain
npm run dev
```

The app will be available at `http://localhost:5173`

## í¿—ï¸ Project Structure
```
â”œâ”€â”€ backend/              # Backend API
â”œâ”€â”€ contracts/            # Smart contracts (Solidity)
â”œâ”€â”€ proof-of-restrain/    # Frontend (React + Vite)
â”œâ”€â”€ scripts/              # Deployment scripts
â””â”€â”€ test/                 # Contract tests
```

## í·ª Smart Contract Deployment
```bash
# Compile contracts
npx hardhat compile

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia
```

## í´§ Troubleshooting

**"Module not found" errors:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Also in frontend
cd proof-of-restrain
rm -rf node_modules package-lock.json
npm install
```

**MetaMask issues:**
- Switch to Sepolia testnet
- Get test ETH: https://sepoliafaucet.com/

## í³ Environment Variables

Required in `.env`:
- `PRIVATE_KEY` - Your wallet private key
- `ALCHEMY_API_KEY` - Alchemy RPC key
- `VITE_CONTRACT_ADDRESS` - Deployed contract address
- `VITE_OPENAI_API_KEY` - OpenAI API key (optional)

## í¼ Deployed Links

- **Frontend**: [Add your Vercel/Netlify link here]
- **Smart Contract**: [Add Sepolia Etherscan link here]

## í³„ License

MIT
