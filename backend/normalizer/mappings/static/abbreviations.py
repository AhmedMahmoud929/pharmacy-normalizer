# ---------------------------------------------------------------------------
# English abbreviation normalization and synonyms
# ---------------------------------------------------------------------------

ABBREVIATION_MAP: dict[str, str] = {
    # Tablets
    "tab": "tab",
    "tabs": "tab",
    "tablet": "tab",
    "tablets": "tab",
    "t": "tab",
    "t.": "tab",

    # Capsules
    "cap": "cap",
    "caps": "cap",
    "capsule": "cap",
    "capsules": "cap",

    # Syrup
    "syp": "syrup",
    "syrup": "syrup",
    "syr": "syrup",
    "syp.": "syrup",

    # Cream
    "crm": "cream",
    "cream": "cream",
    "cr": "cream",
    "cr.": "cream",

    # Ointment
    "oint": "ointment",
    "ointment": "ointment",

    # Gel
    "gel": "gel",

    # Drops
    "drp": "drops",
    "drops": "drops",
    "drop": "drops",
    "gtt": "drops",

    # Suppository
    "supp": "supp",
    "suppository": "supp",
    "infant supp": "infant supp",

    # Injectable (injection + ampoule collapsed)
    "inj": "injectable",
    "injection": "injectable",
    "amp": "injectable",
    "ampoule": "injectable",
    "ampoules": "injectable",
    "amb": "injectable",
    "vial": "injectable",
    "vials": "injectable",
    "syringe": "injectable",
    "syringes": "injectable",

    # Sachet
    "sach": "sachet",
    "sachet": "sachet",
    "sachets": "sachet",
    "sach.": "sachet",
    "sac": "sachet",
    "sac.": "sachet",

    # Suspension
    "susp": "suspension",
    "suspension": "suspension",

    # Solution
    "sol": "solution",
    "soln": "solution",
    "solution": "solution",

    # Effervescent
    "eff": "eff",
    "effervescent": "eff",

    # Infant
    "inf": "infant",
    "infant": "infant",

    # Powder
    "powd": "powder",
    "powder": "powder",

    # Mouthwash
    "mw": "mouthwash",
    "mouthwash": "mouthwash",

    # Liniment
    "lin": "liniment",
    "liniment": "liniment",

    # Bottle
    "bottle": "bottle",

    # Units
    "mg": "mg",
    "mcg": "mcg",
    "ml": "ml",
    "gm": "gm",
    "g": "gm",
    "kg": "kg",
    "iu": "iu",
    "cc": "ml",
    "wipe": "wipe",
    "piece": "piece",
    "pad": "pad",
    " خصم": "discount",
    "عرض": "offer",
    "gran": "granules",
    "gran.": "granules",

    # Packaging & Pieces (Category 3b)
    "p": "",
    "pcs": "",
    "pc": "",
    "x": "",

    # Generic (Category 4 fix: % handled in pipeline, remove here if redundant)
    "percent": "percent",
    "offer": "offer",
    "free": "free",
    "plus": "plus",
    "extra": "extra",
    "123": "1 2 3",
}

FORM_SYNONYM_MAP: dict[str, str] = {
    "injection": "injectable",
    "ampoule": "injectable",
    "injectable": "injectable",
    "amp": "injectable",
    "inj": "injectable",
    "vial": "injectable",
    "syringe": "injectable",
    "shampoo": "shampoo",
    "conditioner": "conditioner",
    "oil": "oil",
    "cream": "cream",
    "creamy": "cream",
    "gel": "gel",
    "emulgel": "gel",
    "ointment": "ointment",
    "syrup": "syrup",
    "suspension": "suspension",
    "solution": "solution",
    "sachet": "sachet",
    "sachets": "sachet",
    "granules": "sachet",
    "pacets": "sachet",
    "packets": "sachet",
    "bags": "sachet",
    "tab": "tab",
    "tablet": "tab",
    "tablets": "tab",
    "caplet": "tab",
    "caplets": "tab",
    "cap": "cap",
    "capsule": "cap",
    "capsules": "cap",
    "supp": "supp",
    "suppository": "supp",
    "suppositories": "supp",
    "vaginal": "vaginal",
    "vag": "vaginal",
    "injectable": "injectable",
    "ampoule": "injectable",
    "ampoules": "injectable",
    "ampoul": "injectable",
    "ampl": "injectable",
    "aml": "injectable",
    "vial": "injectable",
    "vials": "injectable",
    "vail": "injectable",
    "syring": "injectable",
    "injection": "injectable",
    "eff": "effervescent",
    "efer": "effervescent",
    "effervescent": "effervescent",
    "penfill": "penfill",
    "penfills": "penfill",
    "inhaler": "inhaler",
    "hfa": "inhaler",
    "bottle": "bottle",
    "botelle": "bottle",
    "wash": "wash",
    "wish": "wash",
    "baby": "baby",
    "beby": "baby",
    "mcg": "mcg",
    "micro": "mcg",
}
