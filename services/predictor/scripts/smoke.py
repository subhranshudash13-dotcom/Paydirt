"""Live smoke test against a running sidecar (PRD §7.4).

Usage:
    python -m uvicorn app.main:app --port 8000   # in another shell
    python scripts/smoke.py [--base http://127.0.0.1:8000]

Generates a deterministic labeled dataset, POSTs /train, then /predict, and
prints the model's metrics vs the bounty-only baseline so the honest evaluation
is visible without running pytest.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request

LANGS = ["TypeScript", "Python", "Go", "Rust", "Java"]


def row(i: int) -> dict:
    bounty = [0, 50, 100, 150, 300, 500][i % 6]
    merge_rate = ((i * 37) % 100) / 100.0
    resp_hours = 2 + (i % 48)
    claim = i % 5
    good_first = 1 if i % 3 == 0 else 0
    latent = (
        (bounty / 500.0) * 1.1
        + merge_rate * 1.6
        - min(resp_hours, 72) / 72.0 * 0.8
        - claim / 5.0 * 0.5
        + (0.3 if good_first else 0.0)
    )
    success = 1 if latent > 0.9 else 0
    return {
        "ref": f"issue-{i}",
        "bounty_amount": bounty,
        "repo_stars": 200 + (i * 131) % 20000,
        "repo_forks": 100,
        "repo_age_days": 400 + (i * 3) % 1200,
        "issue_age_days_at_snapshot": i % 30,
        "comment_count_at_snapshot": i % 12,
        "claimant_count_at_snapshot": claim,
        "body_length": 200 + (i * 17) % 1500,
        "has_good_first_issue_label": good_first,
        "maintainer_median_first_response_hours_prior_90d": resp_hours,
        "maintainer_merge_rate_prior_90d": merge_rate,
        "repo_commits_prior_30d": 10 + (i * 7) % 300,
        "open_issue_count": 20 + (i * 11) % 900,
        "language": LANGS[i % len(LANGS)],
        "success": success,
        "days_to_merge": (5 + i % 20) if success else None,
        "created_at": 1_600_000_000 + i * 86_400,
    }


def post(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8000")
    args = ap.parse_args()

    rows = [row(i) for i in range(160)]
    metrics = post(f"{args.base}/train", {"rows": rows})
    print("=== /train metrics (honest) ===")
    print(json.dumps(metrics, indent=2))

    preds = post(f"{args.base}/predict", {"rows": rows[:5]})
    print("\n=== /predict (first 5) ===")
    print(json.dumps(preds, indent=2))

    chosen = metrics["chosen"]["rocAuc"]
    bounty = metrics["baselines"]["bountyOnly"]["rocAuc"]
    print(f"\nmodel ROC-AUC {chosen} vs bounty-only {bounty}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
