"""Pure-stdlib logistic regression + metrics so the sidecar is runnable with zero
heavy dependencies. TabPFN (Prior Labs) is layered on top when available — see tabpfn.py.
"""
from __future__ import annotations

import math
from dataclasses import dataclass


def sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z)
    return e / (1.0 + e)


@dataclass
class LogisticModel:
    weights: list[float]
    bias: float

    def predict_proba(self, x: list[float]) -> float:
        z = self.bias + sum(w * xi for w, xi in zip(self.weights, x))
        return sigmoid(z)


@dataclass
class RidgeModel:
    weights: list[float]
    bias: float

    def predict(self, x: list[float]) -> float:
        return self.bias + sum(w * xi for w, xi in zip(self.weights, x))


def _solve_linear_system(A: list[list[float]], b: list[float]) -> list[float]:
    """Gaussian elimination with partial pivoting (stdlib only)."""
    n = len(A)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(M[r][col]))
        if abs(M[piv][col]) < 1e-12:
            continue
        M[col], M[piv] = M[piv], M[col]
        pv = M[col][col]
        for r in range(col + 1, n):
            factor = M[r][col] / pv
            for c in range(col, n + 1):
                M[r][c] -= factor * M[col][c]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        if abs(M[r][r]) < 1e-12:
            x[r] = 0.0
            continue
        s = M[r][n] - sum(M[r][c] * x[c] for c in range(r + 1, n))
        x[r] = s / M[r][r]
    return x


def train_ridge(
    X: list[list[float]], y: list[float], *, l2: float = 1.0
) -> RidgeModel:
    """Closed-form ridge regression for the days-to-merge target.

    Solved via normal equations (deterministic, numerically stable) rather than
    gradient descent. Used only as the fallback when the TabPFN regressor is
    unavailable. The intercept is not penalized.
    """
    if not X:
        return RidgeModel(weights=[], bias=0.0)
    n = len(X[0])
    d = n + 1  # + intercept column
    A = [[0.0] * d for _ in range(d)]
    rhs = [0.0] * d
    for xi, yi in zip(X, y):
        aug = xi + [1.0]
        for p in range(d):
            rhs[p] += aug[p] * yi
            for q in range(d):
                A[p][q] += aug[p] * aug[q]
    for p in range(n):  # penalize weights, not the intercept
        A[p][p] += l2
    sol = _solve_linear_system(A, rhs)
    return RidgeModel(weights=sol[:n], bias=sol[n])


def train_logistic(
    X: list[list[float]], y: list[int], *, steps: int = 400, lr: float = 0.5, l2: float = 0.01
) -> LogisticModel:
    if not X:
        return LogisticModel(weights=[], bias=0.0)
    n = len(X[0])
    w = [0.0] * n
    b = 0.0
    m = len(X)
    for _ in range(steps):
        grad_w = [0.0] * n
        grad_b = 0.0
        for xi, yi in zip(X, y):
            err = sigmoid(b + sum(wj * xj for wj, xj in zip(w, xi))) - yi
            grad_b += err
            for j in range(n):
                grad_w[j] += err * xi[j]
        for j in range(n):
            w[j] -= lr * (grad_w[j] / m + l2 * w[j])
        b -= lr * (grad_b / m)
    return LogisticModel(weights=w, bias=b)


def roc_auc(y_true: list[int], scores: list[float]) -> float:
    pos = [(s, i) for i, (s, t) in enumerate(zip(scores, y_true)) if t == 1]
    neg = [s for s, t in zip(scores, y_true) if t == 0]
    if not pos or not neg:
        return 0.5
    wins = ties = 0.0
    for p, _ in pos:
        for n in neg:
            if p > n:
                wins += 1
            elif p == n:
                ties += 1
    return (wins + 0.5 * ties) / (len(pos) * len(neg))


def pr_auc(y_true: list[int], scores: list[float]) -> float:
    order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    total_pos = sum(y_true)
    if total_pos == 0:
        return 0.0
    tp = 0.0
    fp = 0.0
    prev_recall = 0.0
    area = 0.0
    for i in order:
        if y_true[i] == 1:
            tp += 1
        else:
            fp += 1
        precision = tp / (tp + fp)
        recall = tp / total_pos
        area += precision * (recall - prev_recall)
        prev_recall = recall
    return area


def calibration_error(y_true: list[int], probs: list[float], bins: int = 5) -> float:
    """Expected calibration error (mean |avg predicted - avg actual| per bin,
    weighted by bin size). Lower is better. PRD §7.3 reports it honestly."""
    if not probs:
        return 0.0
    buckets: list[list[tuple[float, int]]] = [[] for _ in range(bins)]
    for p, t in zip(probs, y_true):
        idx = min(int(p * bins), bins - 1)
        buckets[idx].append((p, t))
    n = len(probs)
    ece = 0.0
    for bucket in buckets:
        if not bucket:
            continue
        avg_p = sum(p for p, _ in bucket) / len(bucket)
        avg_t = sum(t for _, t in bucket) / len(bucket)
        ece += (len(bucket) / n) * abs(avg_p - avg_t)
    return ece
