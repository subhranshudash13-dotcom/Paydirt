"""Snapshot-time feature construction (no future leakage — PRD §7.2).

Pure stdlib so the sidecar runs and tests fast. Language is a categorical
encoded via a learned vocabulary captured at fit time.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

NUMERIC_FEATURES: list[str] = [
    "bounty_amount",
    "repo_stars",
    "repo_forks",
    "repo_age_days",
    "issue_age_days_at_snapshot",
    "comment_count_at_snapshot",
    "claimant_count_at_snapshot",
    "body_length",
    "has_good_first_issue_label",
    "maintainer_median_first_response_hours_prior_90d",
    "maintainer_merge_rate_prior_90d",
    "repo_commits_prior_30d",
    "open_issue_count",
]

# Rough scales so raw magnitudes don't swamp the logistic/TabPFN input.
_SCALES: dict[str, float] = {
    "bounty_amount": 500.0,
    "repo_stars": 20000.0,
    "repo_forks": 2000.0,
    "repo_age_days": 1500.0,
    "issue_age_days_at_snapshot": 30.0,
    "comment_count_at_snapshot": 15.0,
    "claimant_count_at_snapshot": 4.0,
    "body_length": 1200.0,
    "maintainer_median_first_response_hours_prior_90d": 48.0,
    "repo_commits_prior_30d": 200.0,
    "open_issue_count": 600.0,
    "has_good_first_issue_label": 1.0,
    "maintainer_merge_rate_prior_90d": 1.0,
}


def _get(row: dict[str, Any], key: str) -> float:
    # Accept both snake_case (DB/collector) and camelCase (TS FeatureRow) keys.
    camel = "".join(p.capitalize() if i else p for i, p in enumerate(key.split("_")))
    val = row.get(key, row.get(camel))
    if val is None:
        return 0.0
    if isinstance(val, bool):
        return 1.0 if val else 0.0
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


@dataclass
class FeatureEncoder:
    language_vocab: dict[str, int] = field(default_factory=dict)

    def fit_vocab(self, rows: list[dict[str, Any]]) -> "FeatureEncoder":
        langs: list[str] = []
        for r in rows:
            lang = str(r.get("language", "") or "").strip()
            if lang and lang not in langs:
                langs.append(lang)
        self.language_vocab = {lang: i for i, lang in enumerate(langs)}
        return self

    def to_matrix(self, rows: list[dict[str, Any]]) -> list[list[float]]:
        vocab_n = max(len(self.language_vocab), 1)
        matrix: list[list[float]] = []
        for r in rows:
            vec: list[float] = []
            for feat in NUMERIC_FEATURES:
                scale = _SCALES.get(feat, 1.0) or 1.0
                vec.append(_get(r, feat) / scale)
            lang = str(r.get("language", "") or "").strip()
            onehot = [0.0] * vocab_n
            idx = self.language_vocab.get(lang)
            if idx is not None:
                onehot[idx] = 1.0
            vec.extend(onehot)
            matrix.append(vec)
        return matrix

    @property
    def n_features(self) -> int:
        return len(NUMERIC_FEATURES) + max(len(self.language_vocab), 1)

    def to_dict(self) -> dict[str, Any]:
        return {"language_vocab": self.language_vocab}

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "FeatureEncoder":
        return cls(language_vocab={k: int(v) for k, v in d.get("language_vocab", {}).items()})
