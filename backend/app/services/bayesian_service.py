"""Full Bayesian MCMC climate trend & structural change-point inference.

Implements multi-chain Adaptive Random-Walk Metropolis-within-Gibbs sampling
in NumPy/SciPy:
  - Model 'robust_ar1': Student-t (nu=5) likelihood with exact irregular-gap
    AR(1) covariance (rho^dt scaling across polar-night / missing months).
  - Model 'changepoint': Bayesian piecewise linear hinge regression with unknown
    structural changepoint tau, pre-shift slope beta_1, and slope change delta.

Reports split Gelman-Rubin R-hat, Effective Sample Size (ESS), 95% Highest
Density Interval (HDI), Probability of Direction P(slope > 0), trace series,
posterior histograms, and posterior predictive trend envelopes.
"""

from __future__ import annotations

from typing import Literal, Optional

import numpy as np


def _compute_hdi(samples: np.ndarray, cred_mass: float = 0.95) -> tuple[float, float]:
    sorted_s = np.sort(samples)
    n = len(sorted_s)
    interval_idx = max(1, int(np.floor(cred_mass * n)))
    if interval_idx >= n:
        return float(sorted_s[0]), float(sorted_s[-1])
    widths = sorted_s[interval_idx:] - sorted_s[: n - interval_idx]
    min_idx = int(np.argmin(widths))
    return float(sorted_s[min_idx]), float(sorted_s[min_idx + interval_idx])


def _split_rhat(chains: np.ndarray) -> float:
    """Compute split Gelman-Rubin R-hat for `chains` of shape (m, n_draws)."""
    m, n = chains.shape
    half = n // 2
    if m < 2 or half < 10:
        return 1.0
    split = np.vstack([chains[:, :half], chains[:, half : 2 * half]])
    M, N = split.shape
    chain_means = np.mean(split, axis=1)
    B = N * np.var(chain_means, ddof=1)
    W = np.mean(np.var(split, axis=1, ddof=1))
    if W <= 1e-14:
        return 1.0
    var_hat = ((N - 1.0) / N) * W + (1.0 / N) * B
    return float(np.sqrt(max(1.0, var_hat / W)))


