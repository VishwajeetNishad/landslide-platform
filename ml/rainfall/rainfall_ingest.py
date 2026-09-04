import pandas as pd
from pathlib import Path

INPUT = Path("rainfall_sample.csv")
OUTPUT = Path("rainfall_clean.csv")

print("Reading rainfall data...")

df = pd.read_csv(INPUT)

required = ["date", "rainfall_mm", "source"]

for col in required:
    if col not in df.columns:
        raise ValueError(f"Missing required column: {col}")

df["date"] = pd.to_datetime(df["date"], errors="coerce")
df["rainfall_mm"] = pd.to_numeric(df["rainfall_mm"], errors="coerce")

if df["date"].isna().any():
    raise ValueError("Invalid date found.")

if df["rainfall_mm"].isna().any():
    raise ValueError("Invalid rainfall value found.")

if (df["rainfall_mm"] < 0).any():
    raise ValueError("Rainfall cannot be negative.")

df = df.sort_values("date").drop_duplicates("date")

df.to_csv(OUTPUT, index=False)

print("\nR4 INGESTION COMPLETE")
print("Rows:", len(df))
print("Date range:", df["date"].min().date(), "to", df["date"].max().date())
print("Rainfall min:", df["rainfall_mm"].min(), "mm")
print("Rainfall max:", df["rainfall_mm"].max(), "mm")
print("Source:", ", ".join(df["source"].unique()))
print("Output:", OUTPUT)
