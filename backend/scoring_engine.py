import math
import os
import joblib
import pandas as pd
import numpy as np


# ─── Profile-Linking Boost ───────────────────────────────────────────────────
# Each connected external profile lifts the placement-probability prediction by
# a capped amount. Weights are intentionally conservative (max +15pp total) so
# the model never over-rewards self-reported signals over the trained features.
PROFILE_MAX_BOOST_PP = 15.0

def compute_profile_boost(linked_profiles: dict | None) -> tuple[float, list[str]]:
    """Returns (boost_pp, reasons) where boost_pp ∈ [0, 15] and reasons is a
    human-readable list of what contributed. linked_profiles shape:
      { "github":   {"profile_score": 0..100, ...},
        "linkedin": {"profile_score": 0..100, ...},
        "naukri":   {"profile_score": 0..100, ...} }
    Per-provider weights (max contribution): GitHub 8pp, LinkedIn 5pp, Naukri 2pp.
    """
    if not linked_profiles:
        return 0.0, []

    weights = {"github": 8.0, "linkedin": 5.0, "naukri": 2.0}
    boost = 0.0
    reasons = []
    for provider, profile in linked_profiles.items():
        if not isinstance(profile, dict):
            continue
        score = float(profile.get("profile_score", 0))
        contrib = round(weights.get(provider, 0) * (score / 100.0), 2)
        if contrib > 0:
            boost += contrib
            reasons.append(f"{provider.title()} profile ({int(score)}/100) → +{contrib}pp")
    boost = min(boost, PROFILE_MAX_BOOST_PP)
    return round(boost, 2), reasons

# Preference order matches the admin Data Provenance card:
# `combined` has the salary-scale fix (synthetic ×12 + AMCAT annual) so it must
# win over the synthetic-only baseline whose salary head is 12× too low.
_VARIANT_PREFERENCE = ['-combined', '-amcat', '']


def _pick_variant(models_dir: str) -> str:
    for suffix in _VARIANT_PREFERENCE:
        if os.path.exists(f'{models_dir}/placement_classifier{suffix}.pkl'):
            return suffix
    raise FileNotFoundError(
        f"No trained model variant found in {models_dir}/. "
        f"Run `python model_pipeline.py --source combined` first."
    )


