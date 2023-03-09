// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "hardhat/console.sol";

contract Pawnshop is Ownable, ReentrancyGuard, IERC721Receiver {
    enum Status {
        Pending,
        Pawning,
        Finished,
        Confiscated,
        Canceled
    }

    struct Pawn {
        uint256 pawnId;
        address nftOwner;
        address nftAddress;
        uint256 nftId;
        uint256 loanAmount;
        uint256 interest;
        uint256 loanDeadline;
        uint256 redemptionDeadline;
        address creditor;
        Status status;
    }

    mapping(uint256 => Pawn) public pawns;
    uint256[] public pawnIds;
    uint256 public pawnsAmount;

    event PawnCreated(
        uint256 indexed pawnId,
        address indexed account,
        address nftAddress,
        uint256 nftId,
        uint256 loanAmount,
        uint256 interest,
        uint256 loanDeadline,
        uint256 redemptionDeadline
    );
    event PawnCanceled(
        uint256 indexed pawnId,
        address indexed account,
        address nftAddress,
        uint256 nftId
    );
    event PawnRedeemed(
        uint256 indexed pawnId,
        address indexed account,
        address nftAddress,
        uint256 nftId
    );
    event PawnLoaned(
        uint256 indexed pawnId,
        address indexed account,
        uint256 loanAmount
    );
    event PawnConfiscated(
        uint256 indexed pawnId,
        address indexed account,
        address nftAddress,
        uint256 nftId
    );
    event Withdraw(address indexed account, uint256 amount);
    event ERC721Received(
        address indexed operator,
        address indexed from,
        uint256 indexed tokenId,
        bytes data
    );

    constructor() payable {
        require(
            msg.sender == tx.origin,
            "Only externally owned accounts can create this contract."
        );
    }

    function getAllPawns() public view returns (Pawn[] memory) {
        Pawn[] memory result = new Pawn[](pawnIds.length);
        uint256 count = 0;
        for (uint256 i = 0; i < pawnIds.length; i++) {
            Pawn memory pawn = pawns[pawnIds[i]];
            if (
                pawn.nftOwner == msg.sender ||
                pawn.creditor == msg.sender ||
                pawn.status == Status.Pending
            ) {
                result[i] = pawns[pawnIds[i]];
                count++;
            }
        }
        assembly {
            mstore(result, count)
        }
        return result;
    }

    function createPawn(
        address _nftAddress,
        uint256 _nftId,
        uint256 _loanAmount,
        uint256 _interest,
        uint256 _loanDeadline,
        uint256 _redemptionDeadline
    ) external returns (uint256) {
        require(
            _loanDeadline > block.timestamp,
            "The loan disbursement deadline should be later than the current time"
        );
        require(
            _redemptionDeadline > _loanDeadline,
            "The redemption deadline should be later than the loan disbursement deadline"
        );
        require(_loanAmount > 0, "The loan amount should larger than 0");
        require(_interest > 0, "The interest amount should larger than 0");

        IERC721(_nftAddress).safeTransferFrom(
            msg.sender,
            address(this),
            _nftId
        );
        uint256 pawnId = ++pawnsAmount;
        pawns[pawnId].pawnId = pawnId;
        pawns[pawnId].nftOwner = msg.sender;
        pawns[pawnId].nftAddress = _nftAddress;
        pawns[pawnId].nftId = _nftId;
        pawns[pawnId].loanAmount = _loanAmount;
        pawns[pawnId].interest = _interest;
        pawns[pawnId].redemptionDeadline = _redemptionDeadline;
        pawns[pawnId].loanDeadline = _loanDeadline;

        pawnIds.push(pawnId);

        emit PawnCreated(
            pawnId,
            msg.sender,
            _nftAddress,
            _nftId,
            _loanAmount,
            _interest,
            _loanDeadline,
            _redemptionDeadline
        );
        return pawnId;
    }

    function cancelPawn(uint256 _pawnId) external {
        Pawn storage pawn = pawns[_pawnId];
        require(msg.sender == pawn.nftOwner, "It's not your nft");
        require(
            Status.Pending == pawn.status,
            "You can canel pawn only when it is pending"
        );

        IERC721(pawn.nftAddress).transferFrom(
            address(this),
            msg.sender,
            pawn.nftId
        );
        pawn.status = Status.Canceled;
        emit PawnCanceled(_pawnId, pawn.nftOwner, pawn.nftAddress, pawn.nftId);
    }

    function redeem(uint256 _pawnId) external payable nonReentrant {
        Pawn storage pawn = pawns[_pawnId];
        require(msg.sender == pawn.nftOwner, "It's not your nft");
        require(Status.Pawning == pawn.status, "The nft is not pawning");
        require(
            msg.value >= pawn.loanAmount + pawn.interest,
            "You should pay more to redeem"
        );
        IERC721(pawn.nftAddress).transferFrom(
            address(this),
            msg.sender,
            pawn.nftId
        );
        payable(pawn.creditor).transfer(pawn.loanAmount + pawn.interest);
        pawn.status = Status.Finished;
        emit PawnRedeemed(_pawnId, pawn.nftOwner, pawn.nftAddress, pawn.nftId);
    }

    function loan(uint256 _pawnId) external payable nonReentrant {
        Pawn storage pawn = pawns[_pawnId];
        require(Status.Pending == pawn.status, "The pawn is not pending");
        require(block.timestamp < pawn.loanDeadline, "Too late to loan");
        require(msg.value >= pawn.loanAmount, "You should pay more to loan");
        payable(pawn.nftOwner).transfer(Math.mulDiv(pawn.loanAmount, 99, 100));
        pawn.status = Status.Pawning;
        emit PawnLoaned(_pawnId, pawn.creditor, pawn.loanAmount);
    }

    function confiscate(uint256 _pawnId) external {
        Pawn storage pawn = pawns[_pawnId];
        require(msg.sender == pawn.creditor, "You are not the creditor");
        require(
            block.timestamp > pawn.redemptionDeadline,
            "Too early to confiscate"
        );
        require(Status.Pawning == pawn.status, "The pawn is not pawning");

        IERC721(pawn.nftAddress).transferFrom(
            address(this),
            msg.sender,
            pawn.nftId
        );
        pawn.status = Status.Confiscated;
        emit PawnConfiscated(
            _pawnId,
            pawn.creditor,
            pawn.nftAddress,
            pawn.nftId
        );
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "Balance is zero");
        payable(owner()).transfer(balance);
        emit Withdraw(owner(), balance);
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        emit ERC721Received(operator, from, tokenId, data);
        return
            bytes4(
                keccak256("onERC721Received(address,address,uint256,bytes)")
            );
    }
}
