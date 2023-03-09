import { ethers } from 'ethers'

const Pawns = ({ pawns, setPawns, accounts, contract }) => {
    const account = accounts[0].toLowerCase();

    const status = ['Pending', 'Pawning', 'Finished', 'Confiscated', 'Canceled'];

    const listItems = pawns.map((pawn) =>
        <tr key={pawn.pawnId}>
            <td>{pawn.pawnId}</td>
            <td><img src={pawn.image} /></td>
            <td>{ethers.utils.formatEther(pawn.loanAmount)} eth</td>
            <td>{ethers.utils.formatEther(pawn.interest)} eth</td>
            <td>{status[pawn.status]}</td>
            <td>
                {pawn.status == 0 && pawn.nftOwner.toLowerCase() == account
                    ? <button onClick={() => handleCancel(pawn.pawnId)}>Cancel</button> : <span></span>}

                {pawn.status == 1 && pawn.redemptionDeadline <= Math.floor(Date.now() / 1000) && pawn.creditor.toLowerCase() == account
                    ? <button>Confiscate</button> : <span></span>}

                {pawn.status == 0 && pawn.loanDeadline > Math.floor(Date.now() / 1000) && pawn.nftOwner.toLowerCase() != account
                    ? <button>Loan</button> : <span></span>}

                {pawn.status == 1 && pawn.redemptionDeadline > Math.floor(Date.now() / 1000) && pawn.nftOwner.toLowerCase() == account
                    ? <button>Redeem</button> : <span></span>}
            </td>
        </tr>
    );

    const handleCancel = async (pawnId) => {
        await contract.cancelPawn(pawnId, {
            gasLimit: 1000000
        });
    }

    return (
        (listItems.length > 0 ?
            <table border='solid 1px collapse'>
                <tbody>
                    <tr><td>pawn id</td><td>image</td><td>loan amount</td><td>interest</td><td>status</td><td>operate</td></tr>
                    {listItems}
                </tbody>
            </table> : null
        )
    );
}

export default Pawns;