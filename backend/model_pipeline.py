"""
Train the placement classifier + salary regressor + SHAP explainer.

Two source modes:
  --source synthetic   (default) — reads data/synthetic_students.csv,
                                   writes models/{placement_classifier, salary_regressor, shap_explainer, encoders}.pkl
  --source amcat                — reads data/amcat_mapped.csv,
                                   writes models/{placement_classifier-amcat, salary_regressor-amcat,
                                                  shap_explainer-amcat, encoders-amcat}.pkl
                                   so the synthetic baseline stays intact for A/B comparison.

After a run, model_provenance.json is written alongside the .pkl files with
row counts, F1 / MAPE, and timestamp for the /api/v1/model/data-provenance endpoint.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_percentage_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder


FEATURES = [
    'course_type', 'institute_tier', 'region', 'cgpa', 'internship_months',
    'employer_tier', 'iqi', 'behavioral_activity_score', 'field_demand_score',
    'macro_climate_index',
]
CAT_COLS = ['course_type', 'institute_tier', 'region', 'employer_tier']

SOURCE_PATHS = {
    'synthetic': 'data/synthetic_students.csv',
    'amcat':     'data/amcat_mapped.csv',
    # combined is built at training time from the two above; no file on disk
    'combined':  None,
}

# All `synthetic` artefacts use the original filenames so the running API
# (which loads `placement_classifier.pkl` by default) keeps working.
# `amcat` + `combined` modes write parallel `*-<source>.pkl` files we can A/B against.
SUFFIX = {'synthetic': '', 'amcat': '-amcat', 'combined': '-combined'}


def _load_combined() -> pd.DataFrame:
    """
    Stack AMCAT + synthetic into one frame.

    Salary-unit reconciliation: the synthetic generator emits values that are
    really *monthly* INR (Engineering base 40K, ×tier ×cgpa ×iqi) but the
    scoring engine treats `actual_salary` as *annual*. AMCAT's Salary column
    is annual CTC. To put both on one scale we annualize synthetic by ×12.
    The `*-combined` model therefore predicts annual salary correctly for
    both subspaces, where the synthetic-only model is off by 12×.

    Also tags each row with `_origin` so we can report mix stats in provenance.
    """
    syn_path = SOURCE_PATHS['synthetic']
    amc_path = SOURCE_PATHS['amcat']
    if not os.path.exists(syn_path):
        raise SystemExit(f"!! Missing {syn_path}. Run `python data_generator.py` first.")
    if not os.path.exists(amc_path):
        raise SystemExit(f"!! Missing {amc_path}. Run `python amcat_mapper.py` first.")

    syn = pd.read_csv(syn_path)
    amc = pd.read_csv(amc_path)

    # Annualize synthetic salary so it shares AMCAT's INR/year scale
    syn['actual_salary'] = (syn['actual_salary'] * 12).astype(int)

    syn['_origin'] = 'synthetic'
    amc['_origin'] = 'amcat'

    common = [c for c in syn.columns if c in amc.columns]
    out = pd.concat([syn[common], amc[common]], ignore_index=True)
    return out


def train_models(source: str = 'synthetic') -> dict:
    suffix = SUFFIX[source]

    if source == 'combined':
        print("Loading combined corpus (AMCAT + annualized synthetic) ...")
        df = _load_combined()
        src_label = 'AMCAT (3,753) + synthetic-annualized (10,000)'
    else:
        src_path = SOURCE_PATHS[source]
        print(f"Loading data from {src_path} (source={source}) ...")
        df = pd.read_csv(src_path)
        src_label = src_path

    # Drop any rows that lack the bare minimum we need
    df = df.dropna(subset=['placed_6m', 'cgpa']).copy()
    df['placed_6m']  = df['placed_6m'].astype(int)
    df['placed_3m']  = df['placed_3m'].astype(int)
    df['placed_12m'] = df['placed_12m'].astype(int)

    X = df[FEATURES].copy()

    # ── Encode categoricals ────────────────────────────────────────────
    encoders = {}
    for col in CAT_COLS:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str))
        encoders[col] = le

    os.makedirs('models', exist_ok=True)
    joblib.dump(encoders, f'models/encoders{suffix}.pkl')

    # ── Classification (3m / 6m / 12m placement) ───────────────────────
    # One XGBoost classifier per horizon so each timeline prediction is learned
    # from its own label rather than scaled from the 6m score. The 6m model is
    # the primary risk score: the SHAP explainer is built on it and it keeps the
    # legacy `placement_classifier{suffix}.pkl` filename for backward compat.
    horizon_labels = {'3m': 'placed_3m', '6m': 'placed_6m', '12m': 'placed_12m'}
    horizon_files = {
        '3m':  f'models/placement_classifier_3m{suffix}.pkl',
        '6m':  f'models/placement_classifier{suffix}.pkl',   # legacy/primary name
        '12m': f'models/placement_classifier_12m{suffix}.pkl',
    }
    classifiers = {}
    horizon_metrics = {}
    for horizon, label_col in horizon_labels.items():
        print(f"Training XGBoost classifier ({horizon} placement) …")
        y_h = df[label_col]
        Xh_tr, Xh_te, yh_tr, yh_te = train_test_split(X, y_h, test_size=0.2, random_state=42)
        model = xgb.XGBClassifier(
            n_estimators=100, learning_rate=0.1, max_depth=4,
            random_state=42, eval_metric='logloss',
        )
        model.fit(Xh_tr, yh_tr)
        preds_h = model.predict(Xh_te)
        f1_h  = float(f1_score(yh_te, preds_h, zero_division=0))
        acc_h = float(accuracy_score(yh_te, preds_h))
        print(f"  [{horizon}] F1: {f1_h:.3f}  Acc: {acc_h:.3f}")
        joblib.dump(model, horizon_files[horizon])
        classifiers[horizon] = model
        horizon_metrics[horizon] = {'f1': round(f1_h, 3), 'acc': round(acc_h, 3)}

    # 6m is the primary model — reused for SHAP and headline provenance metrics.
    clf = classifiers['6m']
    f1  = horizon_metrics['6m']['f1']
    acc = horizon_metrics['6m']['acc']

    # ── Regression (salary, only for placed students with positive salary) ──
    print("\nTraining LightGBM regressor (salary) …")
    placed_mask = df['actual_salary'] > 0
    X_reg = X[placed_mask]
    y_reg = df.loc[placed_mask, 'actual_salary']

    mape = float('nan')
    if len(X_reg) >= 20:
        Xr_tr, Xr_te, yr_tr, yr_te = train_test_split(X_reg, y_reg, test_size=0.2, random_state=42)
        reg = lgb.LGBMRegressor(
            n_estimators=150, learning_rate=0.05, max_depth=5,
            random_state=42, objective='regression', verbose=-1,
        )
        reg.fit(Xr_tr, yr_tr)
        preds_r = reg.predict(Xr_te)
        mape = float(mean_absolute_percentage_error(yr_te, preds_r))
        print(f"  MAPE: {mape:.1%}")
        joblib.dump(reg, f'models/salary_regressor{suffix}.pkl')
    else:
        print(f"  WARN: only {len(X_reg)} placed rows — skipping regressor.")

    # ── SHAP explainer ─────────────────────────────────────────────────
    print("\nPre-computing SHAP explainer …")
    explainer = shap.TreeExplainer(clf)
    joblib.dump(explainer, f'models/shap_explainer{suffix}.pkl')

    # ── Provenance ─────────────────────────────────────────────────────
    placed_salaries = df.loc[placed_mask, 'actual_salary'] if placed_mask.any() else pd.Series([], dtype=int)
    provenance = {
        'source':            source,
        'source_path':       src_label,
        'row_count':         int(len(df)),
        'placed_3m_rate':    float(df['placed_3m'].mean()),
        'placed_6m_rate':    float(df['placed_6m'].mean()),
        'placed_12m_rate':   float(df['placed_12m'].mean()),
        'median_salary_inr': int(placed_salaries.median()) if len(placed_salaries) else 0,
        'classifier_f1_6m':  round(f1, 3),
        'classifier_acc_6m': round(acc, 3),
        'classifier_f1_by_horizon':  {h: m['f1'] for h, m in horizon_metrics.items()},
        'classifier_acc_by_horizon': {h: m['acc'] for h, m in horizon_metrics.items()},
        'salary_mape':       None if np.isnan(mape) else round(mape, 3),
        'trained_at_utc':    datetime.now(timezone.utc).isoformat(),
        'model_files': {
            'classifier_3m':  f'placement_classifier_3m{suffix}.pkl',
            'classifier':     f'placement_classifier{suffix}.pkl',
            'classifier_12m': f'placement_classifier_12m{suffix}.pkl',
            'regressor':      f'salary_regressor{suffix}.pkl',
            'explainer':      f'shap_explainer{suffix}.pkl',
            'encoders':       f'encoders{suffix}.pkl',
        },
    }
    if '_origin' in df.columns:
        provenance['origin_mix'] = {k: int(v) for k, v in df['_origin'].value_counts().to_dict().items()}
    with open(f'models/model_provenance{suffix}.json', 'w') as fh:
        json.dump(provenance, fh, indent=2)

    print(f"\nDone. Models saved to models/ with suffix '{suffix or '(none)'}'")
    print(f"Provenance written to models/model_provenance{suffix}.json")
    return provenance


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Train PlacementIQ models')
    parser.add_argument('--source', choices=list(SOURCE_PATHS), default='synthetic',
                        help='Training data source. "amcat" requires running amcat_mapper.py first.')
    args = parser.parse_args(argv)

    # `combined` builds its corpus inside train_models (no single file to check)
    if args.source != 'combined' and not os.path.exists(SOURCE_PATHS[args.source]):
        raise SystemExit(
            f"!! Missing {SOURCE_PATHS[args.source]}. "
            + ("Run `python amcat_mapper.py` first." if args.source == 'amcat'
               else "Run `python data_generator.py` first."))

    train_models(args.source)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