def _estimate_ess(chains: np.ndarray) -> float:
    """Estimate bulk Effective Sample Size across chains."""
    m, n = chains.shape
    if n < 20:
        return float(m * n)
    mean_all = np.mean(chains)
    centered = chains - mean_all
    var = np.var(chains)
    if var <= 1e-14:
        return float(m * n)
    max_lag = min(100, n // 3)
    tau = 1.0
    for lag in range(1, max_lag):
        cov = np.mean(centered[:, :-lag] * centered[:, lag:])
        acf = cov / var
        if acf <= 0.0:
            break
        tau += 2.0 * acf
    return float(max(1.0, (m * n) / max(1.0, tau)))


def _summarize_param(chains: np.ndarray) -> dict:
    flat = chains.reshape(-1)
    hdi_low, hdi_high = _compute_hdi(flat, 0.95)
    q025, q50, q975 = np.percentile(flat, [2.5, 50.0, 97.5])
    return {
        "mean": round(float(np.mean(flat)), 5),
        "median": round(float(q50), 5),
        "sd": round(float(np.std(flat, ddof=1)), 5),
        "hdi_95_low": round(hdi_low, 5),
        "hdi_95_high": round(hdi_high, 5),
        "ci_95_low": round(float(q025), 5),
        "ci_95_high": round(float(q975), 5),
        "r_hat": round(_split_rhat(chains), 4),
        "ess": round(_estimate_ess(chains), 1),
    }


def _histogram(samples: np.ndarray, bins: int = 28) -> dict:
    counts, edges = np.histogram(samples, bins=bins, density=True)
    centers = 0.5 * (edges[:-1] + edges[1:])
    return {
        "centers": [round(float(c), 5) for c in centers],
        "density": [round(float(d), 5) for d in counts],
    }


def _run_robust_ar1_mcmc(
    t_years: np.ndarray,
    y: np.ndarray,
    *,
    chains: int,
    draws: int,
    burn_in: int,
    seed: int,
) -> dict:
    """Component-wise Adaptive Metropolis-within-Gibbs for Student-t (nu=5) AR(1) linear trend.

    Includes fundamental + first harmonic annual seasonal covariates (cos/sin 2*pi*t) when
    series spans >= 2 years so seasonal oscillation is cleanly separated from AR(1) persistence.
    """
    t_mean = float(np.mean(t_years))
    t_sd = max(float(np.std(t_years)), 1e-6)
    y_mean = float(np.mean(y))
    y_sd = max(float(np.std(y)), 1e-6)

    x_std = (t_years - t_mean) / t_sd
    y_std = (y - y_mean) / y_sd
    dt_steps = np.maximum(1.0, np.round(np.diff(t_years) * 12.0))  # month spacing >= 1
    nu = 5.0

    # Design matrix with linear trend + optional annual harmonic cycle
    sin_ann = np.sin(2.0 * np.pi * t_years)
    cos_ann = np.cos(2.0 * np.pi * t_years)
    X_full = np.column_stack([np.ones_like(x_std), x_std, sin_ann, cos_ann])
    ols_beta, _, _, _ = np.linalg.lstsq(X_full, y_std, rcond=None)
    init_resid = y_std - X_full @ ols_beta
    init_sigma = max(0.08, float(np.std(init_resid)))

    def log_post(theta: np.ndarray) -> float:
        a, b, c_s, c_c, log_s, z_rho = theta
        sigma = float(np.exp(log_s))
        rho = float(np.tanh(z_rho))
        if sigma < 1e-4 or sigma > 25.0 or abs(rho) > 0.96:
            return -np.inf

        lp = (
            -0.5 * (a / 3.0) ** 2
            - 0.5 * (b / 3.0) ** 2
            - 0.5 * (c_s / 3.0) ** 2
            - 0.5 * (c_c / 3.0) ** 2
            - 0.5 * (log_s / 1.8) ** 2
            - 0.5 * (z_rho / 1.2) ** 2
        )

        mu = a + b * x_std + c_s * sin_ann + c_c * cos_ann
        res = y_std - mu
        lp += -0.5 * (nu + 1.0) * float(np.log1p((res[0] / sigma) ** 2 / nu)) - float(np.log(sigma))

        rho_dt = np.sign(rho) * (np.abs(rho) ** dt_steps)
        innov_scale = sigma * np.sqrt(np.maximum(1e-6, 1.0 - rho_dt ** 2))
        innov = res[1:] - rho_dt * res[:-1]
        lp += float(
            np.sum(
                -0.5 * (nu + 1.0) * np.log1p((innov / innov_scale) ** 2 / nu)
                - np.log(innov_scale)
            )
        )
        return lp

    total_iters = burn_in + draws
    rng = np.random.default_rng(seed)
    n_params = 6

    a_chains = np.zeros((chains, draws))
    b_year_chains = np.zeros((chains, draws))
    b_dec_chains = np.zeros((chains, draws))
    sigma_chains = np.zeros((chains, draws))
    rho_chains = np.zeros((chains, draws))
    accept_rates = []

    for c in range(chains):
        theta = np.array(
            [
                float(ols_beta[0]) + rng.normal(0.0, 0.05),
                float(ols_beta[1]) + rng.normal(0.0, 0.05),
                float(ols_beta[2]) + rng.normal(0.0, 0.05),
                float(ols_beta[3]) + rng.normal(0.0, 0.05),
                np.log(init_sigma) + rng.normal(0.0, 0.08),
                0.15 + rng.normal(0.0, 0.10),
            ],
            dtype=float,
        )
        steps = np.full(n_params, 0.08, dtype=float)
        curr_lp = log_post(theta)
        accepted_updates = 0
        total_updates = draws * n_params

        for it in range(total_iters):
            for p_idx in range(n_params):
                prop = theta.copy()
                prop[p_idx] += rng.normal(0.0, steps[p_idx])
                prop_lp = log_post(prop)
                acc_prob = min(1.0, float(np.exp(min(0.0, prop_lp - curr_lp)))) if np.isfinite(prop_lp) else 0.0
                if np.log(rng.uniform()) < (prop_lp - curr_lp):
                    theta = prop
                    curr_lp = prop_lp
                    if it >= burn_in:
                        accepted_updates += 1
                if it < burn_in:
                    steps[p_idx] *= np.exp(0.04 * (acc_prob - 0.35))
                    steps[p_idx] = float(np.clip(steps[p_idx], 0.005, 0.6))

            if it >= burn_in:
                idx = it - burn_in
                slope_per_yr = theta[1] * (y_sd / t_sd)
                intercept_phys = y_mean + y_sd * theta[0] - slope_per_yr * t_mean
                a_chains[c, idx] = intercept_phys
                b_year_chains[c, idx] = slope_per_yr
                b_dec_chains[c, idx] = slope_per_yr * 10.0
                sigma_chains[c, idx] = float(np.exp(theta[4]) * y_sd)
                rho_chains[c, idx] = float(np.tanh(theta[5]))

        accept_rates.append(accepted_updates / total_updates)

    flat_a = a_chains.reshape(-1)
    flat_b = b_year_chains.reshape(-1)
    prob_pos = float(np.mean(flat_b > 0.0))

    sub_idx = rng.choice(len(flat_b), size=min(400, len(flat_b)), replace=False)
    lines = flat_a[sub_idx, None] + flat_b[sub_idx, None] * t_years[None, :]
    mean_line = np.mean(lines, axis=0)
    low_95 = np.percentile(lines, 2.5, axis=0)
    high_95 = np.percentile(lines, 97.5, axis=0)
    low_50 = np.percentile(lines, 25.0, axis=0)
    high_50 = np.percentile(lines, 75.0, axis=0)

    stride = max(1, draws // 160)
    traces = [
        [round(float(val), 5) for val in b_dec_chains[c, ::stride]]
        for c in range(chains)
    ]

    return {
        "model_type": "robust_ar1",
        "model_description": "Bayesian Student-t (df=5) Deseasonalized Linear Trend with Irregular-Gap AR(1) Persistence",
        "diagnostics": {
            "chains": chains,
            "draws_per_chain": draws,
            "burn_in": burn_in,
            "mean_acceptance_rate": round(float(np.mean(accept_rates)), 3),
            "converged": _split_rhat(b_year_chains) < 1.05,
        },
        "parameters": {
            "slope_per_year": _summarize_param(b_year_chains),
            "slope_per_decade": _summarize_param(b_dec_chains),
            "intercept": _summarize_param(a_chains),
            "sigma": _summarize_param(sigma_chains),
            "ar1_rho": _summarize_param(rho_chains),
        },
        "probability_of_direction": {
            "p_positive": round(prob_pos, 4),
            "p_negative": round(1.0 - prob_pos, 4),
            "direction": "increasing" if prob_pos >= 0.5 else "decreasing",
            "certainty": round(max(prob_pos, 1.0 - prob_pos), 4),
        },
        "posterior_histogram_decade": _histogram(b_dec_chains.reshape(-1)),
        "traces_slope_decade": traces,
        "predictive_trend": {
            "t_years": [round(float(x), 4) for x in t_years],
            "mean": [round(float(x), 4) for x in mean_line],
            "ci95_low": [round(float(x), 4) for x in low_95],
            "ci95_high": [round(float(x), 4) for x in high_95],
            "ci50_low": [round(float(x), 4) for x in low_50],
            "ci50_high": [round(float(x), 4) for x in high_50],
        },
    }


def _run_changepoint_mcmc(
    t_years: np.ndarray,
    y: np.ndarray,
    dates: list[str],
    *,
    chains: int,
    draws: int,
    burn_in: int,
    seed: int,
) -> dict:
    """Bayesian piecewise linear structural change-point model."""
    t_span = max(float(t_years[-1] - t_years[0]), 1e-6)
    t_rel = t_years - t_years[0]
    y_mean = float(np.mean(y))
    y_sd = max(float(np.std(y)), 1e-6)
    y_std = (y - y_mean) / y_sd
    t_norm = t_rel / t_span  # [0, 1]

    def log_post(theta: np.ndarray) -> float:
        a, b1, delta, u_tau, log_s = theta
        sigma = np.exp(log_s)
        tau = 0.12 + 0.76 / (1.0 + np.exp(-u_tau))  # bounded inside [0.12, 0.88]
        if sigma < 1e-4 or sigma > 25.0:
            return -np.inf
        lp = (
            -0.5 * (a / 3.0) ** 2
            - 0.5 * (b1 / 3.0) ** 2
            - 0.5 * (delta / 3.0) ** 2
            - 0.5 * (u_tau / 1.8) ** 2
            - 0.5 * (log_s / 1.5) ** 2
        )
        mu = a + b1 * t_norm + delta * np.maximum(0.0, t_norm - tau)
        n = len(y_std)
        lp += -n * np.log(sigma) - 0.5 * float(np.sum(((y_std - mu) / sigma) ** 2))
        return lp

    rng = np.random.default_rng(seed)
    total_iters = burn_in + draws

    b1_yr_chains = np.zeros((chains, draws))
    b2_yr_chains = np.zeros((chains, draws))
    delta_yr_chains = np.zeros((chains, draws))
    tau_yr_chains = np.zeros((chains, draws))
    tau_frac_chains = np.zeros((chains, draws))
    a_chains = np.zeros((chains, draws))
    sigma_chains = np.zeros((chains, draws))
    accept_rates = []

    for c in range(chains):
        theta = np.array([0.0, 0.0, 0.0, rng.normal(0.0, 0.4), np.log(0.6)])
        step = np.array([0.09, 0.12, 0.14, 0.18, 0.08])
        curr_lp = log_post(theta)
        accepted = 0

        for it in range(total_iters):
            prop = theta + rng.normal(0.0, step)
            prop_lp = log_post(prop)
            if np.log(rng.uniform()) < (prop_lp - curr_lp):
                theta = prop
                curr_lp = prop_lp
                if it >= burn_in:
                    accepted += 1
            if it < burn_in:
                acc_prob = min(1.0, float(np.exp(min(0.0, prop_lp - curr_lp))))
                step *= np.exp(0.03 * (acc_prob - 0.28))
                step = np.clip(step, 0.008, 0.9)
            if it >= burn_in:
                idx = it - burn_in
                tau_frac = float(0.12 + 0.76 / (1.0 + np.exp(-theta[3])))
                b1_yr = float(theta[1] * y_sd / t_span)
                delta_yr = float(theta[2] * y_sd / t_span)
                a_chains[c, idx] = float(y_mean + y_sd * theta[0])
                b1_yr_chains[c, idx] = b1_yr
                delta_yr_chains[c, idx] = delta_yr
                b2_yr_chains[c, idx] = b1_yr + delta_yr
                tau_frac_chains[c, idx] = tau_frac
                tau_yr_chains[c, idx] = float(tau_frac * t_span)
                sigma_chains[c, idx] = float(np.exp(theta[4]) * y_sd)
        accept_rates.append(accepted / draws)

    flat_a = a_chains.reshape(-1)
    flat_b1 = b1_yr_chains.reshape(-1)
    flat_delta = delta_yr_chains.reshape(-1)
    flat_tau_yr = tau_yr_chains.reshape(-1)
    prob_shift_pos = float(np.mean(flat_delta > 0.0))

    sub_idx = rng.choice(len(flat_b1), size=min(400, len(flat_b1)), replace=False)
    lines = (
        flat_a[sub_idx, None]
        + flat_b1[sub_idx, None] * t_rel[None, :]
        + flat_delta[sub_idx, None] * np.maximum(0.0, t_rel[None, :] - flat_tau_yr[sub_idx, None])
    )

    tau_med_frac = float(np.median(tau_frac_chains))
    tau_idx = int(np.clip(round(tau_med_frac * (len(dates) - 1)), 0, len(dates) - 1))
    stride = max(1, draws // 160)

    return {
        "model_type": "changepoint",
        "model_description": "Bayesian Piecewise Hinge Change-Point Model (Pre-Shift Slope + Slope Acceleration)",
        "diagnostics": {
            "chains": chains,
            "draws_per_chain": draws,
            "burn_in": burn_in,
            "mean_acceptance_rate": round(float(np.mean(accept_rates)), 3),
            "converged": _split_rhat(delta_yr_chains) < 1.06 and _split_rhat(tau_frac_chains) < 1.08,
        },
        "parameters": {
            "pre_slope_per_year": _summarize_param(b1_yr_chains),
            "post_slope_per_year": _summarize_param(b2_yr_chains),
            "slope_shift_per_year": _summarize_param(delta_yr_chains),
            "changepoint_fraction": _summarize_param(tau_frac_chains),
            "sigma": _summarize_param(sigma_chains),
        },
        "estimated_changepoint_date": dates[tau_idx],
        "estimated_changepoint_index": tau_idx,
        "probability_of_direction": {
            "p_positive": round(prob_shift_pos, 4),
            "p_negative": round(1.0 - prob_shift_pos, 4),
            "direction": "accelerating" if prob_shift_pos >= 0.5 else "decelerating",
            "certainty": round(max(prob_shift_pos, 1.0 - prob_shift_pos), 4),
        },
        "posterior_histogram_decade": _histogram(delta_yr_chains.reshape(-1) * 10.0),
        "traces_slope_decade": [
            [round(float(v * 10.0), 5) for v in delta_yr_chains[c, ::stride]]
            for c in range(chains)
        ],
        "predictive_trend": {
            "t_years": [round(float(x), 4) for x in t_rel],
            "mean": [round(float(x), 4) for x in np.mean(lines, axis=0)],
            "ci95_low": [round(float(x), 4) for x in np.percentile(lines, 2.5, axis=0)],
            "ci95_high": [round(float(x), 4) for x in np.percentile(lines, 97.5, axis=0)],
            "ci50_low": [round(float(x), 4) for x in np.percentile(lines, 25.0, axis=0)],
            "ci50_high": [round(float(x), 4) for x in np.percentile(lines, 75.0, axis=0)],
        },
    }


def run_bayesian_mcmc(
    dates: list[str],
    values: list[Optional[float]],
    *,
    model_type: Literal["robust_ar1", "changepoint"] = "robust_ar1",
    chains: int = 3,
    draws: int = 900,
    burn_in: int = 450,
    seed: int = 42,
) -> dict:
    """Run Bayesian MCMC on an environmental time series (ignoring missing slots while preserving time spacing)."""
    if len(dates) != len(values):
        raise ValueError("dates and values must match in length.")

    valid_idx = [i for i, v in enumerate(values) if v is not None and np.isfinite(float(v))]
    if len(valid_idx) < 12:
        raise ValueError(f"At least 12 valid observations are required for Bayesian MCMC (got {len(valid_idx)}).")

    t_years = np.array([i / 12.0 for i in valid_idx], dtype=float)
    y = np.array([float(values[i]) for i in valid_idx], dtype=float)
    valid_dates = [dates[i] for i in valid_idx]

    if model_type == "changepoint":
        res = _run_changepoint_mcmc(
            t_years,
            y,
            valid_dates,
            chains=chains,
            draws=draws,
            burn_in=burn_in,
            seed=seed,
        )
    else:
        res = _run_robust_ar1_mcmc(
            t_years,
            y,
            chains=chains,
            draws=draws,
            burn_in=burn_in,
            seed=seed,
        )

    res["n_total"] = len(values)
    res["n_valid"] = len(valid_idx)
    res["n_missing"] = len(values) - len(valid_idx)
    res["valid_dates"] = valid_dates
    res["observed_valid"] = [round(float(v), 4) for v in y]
    return res
