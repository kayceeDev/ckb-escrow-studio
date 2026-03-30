import { createExplorerTxUrl } from "../studio.js";

interface DetailPageProps {
  txHash: string;
  index: string;
  capacity: string;
  state: string | null;
  amount: string | null;
  deadline: string | null;
  description: string | null;
  buyerLockHash: string | null;
  sellerLockHash: string | null;
  arbitratorLockHash: string | null;
  onOpenOperate: () => void;
}

function suggestedAction(state: string | null): string {
  switch (state) {
    case "Funded":
      return "Seller can deliver, buyer can cancel or refund after deadline.";
    case "Delivered":
      return "Buyer can complete or either buyer/seller can raise a dispute.";
    case "Disputed":
      return "Arbitrator can resolve funds to buyer or seller.";
    default:
      return "Load a valid escrow cell to see action guidance.";
  }
}

export function DetailPage({
  txHash,
  index,
  capacity,
  state,
  amount,
  deadline,
  description,
  buyerLockHash,
  sellerLockHash,
  arbitratorLockHash,
  onOpenOperate,
}: DetailPageProps) {
  return (
    <div className="page-grid">
      <section className="panel span-2">
        <div className="panel-head">
          <div>
            <h2>Escrow Detail</h2>
            <p className="muted">
              Focused view of the currently loaded escrow cell, with suggested next steps based on state.
            </p>
          </div>
          <div className="actions">
            {txHash ? (
              <a
                className="secondary-button"
                href={createExplorerTxUrl(txHash)}
                target="_blank"
                rel="noreferrer"
              >
                Open Transaction
              </a>
            ) : null}
            <button onClick={onOpenOperate}>Open Operate Screen</button>
          </div>
        </div>
        <div className="detail-hero">
          <div className="detail-state-card">
            <span>Current State</span>
            <strong>{state ?? "No escrow loaded"}</strong>
          </div>
          <div className="detail-state-card">
            <span>Suggested Next Step</span>
            <strong>{suggestedAction(state)}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Cell Identity</h2>
        <dl className="decode-grid">
          <div className="wide">
            <dt>Transaction Hash</dt>
            <dd>{txHash || "Not loaded"}</dd>
          </div>
          <div>
            <dt>Index</dt>
            <dd>{index || "0"}</dd>
          </div>
          <div>
            <dt>Capacity</dt>
            <dd>{capacity || "0"}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2>Business Terms</h2>
        <dl className="decode-grid">
          <div>
            <dt>Amount</dt>
            <dd>{amount ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Deadline</dt>
            <dd>{deadline ?? "Unknown"}</dd>
          </div>
          <div className="wide">
            <dt>Description</dt>
            <dd>{description ?? "Unknown"}</dd>
          </div>
        </dl>
      </section>

      <section className="panel span-2">
        <h2>Participants</h2>
        <dl className="decode-grid">
          <div className="wide">
            <dt>Buyer Lock Hash</dt>
            <dd>{buyerLockHash ?? "Unknown"}</dd>
          </div>
          <div className="wide">
            <dt>Seller Lock Hash</dt>
            <dd>{sellerLockHash ?? "Unknown"}</dd>
          </div>
          <div className="wide">
            <dt>Arbitrator Lock Hash</dt>
            <dd>{arbitratorLockHash ?? "Unknown"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
