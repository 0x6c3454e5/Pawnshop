import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers'
import './App.css';
import pawnshop from './Pawnshop.json'
import Pawns from './Pawns';

const pawnshopAddress = process.env.REACT_APP_CONTRACT_ADDRESS;

function App() {
  const [accounts, setAccounts] = useState([]);
  const [contract, setContract] = useState(null);
  const [pawns, setPawns] = useState([]);
  const [nftAddress, setNftAddress] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [loanAmount, setLoanAmount] = useState(1000000);
  const [interest, setInterest] = useState(100000);
  const [loanDeadline, setLoanDeadline] = useState(Math.floor(Date.now() / 1000) + 600);
  const [redemptionDeadline, setRedemptionDeadline] = useState(Math.floor(Date.now() / 1000) + 1200);
  const [text, setText] = useState(false);
  const isConnected = Boolean(accounts[0]);


  useEffect(() => {

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(
      pawnshopAddress,
      pawnshop.abi,
      signer
    );
    setContract(contract);
    async function initPage() {

      await connectAccount();
      getPawns(contract);

    }
    contract.on("PawnCreated", (pawnId, account, nftAddress, nftId, loanAmount, interest, loanDeadline, redemptionDeadline, event) => {
      setText(`Congrats, Pawn #${pawnId} created.`);
      const pawn = {
        pawnId: pawnId.toNumber(),
        nftOwner: account,
        nftAddress: nftAddress,
        nftId: nftId.toNumber(),
        loanAmount: loanAmount.toNumber(),
        interest: interest.toNumber(),
        loanDeadline: loanDeadline.toNumber(),
        redemptionDeadline: redemptionDeadline.toNumber(),
        creditor: "0x0000000000000000000000000000000000000000",
        status: 0
      };
      setPawns([...pawns, pawn]);
    });
    contract.on("PawnCanceled", (pawnId, account, nftAddress, nftId, event) => {
      const newPawns = [...pawns];
      newPawns.forEach(p => {
        if (p.pawnId == pawnId) {
          p.status = 4;
        }
      });
      setPawns(newPawns);
      console.log("#%s canceled", pawnId);
    });
    initPage();
    return () => {
      contract.removeAllListeners();
    };
  }, []);

  async function getMetadata(contractAddress, tokenId) {

    const contractABI = [
      "function tokenURI(uint256 _tokenId) external view returns (string)"
    ];

    const provider = new ethers.providers.Web3Provider(window.ethereum);

    const wallet = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);

    const tokenUri = await contract.tokenURI(tokenId);
    const response = await fetch(tokenUri);
    return response.json();
  }

  async function approve(contractAddress, approvedAddress, tokenId) {

    const contractABI = [
      "function approve(address _approved, uint256 _tokenId) external"
    ];

    const provider = new ethers.providers.Web3Provider(window.ethereum);

    const wallet = provider.getSigner();

    const contract = new ethers.Contract(contractAddress, contractABI, wallet);

    const tx = await contract.approve(approvedAddress, tokenId);

    console.log("%s was approved to operate your NFT", approvedAddress);
  }

  async function updatePawnImage(pawns) {
    for (let i = 0; i < pawns.length; i++) {
      const pawn = pawns[i];
      const meta = await getMetadata(pawn.nftAddress, pawn.nftId);
      pawn.image = meta.image;
    }
  }

  async function createPawn() {

    setText("Creating, please wait a minute");
    try {
      await approve(nftAddress, pawnshopAddress, tokenId);

      await contract.createPawn(
        nftAddress,
        tokenId,
        ethers.utils.parseUnits(loanAmount.toString(), "gwei"),
        ethers.utils.parseUnits(interest.toString(), "gwei"),
        loanDeadline,
        redemptionDeadline,
        { gasLimit: 1000000 }
      );
    } catch (err) {
      console.log(err);
    }
  }

  async function getPawns(contract) {

    try {
      const response = await contract.getAllPawns({
        gasLimit: 1000000
      });
      if (response.length <= 0) {
        return;
      }

      const allPawns = [];
      response.forEach(p => {
        const pawn = {
          pawnId: p['pawnId'].toNumber(),
          nftOwner: p['nftOwner'],
          nftAddress: p['nftAddress'],
          nftId: p['nftId'].toNumber(),
          loanAmount: p['loanAmount'].toNumber(),
          interest: p['interest'].toNumber(),
          loanDeadline: p['loanDeadline'].toNumber(),
          redemptionDeadline: p['redemptionDeadline'].toNumber(),
          creditor: p['creditor'],
          status: p['status']
        };
        allPawns.push(pawn);
      });

      await updatePawnImage(allPawns);
      setPawns(allPawns);

    } catch (err) {
      console.log(err);
    }
  }
  async function connectAccount() {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      setAccounts(accounts);
      console.log('connected');
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <div>
          <input type='text' placeholder='NFT address' value={nftAddress} onChange={(e) => { setNftAddress(e.target.value) }} />
          <input type='text' placeholder='Token Id' value={tokenId} onChange={(e) => { setTokenId(e.target.value) }} /> <br />
          <input type='text' placeholder='Loan Amount' value={loanAmount} onChange={(e) => { setLoanAmount(e.target.value) }} />
          <input type='text' placeholder='Interest' value={interest} onChange={(e) => { setInterest(e.target.value) }} /> <br />
          <input type='text' placeholder='Loan Deadline' value={loanDeadline} onChange={(e) => { setLoanDeadline(e.target.value) }} />
          <input type='text' placeholder='Redemption Deadline' value={redemptionDeadline} onChange={(e) => { setRedemptionDeadline(e.target.value) }} /> <br />
          <button onClick={createPawn}>create pawn</button>
        </div>
        <div>{text}</div>
        <hr />
        {isConnected ? (
          <div>
            <Pawns pawns={pawns} setPawns={setPawns} accounts={accounts} contract={contract}>
            </Pawns>
          </div>
        ) :
          null
        }

      </header>
    </div>
  );
}

export default App;
