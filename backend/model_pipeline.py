import pandas as pd
import numpy as np
import xgboost as xgb
import lightgbm as lgb
import joblib
import shap
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import f1_score, accuracy_score, mean_absolute_percentage_error
import os

def train_models():
    print("Loading data...")
    df = pd.read_csv('data/synthetic_students.csv')
    
    # Feature Engineering & Preprocessing
    features = ['course_type', 'institute_tier', 'region', 'cgpa', 'internship_months', 
                'employer_tier', 'iqi', 'behavioral_activity_score', 'field_demand_score', 'macro_climate_index']
    
    X = df[features].copy()
    
    # Label encoding for categorical variables
    encoders = {}
    cat_cols = ['course_type', 'institute_tier', 'region', 'employer_tier']
    for col in cat_cols:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col])
        encoders[col] = le
        
    os.makedirs('models', exist_ok=True)
    joblib.dump(encoders, 'models/encoders.pkl')
    
    print("Training Classification Model (6m Placement Risk)...")
    y_class = df['placed_6m']
    X_train_c, X_test_c, y_train_c, y_test_c = train_test_split(X, y_class, test_size=0.2, random_state=42)
    
    # XGBoost Classifier
    clf = xgb.XGBClassifier(
        n_estimators=100, 
        learning_rate=0.1, 
        max_depth=4, 
        random_state=42,
        eval_metric='logloss'
    )
    clf.fit(X_train_c, y_train_c)
    
    # Eval
    preds_c = clf.predict(X_test_c)
    print(f"Classification F1 (6m): {f1_score(y_test_c, preds_c):.3f}")
    print(f"Classification Accuracy (6m): {accuracy_score(y_test_c, preds_c):.3f}")
    
    joblib.dump(clf, 'models/placement_classifier.pkl')
    
    print("\nTraining Salary Regression Model...")
    # Only train on those who were eventually placed and have a salary
    placed_mask = df['actual_salary'] > 0
    X_reg = X[placed_mask]
    y_reg = df[placed_mask]['actual_salary']
    
    X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(X_reg, y_reg, test_size=0.2, random_state=42)
    
    # LightGBM Regressor
    reg = lgb.LGBMRegressor(
        n_estimators=150,
        learning_rate=0.05,
        max_depth=5,
        random_state=42,
        objective='regression'
    )
    reg.fit(X_train_r, y_train_r)
    
    preds_r = reg.predict(X_test_r)
    mape = mean_absolute_percentage_error(y_test_r, preds_r)
    print(f"Salary Regression MAPE: {mape:.1%}")
    
    joblib.dump(reg, 'models/salary_regressor.pkl')
    
    # Setup SHAP Explainer (TreeExplainer for XGBoost)
    print("\nPre-computing SHAP Explainer...")
    explainer = shap.TreeExplainer(clf)
    joblib.dump(explainer, 'models/shap_explainer.pkl')
    
    print("Training pipeline complete! Models saved in models/ directory.")

if __name__ == "__main__":
    train_models()
