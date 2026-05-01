import pandas as pd
import numpy as np
import random
from faker import Faker
import os

fake = Faker('en_IN')

# Seed for reproducibility
np.random.seed(42)
random.seed(42)

def generate_student_data(num_records=10000):
    print(f"Generating {num_records} synthetic student records...")
    
    # Constants
    COURSES = ['Engineering', 'MBA', 'Nursing']
    INSTITUTE_TIERS = ['A', 'B', 'C', 'D']
    REGIONS = ['Mumbai', 'Bengaluru', 'Delhi NCR', 'Pune', 'Hyderabad', 'Chennai']
    SECTORS = ['IT', 'BFSI', 'Manufacturing', 'Healthcare']
    EMPLOYER_TIERS = ['MNC', 'Startup', 'SME', 'None']
    
    data = []
    
    for i in range(num_records):
        # Base Demographics & Academics
        course = random.choice(COURSES)
        tier = random.choice(INSTITUTE_TIERS)
        region = random.choice(REGIONS)
        
        # CGPA distributions based on tier (A is slightly higher average)
        if tier == 'A':
            cgpa = np.clip(np.random.normal(8.2, 0.8), 5.0, 10.0)
        elif tier == 'B':
            cgpa = np.clip(np.random.normal(7.5, 1.0), 5.0, 10.0)
        else:
            cgpa = np.clip(np.random.normal(6.8, 1.2), 4.0, 10.0)
            
        cgpa = round(cgpa, 2)
        
        # Internships
        has_internship = random.random() > (0.2 if tier in ['A', 'B'] else 0.5)
        internship_months = random.randint(1, 6) if has_internship else 0
        employer_tier = random.choice(EMPLOYER_TIERS[:-1]) if has_internship else 'None'
        
        # IQI (Internship Quality Index) computation as per PRD
        employer_weight = {'MNC': 1.0, 'Startup': 0.7, 'SME': 0.5, 'None': 0.0}[employer_tier]
        iqi = (internship_months * employer_weight * 0.9) / 12  # Assuming recency decay ~0.9
        
        # Behavioral & Environment
        behavioral_activity = np.clip(np.random.normal(60, 20), 0, 100) if tier in ['A', 'B'] else np.clip(np.random.normal(40, 25), 0, 100)
        field_demand = np.clip(np.random.normal(70, 15), 10, 100)
        macro_climate = np.clip(np.random.normal(0.6, 0.1), 0.1, 1.0)
        
        # Determine Placement Outcome (Hidden Logic)
        # Higher score = higher probability of quick placement
        placement_score = (
            (cgpa / 10.0) * 0.3 + 
            (1.0 if tier == 'A' else 0.8 if tier == 'B' else 0.5 if tier == 'C' else 0.3) * 0.2 +
            iqi * 0.2 + 
            (behavioral_activity / 100.0) * 0.1 + 
            (field_demand / 100.0) * 0.1 +
            macro_climate * 0.1
        )
        
        # Add some random noise
        placement_score += np.random.normal(0, 0.05)
        
        # Labels
        placed_3m = 0
        placed_6m = 0
        placed_12m = 0
        placed_ever = 0
        
        if placement_score > 0.75:
            placed_3m = 1
            placed_6m = 1
            placed_12m = 1
            placed_ever = 1
        elif placement_score > 0.60:
            placed_6m = 1
            placed_12m = 1
            placed_ever = 1
        elif placement_score > 0.45:
            placed_12m = 1
            placed_ever = 1
        elif placement_score > 0.35:
            # Placed > 12m or just unplaced, let's treat as placed eventually for salary
            placed_ever = 1
            
        # Salary logic (only if placed)
        actual_salary = 0
        if placed_ever:
            base_salary = {
                'Engineering': 40000,
                'MBA': 50000,
                'Nursing': 30000
            }[course]
            
            tier_multiplier = {'A': 1.8, 'B': 1.3, 'C': 1.0, 'D': 0.8}[tier]
            
            actual_salary = base_salary * tier_multiplier * (cgpa/7.0) * (1 + iqi)
            actual_salary += np.random.normal(0, actual_salary * 0.15) # 15% variance
            actual_salary = int(round(actual_salary, -3)) # Round to nearest 1000
        
        # Financials
        monthly_emi = random.choice([10000, 15000, 20000, 25000, 30000])
        
        data.append({
            'student_id': f"STU-2026-{str(i).zfill(5)}",
            'course_type': course,
            'institute_tier': tier,
            'region': region,
            'cgpa': cgpa,
            'internship_months': internship_months,
            'employer_tier': employer_tier,
            'iqi': round(iqi, 3),
            'behavioral_activity_score': round(behavioral_activity),
            'field_demand_score': round(field_demand),
            'macro_climate_index': round(macro_climate, 2),
            'monthly_emi': monthly_emi,
            'placed_3m': placed_3m,
            'placed_6m': placed_6m,
            'placed_12m': placed_12m,
            'actual_salary': actual_salary
        })
        
    df = pd.DataFrame(data)
    
    os.makedirs('data', exist_ok=True)
    filepath = 'data/synthetic_students.csv'
    df.to_csv(filepath, index=False)
    print(f"Saved to {filepath}")
    
    # Print some stats
    print("\nDataset Stats:")
    print(f"Placed 3m: {df['placed_3m'].mean():.1%}")
    print(f"Placed 6m: {df['placed_6m'].mean():.1%}")
    print(f"Placed 12m: {df['placed_12m'].mean():.1%}")
    placed_df = df[df['actual_salary'] > 0]
    print(f"Avg Salary (placed): Rs.{placed_df['actual_salary'].mean():,.0f}")
    
    return df

if __name__ == "__main__":
    generate_student_data(10000)
