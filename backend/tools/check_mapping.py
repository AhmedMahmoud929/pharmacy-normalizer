import sys, os
sys.path.append(os.getcwd())
from normalizer.config import ARABIC_TO_ENGLISH
print(f"hobob: {ARABIC_TO_ENGLISH.get('حبوب')}")
print(f"capsules: {ARABIC_TO_ENGLISH.get('كبسولات')}")
print(f"aqras: {ARABIC_TO_ENGLISH.get('اقراص')}")