class ScoringEngine:
    def __init__(self, models_dir='models'):
        suffix = _pick_variant(models_dir)
        self.variant = suffix or 'synthetic'
        self.clf = joblib.load(f'{models_dir}/placement_classifier{suffix}.pkl')
        self.reg = joblib.load(f'{models_dir}/salary_regressor{suffix}.pkl')
        self.encoders = joblib.load(f'{models_dir}/encoders{suffix}.pkl')
        self.explainer = joblib.load(f'{models_dir}/shap_explainer{suffix}.pkl')
        print(f"[ScoringEngine] Loaded variant: {self.variant}")

        self.features = [
            'course_type', 'institute_tier', 'region', 'cgpa', 'internship_months',
            'employer_tier', 'iqi', 'behavioral_activity_score', 'field_demand_score', 'macro_climate_index'
        ]

        # Intervention delta table (feature perturbations per intervention type)
        self.intervention_deltas = {
            "Complete Python/Data Analytics Certification": {"iqi": 0.1, "behavioral_activity_score": 10},
            "Attend 3 Mock Interviews": {"behavioral_activity_score": 15},
            "Secure a 2-Month Internship": {"internship_months": 2, "iqi": 0.15},
            "Resume Coaching Session": {"behavioral_activity_score": 8},
            "Domain Certification (Finance/HR)": {"iqi": 0.12, "behavioral_activity_score": 10},
        }
        self.intervention_costs = {
            "Complete Python/Data Analytics Certification": 2000,
            "Attend 3 Mock Interviews": 500,
            "Secure a 2-Month Internship": 0,
            "Resume Coaching Session": 1000,
            "Domain Certification (Finance/HR)": 3500,
        }

    def _safe_float(self, val):
        """Convert any value to a JSON-safe float."""
        if val is None or (isinstance(val, float) and (math.isnan(val) or math.isinf(val))):
            return 0.0
        return float(val)

    def _safe_int(self, val):
        """Convert any value to a JSON-safe int."""
        f = self._safe_float(val)
        return int(f)

    def _preprocess(self, data: dict) -> pd.DataFrame:
        df = pd.DataFrame([data])
        for col, le in self.encoders.items():
            if col in df.columns:
                try:
                    df[col] = le.transform(df[col])
                except ValueError:
                    df[col] = 0  # Fallback for unseen categories
        return df[self.features]

    def _get_shap_drivers(self, df: pd.DataFrame):
        shap_values = self.explainer(df)

        # Handle different SHAP output shapes:
        # Binary XGBoost may return shape (n_samples, n_features) or (n_samples, n_features, 2)
        vals_raw = shap_values.values
        if vals_raw.ndim == 3:
            # Take the positive class (index 1)
            vals = vals_raw[0, :, 1]
        else:
            vals = vals_raw[0]

        feature_importance = list(zip(self.features, vals))
        feature_importance.sort(key=lambda x: abs(x[1]), reverse=True)

        top_drivers = []
        for feature, value in feature_importance[:3]:
            impact = "Positive" if value > 0 else "Negative"
            readable = feature.replace('_', ' ').title()
            top_drivers.append({
                "feature": feature,
                "readable_name": readable,
                "shap_value": round(float(value), 4),
                "impact_direction": impact,
                "description": self._explain_driver(feature, value, self._safe_float(df[feature].iloc[0]))
            })
        return top_drivers

    def _explain_driver(self, feature: str, shap_val: float, raw_val: float) -> str:
        """Generate a human-readable explanation for a SHAP driver."""
        direction = "boosted" if shap_val > 0 else "reduced"
        descriptions = {
            "cgpa": f"CGPA of {raw_val:.1f} {direction} placement probability.",
            "iqi": f"Internship Quality Index of {raw_val:.2f} {direction} placement chances.",
            "behavioral_activity_score": f"Portal activity score of {raw_val:.0f}/100 {direction} the prediction.",
            "field_demand_score": f"Field demand of {raw_val:.0f}/100 {direction} job market odds.",
            "internship_months": f"{raw_val:.0f} months of internship experience {direction} the score.",
            "macro_climate_index": f"Macro climate index of {raw_val:.2f} {direction} sector outlook.",
            "institute_tier": f"Institute tier {direction} placement probability.",
            "course_type": f"Course type {direction} industry demand alignment.",
            "region": f"Region-level demand {direction} placement outlook.",
            "employer_tier": f"Internship employer quality {direction} the profile score.",
        }
        return descriptions.get(feature, f"{feature.replace('_', ' ').title()} {direction} the score.")

    def _calculate_emi_comfort(self, expected_salary: float, monthly_emi: float) -> float:
        if monthly_emi <= 0:
            return 99.0
        monthly_salary = expected_salary / 12
        return round(monthly_salary / monthly_emi, 2)

    def _determine_risk_band(self, probability: float, emi_comfort: float, data: dict) -> str:
        # Hard override rules (from PRD 12.2)
        if self._safe_float(data.get('cgpa', 10)) < 5.0 and self._safe_int(data.get('internship_months', 1)) == 0:
            return "HIGH"
        if emi_comfort < 1.0 and emi_comfort != 99.0:
            return "HIGH"
        if self._safe_float(data.get('macro_climate_index', 1.0)) < 0.2:
            return "HIGH"

        # Probability-based classification
        if probability >= 0.70:
            return "LOW"
        elif probability >= 0.45:
            return "MEDIUM"
        else:
            return "HIGH"

    def _get_nba(self, risk_band: str, emi_comfort: float, data: dict) -> list:
        actions = []
        iqi = self._safe_float(data.get('iqi', 0.5))
        activity = self._safe_int(data.get('behavioral_activity_score', 50))

        if risk_band == "HIGH":
            actions.append({
                "action": "Assign Case Manager",
                "priority": "P0",
                "description": "High risk of EMI default detected. Case manager must be assigned within 48 hours.",
                "estimated_impact": "Reduces default probability by 15-20%"
            })
            if emi_comfort < 1.2 and emi_comfort != 99.0:
                actions.append({
                    "action": "Review EMI Grace Period",
                    "priority": "P0",
                    "description": "Expected salary does not cover EMI. Consider 3-6 month grace period extension.",
                    "estimated_impact": "Prevents technical default at EMI start"
                })
            if iqi < 0.1:
                actions.append({
                    "action": "Emergency Internship Placement",
                    "priority": "P1",
                    "description": "Zero internship experience is a critical gap. Facilitate placement via lender's institute network.",
                    "estimated_impact": "+12pp placement probability"
                })
        elif risk_band == "MEDIUM":
            if iqi < 0.2:
                actions.append({
                    "action": "Skill-up Certification Nudge",
                    "priority": "P1",
                    "description": "Send curated short-course recommendations (Python, Data Analytics, Finance). Low cost, high ROI.",
                    "estimated_impact": "+8pp placement probability"
                })
            if activity < 40:
                actions.append({
                    "action": "Behavioral Engagement Push",
                    "priority": "P1",
                    "description": "Student has low job-portal activity. Trigger automated nudge emails and RM call.",
                    "estimated_impact": "+5pp placement probability"
                })
            actions.append({
                "action": "Monthly RM Check-in",
                "priority": "P2",
                "description": "Schedule a monthly check-in call. Monitor progress against 6-month placement goal.",
                "estimated_impact": "Maintains or improves current trajectory"
            })
        else:
            actions.append({
                "action": "Monitor Only",
                "priority": "P3",
                "description": "Student is on track. Continue standard quarterly monitoring. No active intervention needed.",
                "estimated_impact": "Maintain current LOW risk status"
            })

        return actions

    def _calculate_confidence(self, data: dict) -> dict:
        score = 95
        reasons = []
        if self._safe_int(data.get('internship_months', -1)) == 0:
            score -= 10
            reasons.append("No internship data — prediction assumes no experience")
        if self._safe_int(data.get('behavioral_activity_score', 50)) < 10:
            score -= 15
            reasons.append("Very low portal activity — behavioral signal is weak")
        if self._safe_float(data.get('field_demand_score', 50)) == 50.0:
            score -= 5
            reasons.append("Field demand using default value — live data not connected")

        return {
            "score": score,
            "rating": "High" if score >= 80 else "Medium" if score >= 60 else "Low",
            "data_gaps": reasons
        }

    def _compute_peer_percentile(self, data: dict, prob: float) -> dict:
        """
        Simple mock peer benchmarking using the known distribution from training data.
        In production, this would query the feature store for the peer cohort.
        """
        tier = data.get('institute_tier', 'B')
        course = data.get('course_type', 'Engineering')

        # Synthetic cohort medians derived from training data distributions
        cohort_median_map = {
            ('Engineering', 'A'): 0.72, ('Engineering', 'B'): 0.58, ('Engineering', 'C'): 0.42, ('Engineering', 'D'): 0.30,
            ('MBA', 'A'): 0.68, ('MBA', 'B'): 0.55, ('MBA', 'C'): 0.40, ('MBA', 'D'): 0.28,
            ('Nursing', 'A'): 0.65, ('Nursing', 'B'): 0.52, ('Nursing', 'C'): 0.38, ('Nursing', 'D'): 0.25,
        }
        cohort_median = cohort_median_map.get((course, tier), 0.50)
        cohort_top_quartile = round(cohort_median * 1.25, 2)

        # Estimate percentile
        std_dev = 0.15
        z = (prob - cohort_median) / std_dev
        # Use a simplified normal CDF approximation
        import math
        percentile = round(50 * (1 + math.erf(z / math.sqrt(2))), 0)

        return {
            "cohort": f"{course} · Tier-{tier}",
            "student_probability": round(prob, 2),
            "cohort_median": cohort_median,
            "cohort_top_quartile": min(cohort_top_quartile, 0.99),
            "student_percentile": int(percentile),
            "percentile_label": f"Top {100 - int(percentile)}%" if percentile >= 50 else f"Bottom {int(percentile)}%"
        }

    def simulate_intervention(self, data: dict, intervention_name: str) -> dict:
        """Simulate the effect of an intervention and compute ROI."""
        if intervention_name not in self.intervention_deltas:
            return {"error": f"Unknown intervention: {intervention_name}"}

        # Current score
        df_current = self._preprocess(data)
        prob_before = float(self.clf.predict_proba(df_current)[0][1])
        band_before = self._determine_risk_band(prob_before, 0, data)

        # Apply delta
        data_modified = data.copy()
        for feature, delta in self.intervention_deltas[intervention_name].items():
            current_val = self._safe_float(data_modified.get(feature, 0))
            if feature == 'behavioral_activity_score':
                data_modified[feature] = min(100, int(current_val + delta))
            elif feature == 'internship_months':
                data_modified[feature] = int(current_val + delta)
                # Recompute IQI with new months
                data_modified['iqi'] = min(1.0, round(self._safe_float(data_modified.get('iqi', 0)) + 0.1, 3))
            else:
                data_modified[feature] = min(1.0, round(current_val + delta, 3))

        df_modified = self._preprocess(data_modified)
        prob_after = float(self.clf.predict_proba(df_modified)[0][1])
        band_after = self._determine_risk_band(prob_after, 0, data_modified)

        prob_delta = round((prob_after - prob_before) * 100, 1)
        cost = self.intervention_costs.get(intervention_name, 0)
        avg_recovery_cost = 180000  # ₹1.8L per PRD
        default_risk_reduction = round(abs(prob_after - prob_before) * 0.5, 3)
        expected_value = round(default_risk_reduction * avg_recovery_cost, 0)
        roi = round(expected_value / cost, 1) if cost > 0 else 999.0

        return {
            "intervention": intervention_name,
            "cost_inr": cost,
            "probability_before": round(prob_before, 2),
            "probability_after": round(prob_after, 2),
            "probability_delta_pp": prob_delta,
            "risk_band_before": band_before,
            "risk_band_after": band_after,
            "expected_value_inr": int(expected_value),
            "roi": roi,
            "recommended": prob_delta > 5
        }

    def score_student(self, data: dict) -> dict:
        # Sanitize all numeric inputs to avoid NaN propagation
        for field in ['cgpa', 'iqi', 'behavioral_activity_score', 'field_demand_score', 'macro_climate_index', 'monthly_emi', 'internship_months', 'actual_salary']:
            if field in data:
                data[field] = self._safe_float(data[field])
                if field in ['behavioral_activity_score', 'internship_months', 'monthly_emi']:
                    data[field] = int(data[field])

        df = self._preprocess(data)

        # Predictions
        prob_6m = float(self.clf.predict_proba(df)[0][1])
        # Approximate 3m and 12m (simplified offsets for prototype)
        prob_3m = max(0.0, min(1.0, prob_6m * 0.6))
        prob_12m = max(0.0, min(1.0, prob_6m * 1.3))

        salary_raw = float(self.reg.predict(df)[0])
        salary_median = max(0, self._safe_int(round(salary_raw, -3)))
        salary_low = max(0, self._safe_int(round(salary_raw * 0.80, -3)))   # ~20% below median
        salary_high = max(0, self._safe_int(round(salary_raw * 1.25, -3)))  # ~25% above median

        emi_comfort = self._calculate_emi_comfort(salary_median, data.get('monthly_emi', 0))
        risk_band = self._determine_risk_band(prob_6m, emi_comfort, data)
        confidence = self._calculate_confidence(data)
        shap_drivers = self._get_shap_drivers(df)
        nba = self._get_nba(risk_band, emi_comfort, data)
        peer = self._compute_peer_percentile(data, prob_6m)

        return {
            "student_id": data.get("student_id", "UNKNOWN"),
            "prediction": {
                "placement_probability": {
                    "3m": round(prob_3m, 2),
                    "6m": round(prob_6m, 2),
                    "12m": round(prob_12m, 2),
                },
                "expected_salary": salary_median,
                "salary_estimate": {
                    "low": salary_low,
                    "median": salary_median,
                    "high": salary_high,
                    "currency": "INR"
                },
                "risk_band": risk_band
            },
            "explainability": {
                "top_drivers": shap_drivers,
                "confidence": confidence
            },
            "insights": {
                "emi_comfort_index": emi_comfort,
                "peer_benchmark": peer,
                "recommended_nba": nba
            }
        }
