import sys
import os

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.append(r'a:\drug-mapping\backend')

from tools.matcher import normalize

test_cases = [
    "الترا فيت كريم 50 جم",
    "زيرو فريز سيرم 148 مل",
    "مويست-1 كريم 100 مل",
    "لوف مغربى",
    "تريتو-الس 40مجم 14كبسول",
    "ماش صن بلوك 45 اس بي اف 125 مل",
    "ريد اقراص ناموس",
    "انتي هير كريم",
    "انتيفلو كبسولات",
    "سترونج فيل سبراى",
]

print("==================================================")
print("VERIFYING NORMALIZATION RESULTS")
print("==================================================")
for text in test_cases:
    norm = normalize(text)
    print(f"Original: {text}")
    print(f"Normalized: {norm}")
    print("-" * 50)
