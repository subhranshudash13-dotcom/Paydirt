"""Feature pipeline + leakage tests (PRD §7.2, Phase 2 gate)."""
from __future__ import annotations

from app.features import FeatureEncoder, NUMERIC_FEATURES


def test_matrix_width_matches_features_plus_vocab() -> None:
    rows = [{"language": "Go"}, {"language": "Rust"}]
    enc = FeatureEncoder().fit_vocab(rows)
    vec = enc.to_matrix(rows)[0]
    assert len(vec) == len(NUMERIC_FEATURES) + 2  # 2 langs in vocab
    assert enc.n_features == len(NUMERIC_FEATURES) + 2


def test_accepts_camel_and_snake_keys() -> None:
    snake = {"bounty_amount": 150}
    camel = {"bountyAmount": 150}
    enc = FeatureEncoder().fit_vocab([snake])
    s = enc.to_matrix([snake])[0][0]
    c = enc.to_matrix([camel])[0][0]
    assert s == c == 150.0 / 500.0


def test_no_future_information_leaks() -> None:
    """Only snapshot features are read; the merged-outcome fields must never
    influence the encoded vector."""
    base = {"bounty_amount": 100, "repo_stars": 1000, "language": "Go"}
    leaked = dict(base)
    leaked["linked_pr_merged"] = True
    leaked["merged_at"] = "2026-01-01"
    leaked["success"] = 1

    enc = FeatureEncoder().fit_vocab([base])
    a = enc.to_matrix([base])[0]
    b = enc.to_matrix([leaked])[0]
    assert a == b, "future/outcome fields must not change the feature vector"


def test_serialization_roundtrip() -> None:
    enc = FeatureEncoder().fit_vocab([{"language": "Python"}, {"language": "Go"}])
    clone = FeatureEncoder.from_dict(enc.to_dict())
    assert clone.language_vocab == enc.language_vocab
    row = {"language": "Go", "bounty_amount": 50}
    assert enc.to_matrix([row]) == clone.to_matrix([row])


def test_bool_features_become_numeric() -> None:
    enc = FeatureEncoder().fit_vocab([{"language": "Go"}])
    vec = enc.to_matrix([{"has_good_first_issue_label": True, "language": "Go"}])[0]
    idx = NUMERIC_FEATURES.index("has_good_first_issue_label")
    assert vec[idx] == 1.0
