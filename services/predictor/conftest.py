"""Pytest setup: make the `app` package importable and provide a deterministic,
leak-free labeled dataset that correlates success with real signals."""
from __future__ import annotations

import math
import os
import sys

import pytest

# services/predictor/  -> add to path so `from app import ...` works.
sys.path.insert(0, os.path.dirname(__file__))

LANGS = ["TypeScript", "Python", "Go", "Rust", "Java"]


def _row(i: int) -> dict:
    """Synthesize a snapshot-time feature row + label. success is driven only by
    snapshot features (never by the future merged outcome) so the dataset itself
    is leakage-free by construction."""
    bounty = [0, 50, 100, 150, 300, 500][i % 6]
    merge_rate = ((i * 37) % 100) / 100.0            # 0..1 maintainer merge rate
    resp_hours = 2 + (i % 48)                         # prior median first response
    stars = 200 + (i * 131) % 20000
    comment = i % 12
    claim = i % 5
    good_first = 1 if i % 3 == 0 else 0
    commits = 10 + (i * 7) % 300
    open_issues = 20 + (i * 11) % 900
    lang = LANGS[i % len(LANGS)]

    # Latent score from snapshot-time signals only, then a deterministic gate.
    latent = (
        (bounty / 500.0) * 1.1
        + merge_rate * 1.6
        - min(resp_hours, 72) / 72.0 * 0.8
        - claim / 5.0 * 0.5
        + (0.3 if good_first else 0.0)
    )
    noise = math.sin(i) * 0.35
    success = 1 if (latent + noise) > 0.9 else 0

    row = {
        "ref": f"issue-{i}",
        "bounty_amount": bounty,
        "repo_stars": stars,
        "repo_forks": stars // 6,
        "repo_age_days": 200 + (i * 3) % 1400,
        "issue_age_days_at_snapshot": i % 30,
        "comment_count_at_snapshot": comment,
        "claimant_count_at_snapshot": claim,
        "body_length": 200 + (i * 17) % 1500,
        "has_good_first_issue_label": good_first,
        "maintainer_median_first_response_hours_prior_90d": resp_hours,
        "maintainer_merge_rate_prior_90d": merge_rate,
        "repo_commits_prior_30d": commits,
        "open_issue_count": open_issues,
        "language": lang,
        "success": success,
        "days_to_merge": (5 + i % 20) if success else None,
        # chronological, distinct: older rows first, mixed labels throughout.
        "created_at": 1_600_000_000 + i * 86_400,
    }
    return row


@pytest.fixture(scope="function")
def labeled_rows() -> list[dict]:
    return [_row(i) for i in range(160)]
