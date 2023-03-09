const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const nftAddress = "";

describe("Pawnshop", function () {

  async function deployPawnshopFixture() {

    const Pawnshop = await ethers.getContractFactory("Pawnshop");
    const pawnshop = await Pawnshop.deploy();
    return { pawnshop };
  }

  async function deployPawnshopWithETHFixture() {

    const Pawnshop = await ethers.getContractFactory("Pawnshop");
    const pawnshop = await Pawnshop.deploy({
      value: ethers.utils.parseEther((0.001).toString())
    });
    return { pawnshop };
  }

  describe("Deployment", function () {

    it("Should set the right owner", async function () {
      const { pawnshop } = await loadFixture(deployPawnshopFixture);
      const [owner, otherAccount] = await ethers.getSigners();
      expect(await pawnshop.owner()).to.equal(owner.address);
    });
  });


  describe("Withdraw", function () {

    it("Should revert with the right error if balance is zero", async function () {
      const { pawnshop } = await loadFixture(
        deployPawnshopFixture
      );
      const [owner, otherAccount] = await ethers.getSigners();
      await expect(pawnshop.connect(owner).withdraw()).to.be.revertedWith(
        "Balance is zero"
      );
    });

    it("Should fail when withdraw by non owner account", async function () {

      const { pawnshop } = await loadFixture(
        deployPawnshopWithETHFixture
      );
      const [owner, otherAccount] = await ethers.getSigners();
      await expect(pawnshop.connect(otherAccount).withdraw()).to.be.reverted;
    });

    it("Shouldn't fail when withdraw", async function () {
      const { pawnshop } = await loadFixture(
        deployPawnshopWithETHFixture
      );
      const [owner, otherAccount] = await ethers.getSigners();
      await expect(pawnshop.connect(owner).withdraw()).not.to.be.reverted;
    });
  });


  describe("Pawn", function () {
    let pawnshop;
    let nftContract;
    let owner;
    let nftOwner;
    let pawnCreditor;
    let otherAddress;
    const tokenId = 1;

    beforeEach(async function () {
      [owner, nftOwner, pawnCreditor, otherAddress] = await ethers.getSigners();

      const nftAbi = [
        "function approve(address _approved, uint256 _tokenId) external"
      ];

      nftContract = new ethers.Contract(nftAddress, nftAbi, ethers.provider.getSigner());

      const Pawnshop = await ethers.getContractFactory("Pawnshop");
      pawnshop = await Pawnshop.deploy();
      console.log(pawnshop.address);
    });

    describe("CreatePawn", function () {

      it("Shouldn't fail when create pawn", async function () {
        const loanAmount = 100;
        const interest = 10;
        const loanDeadline = Math.floor(Date.now() / 1000) + 1000;
        const redemptionDeadline = loanDeadline + 1000;


        await nftContract.connect(nftOwner).approve(pawnshop.address, tokenId);


        await expect(pawnshop.connect(nftOwner).createPawn(
          nftContract.address,
          tokenId,
          loanAmount,
          interest,
          loanDeadline,
          redemptionDeadline
        )).not.to.be.reverted;
      });

    });
  });
});
