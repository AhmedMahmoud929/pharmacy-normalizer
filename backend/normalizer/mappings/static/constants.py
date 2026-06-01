# ---------------------------------------------------------------------------
# General constants and character maps
# ---------------------------------------------------------------------------

ARABIC_CHAR_MAP: dict[str, str] = {
    "أ": "ا",
    "إ": "ا",
    "آ": "ا",
    "ة": "ه",
    "ى": "ي",
}

# Unicode range for Arabic diacritics (tashkeel) to strip
ARABIC_DIACRITICS_PATTERN = r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]"

# Characters to strip during general cleaning
STRIP_CHARS = r"[*|+/\-_\\(){}[\]\"'&]"

# Generic medical/descriptive words that act as noise and prevent exact matching
ARABIC_STOP_WORDS = {
    "مضاد", "حيوي", "لفيرس", "للفيروسات", "الهيربس", "مسكن", "للالام",
    "خافض", "للحراره", "لعلاج", "للاطفال", "للنساء", "للرجال", "للبشره",
    "للشعر", "للجسم", "للوجه", "للعين", "مكمل", "غذائي", "فيتامين",
    "دواء", "علاج", "الدم", "ضغط", "للملابس", "الاسود", "البيضاء", "بالصبار", "بالخلاصه", "رقم", "كبير", "صغير", "جدا", "مع", "جو",
    "ثلاجة", "ثلاجه", "مصري", "مصرى", "طقم", "قطع", "قطعه", "كارت", "كرت"
}
