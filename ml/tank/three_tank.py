import pandas as pd
from pathlib import Path

INPUT = Path("../rainfall/rainfall_clean.csv")
OUTPUT = Path("soil_water_index.csv")

# Prototype fixed parameters
K1 = 0.35   # Tank 1 -> Tank 2
K2 = 0.15   # Tank 2 -> Tank 3
K3 = 0.05   # Tank 3 -> drainage

s1 = 0.0
s2 = 0.0
s3 = 0.0

df = pd.read_csv(INPUT)

results = []

for _, row in df.iterrows():
    rainfall = float(row["rainfall_mm"])

    # Rain enters shallow tank
    s1 += rainfall

    # Percolation from tank 1 to tank 2
    flow12 = K1 * s1
    s1 -= flow12
    s2 += flow12

    # Percolation from tank 2 to tank 3
    flow23 = K2 * s2
    s2 -= flow23
    s3 += flow23

    # Deep drainage
    drainage = K3 * s3
    s3 -= drainage

    swi = s1 + s2 + s3

    results.append({
        "date": row["date"],
        "rainfall_mm": rainfall,
        "s1_mm": round(s1, 3),
        "s2_mm": round(s2, 3),
        "s3_mm": round(s3, 3),
        "swi_mm": round(swi, 3),
        "source": row["source"]
    })

out = pd.DataFrame(results)
out.to_csv(OUTPUT, index=False)

print("R5 THREE-TANK SWI COMPLETE")
print("Rows:", len(out))
print("Final tank state:")
print("  s1 =", out.iloc[-1]["s1_mm"], "mm")
print("  s2 =", out.iloc[-1]["s2_mm"], "mm")
print("  s3 =", out.iloc[-1]["s3_mm"], "mm")
print("  SWI =", out.iloc[-1]["swi_mm"], "mm")
print("Output:", OUTPUT)
