# ---------------------------------------------------------------------------
# Arabic → English token mappings and classification
# ---------------------------------------------------------------------------

ARABIC_TO_ENGLISH: dict[str, str] = {
    # Dosage forms
    "قرص": "tab",
    "اقراص": "tab",
    "حبه": "tab",
    "حبوب": "tab",
    "كبسوله": "cap",
    "كبسولات": "cap",
    "كبسول": "cap",
    "فوار": "eff",
    "شراب": "syrup",
    "كريم": "cream",
    "مرهم": "ointment",
    "جل": "gel",
    "جيل": "gel",
    "نقط": "drops",
    "قطره": "drops",
    "بخاخ": "spray",
    "حقن": "injectable",
    "حقنه": "injectable",
    "امبول": "injectable",
    "امبولات": "injectable",
    "تحاميل": "supp",
    "لبوس": "supp",
    "اقماع": "supp",
    "بودره": "powder",
    "دهان": "liniment",
    "غسول فم": "mouthwash",
    "مضمضه": "mouthwash",
    "زجاجه": "bottle",
    "مقشر": "scrub",                                 # NEW
    "شمع": "wax",                                   # NEW
    "فوم": "foam",                                   # NEW
    "سائل": "liquid",                                # NEW
    "جيلي": "jelly",                                 # NEW
    "شاور كريم": "shower_cream",                     # NEW
    "اعشاب": "herbs",                                # NEW
    "تونر": "toner",                                 # NEW
    "سيروم": "serum",
    "ماسك": "mask",
    "معجون": "paste",
    "صابون": "soap",
    "صابونة": "soap",                                # NEW
    "محلول": "solution",
    "منظف": "cleanser",
    "غسول": "wash",
    "رول": "roll_on",
    "رول أون": "roll_on",                            # NEW
    "ستيك": "stick",
    "سبلاش": "splash",
    "بادى سبلاش": "splash",                          # NEW
    "بادي سبلاش": "splash",                          # NEW
    "عطر": "perfume",
    "برفان": "perfume",                              # NEW
    "ديودرنت": "deodorant",
    "مزيل عرق": "deodorant",
    "ديوديرنت": "deodorant",                         # NEW
    "واقي ذكري": "condom",
    "كوندوم": "condom",
    "فوط صحيه": "pads",
    "فوط صحية": "pads",
    "فوط": "pads",
    "حفاضات": "diapers",
    "مناديل": "wipes",
    "شفرات": "blades",
    "ماكينة حلاقة": "razor",
    "شاور جل": "shower_gel",
    "معجون اسنان": "toothpaste",
    "مرطب شفاه": "lip_balm",
    "زبدة كاكاو": "lip_balm",
    "مرطب": "moisturizer",                           # NEW
    "مطهر": "antiseptic",
    "فنيك": "antiseptic",                            # NEW
    "كحول": "alcohol",
    "ببرونه": "baby_bottle",
    "صبغه": "hair_dye",
    "صبغة": "hair_dye",                              # NEW
    "واقي شمس": "sunscreen",
    "واقي الشمس": "sunscreen",
    "صن بلوك": "sunscreen",
    "صن سكرين": "sunscreen",
    "اعواد اذن": "earbuds",                          # NEW
    "معطر جو": "air_freshener",                      # NEW
    "قفازات": "gloves",                              # NEW
    "مبرد قدم": "foot_file",                         # NEW
    "قطن": "cotton",                                 # NEW
    "حجر": "pumice",                                 # NEW
    "خلة اسنان": "toothpick",                        # NEW
    "سلاكة اسنان": "toothpick",                      # NEW
    "قصافة": "clipper",                              # NEW
    "غسول اللحية": "beard_wash",                     # NEW
    "ماء ميسيلار": "micellar",                       # NEW
    "ليفة": "loofah",                                # NEW
    "بكر تواليت": "toilet_paper",                    # NEW
    "ملابس صحية": "underwear",                       # NEW
    "شرائط": "strips",                               # NEW
    "ملقاط": "tweezers",                             # NEW
    "فقاعه حمام": "bath_foam",                       # NEW
    "بلسم ما بعد الحلاقة": "aftershave",             # NEW
    "فوم الحلاقة": "shaving_foam",                   # NEW
    "بديل الزيت": "oil_replacement",                 # NEW
    "دش مهبلي": "douche",                            # NEW
    "محلي طبيعي": "sweetener",                       # NEW
    "محلي": "sweetener",                             # NEW
    "جوارب": "stockings",                            # NEW
    "وسادات قطنية": "nursing_pads",                  # NEW
    "سدادات الأذن": "earplugs",                      # NEW
    "أداة تهذيب": "trimmer",                          # NEW
    "عدسات": "lenses",                               # NEW
    "مصيدة لاصقة": "trap",                           # NEW
    "كمادات": "compress",                            # NEW
    "بلاستر جروح": "plaster",                        # NEW
    "زيت اللحية": "beard_oil",                       # NEW
    "موف": "purple",                                 # NEW
    "أرجواني": "purple",                             # NEW
    "بيج": "beige",                                  # NEW
    "كولونيا": "cologne",                            # NEW
    "حليب جسم": "body_milk",                         # NEW
    "منبت للشعر": "hair_restorer",                   # NEW
    "شفرة حلاقة": "razor",                           # NEW
    "غطاء مقعد المرحاض": "toilet_cover",             # NEW
    "مبيد حشري": "insecticide",                      # NEW
    "مبشرة كعب": "heel_rasp",                        # NEW
    "مزيل طلاء الأظافر": "nail_polish_remover",      # NEW
    "سائل كهربائي": "mosquito_repellent",             # NEW
    "طارد للناموس": "mosquito_repellent",            # NEW
    "مقص": "scissors",                               # NEW
    "مبرد": "file",                                  # NEW
    "إسفنجة": "sponge",                               # NEW
    "ملح": "salt",                                   # NEW
    "أو دو برفوم": "edp",                             # NEW
    "أو دو تواليت": "edt",                            # NEW
    "لوشن": "lotion",                                # NEW
    "زبدة الجسم": "body_butter",                      # NEW
    "تبييض": "whitening",                             # NEW
    "سدادات قطنية": "tampons",                        # NEW
    "غطاء العين": "eye_mask",                         # NEW
    "وسادة الرقبة": "neck_pillow",                    # NEW
    "غراء": "glue",                                  # NEW
    "فرشاة اسنان": "toothbrush",                      # NEW
    "ماسكرا": "mascara",                              # NEW
    "هاردنر": "hardener",                             # NEW
    "اقراص استحلاب": "lozenges",                      # NEW
    "كريم شعر": "hair_cream",                         # NEW
    "خيط اسنان": "dental_floss",                      # NEW
    "منظف زجاج": "glass_cleaner",                     # NEW
    "غرغرة": "gargle",                                # NEW
    "سويت": "sugar_wax",                             # NEW
    "منظف اللسان": "tongue_cleaner",                  # NEW
    "بانتي": "panty_liners",                          # NEW
    "هاند ووش": "hand_wash",                          # NEW
    "هاند واش": "hand_wash",                          # NEW
    "غسول يد": "hand_wash",                           # NEW
    "جل الاستحمام": "shower_gel",                     # NEW
    "بادي سبلاش": "body_splash",                      # NEW
    "سبراى الجسم": "body_spray",                      # NEW
    "ميست معطر": "body_mist",                         # NEW
    "جل الحلاقة": "shaving_gel",                      # NEW
    "مناديل حمام": "toilet_paper",                    # NEW
    "بينك": "pink",                                  # NEW
    "كحلي": "navy",                                  # NEW
    "برطمان": "jar",                                 # NEW
    "للشعر": "for_hair",                             # NEW
    "بزبدة": "with_butter",                          # NEW
    "بخلاصة": "with_extract",                        # NEW
    "للقشرة": "for_dandruff",                        # NEW
    "لعلاج": "treatment",                            # NEW
    "بلس": "plus",                                   # NEW
    "الرأس": "head",                                 # NEW
    "بجوز": "with_coconut",                          # NEW
    "شاين": "shine",                                 # NEW
    "الأرجان": "argan",                              # NEW
    "المغذي": "nourishing",                          # NEW
    "إصلاح": "repair",                               # NEW
    "لامع": "shiny",                                 # NEW
    "لفروة": "for_scalp",                            # NEW
    "الترطيب": "moisturizing",                       # NEW
    "هيالورون": "hyaluron",                          # NEW
    "واكس": "wax",                                   # NEW
    "بروتين": "protein",                             # NEW
    "ببروتين": "with_protein",                       # NEW
    "منعم": "softener",                              # NEW
    "انسيابي": "smooth",                             # NEW
    "حريري": "silky",                                # NEW
    "وصفة": "recipe",                                # NEW
    "السباحة": "swimming",                           # NEW
    "بالأفوكادو": "with_avocado",                    # NEW
    "الحية": "snake",                                # NEW
    "نقي": "pure",                                   # NEW
    "عضوي": "organic",                               # NEW
    "بصل": "onion",                                  # NEW
    "خروع": "castor",                                # NEW
    "الأرز": "rice",                                 # NEW
    "الأرز المخمر": "fermented_rice",                # NEW
    "مخمر": "fermented",                             # NEW
    "الزيت": "oil",                                  # NEW
    "من": "from",                                    # NEW
    "باريس": "paris",                                # NEW
    "اورجانيك": "organic",                           # NEW
    "نساء": "women",                                 # NEW
    "للنساء": "for_women",                           # NEW
    "رجال": "men",                                   # NEW
    "للرجال": "for_men",                             # NEW
    "خالي": "free",                                  # NEW
    "بيوتي": "beauty",                               # NEW
    "مي": "me",                                      # NEW
    "جو": "go",                                      # NEW
    "بيو": "bio",                                    # NEW
    "الترا": "ultra",                                # NEW
    "رقم": "number",                                 # NEW
    "مجموعة": "set",                                 # NEW
    "المجموعة": "set",                               # NEW
    "قناع": "mask",                                  # NEW
    "ذا": "the",                                     # NEW
    "و": "and",                                      # NEW
    "اديكت": "addict",                               # NEW
    "اون": "on",                                     # NEW
    "جي": "g",                                       # NEW
    "بيرت": "pert",                                  # NEW
    "بادي": "body",                                  # NEW
    "سيمي": "semi",                                  # NEW
    "دوكس": "dox",                                   # NEW
    "او": "or",                                      # NEW
    "لإصلاح": "to_repair",                           # NEW
    "لاصلاح": "to_repair",                           # NEW
    "برائحة": "scented",                             # NEW
    "ديلينو": "di_lino",                             # NEW
    "افريل": "avril",                                # NEW
    "ار": "r",                                       # NEW
    "بي": "b",                                       # NEW
    "الكيراتين": "keratin",                          # NEW
    "زبدة": "butter",                                # NEW
    "ماش": "mash",                                   # NEW
    "هيد": "head",                                   # NEW
    "شولدرز": "shoulders",                           # NEW
    "حماية": "protection",                           # NEW
    "مع": "with",                                    # NEW
    "بروفيشنال": "professional",                     # NEW
    "المصبوغ": "colored",                            # NEW
    "برت": "pert",                                   # NEW
    "على": "on",                                     # NEW
    "بخصم": "with_discount",                         # NEW
    "أشقر": "blonde",                                # NEW
    "لفك": "detangling",                             # NEW
    "هيربل": "herbal",                               # NEW
    "اسنسز": "essences",                             # NEW
    "كود": "code",                                   # NEW
    "قطعة": "piece",                                 # NEW
    "دائمة": "permanent",                            # NEW
    "ميست": "mist",                                  # NEW
    "وزبدة": "with_butter",                          # NEW
    "مؤقته": "temporary",                            # NEW
    "غني": "rich",                                   # NEW
    "سوفت": "soft",                                  # NEW
    "لونج": "long",                                  # NEW
    "كستنائي": "chestnut",                           # NEW
    "مكواة": "iron",                                 # NEW
    "ببذور": "with_seeds",                           # NEW
    "بالفحم": "with_charcoal",                       # NEW
    "ديتوكس": "detox",                               # NEW
    "فوليوم": "volume",                              # NEW
    "داكن": "dark",                                  # NEW
    "عشبي": "herbal",                                # NEW
    "بمستخلصات": "with_extracts",                    # NEW
    "الفاكهة": "fruit",                              # NEW
    "بالشيا": "with_shea",                           # NEW
    "بالتوت": "with_berry",                          # NEW
    "بالتفاح": "with_apple",                         # NEW
    "بامبوسا": "bambusa",                            # NEW
    "للصئبان": "for_nits",                           # NEW
    "الصئبان": "nits",                               # NEW
    "المبلل": "wet",                                 # NEW
    "فائق": "ultra",                                 # NEW
    "فاتح": "light",                                 # NEW
    "جدًا": "very",                                  # NEW
    "جزيئي": "molecular",                            # NEW
    "لاستعادة": "for_restoring",                     # NEW
    "بيضاوية": "oval",                               # NEW
    "كبير": "large",                                 # NEW
    "صغير": "small",                                 # NEW
    "مزدوج": "double",                               # NEW
    "المفعول": "action",                             # NEW
    "مجانًا": "free",                                 # NEW
    "بديل الزيت": "oil_replacement",                 # NEW
    "بريمير": "premier",                             # NEW
    "ايفر": "ever",                                  # NEW
    "بايو": "bio",                                   # NEW
    "أنواع": "types",                                # NEW
    "إلفيف": "elvive",                               # NEW
    "كيرلز": "curls",                                # NEW
    "أويل": "oil",                                   # NEW
    "الروزماري": "rosemary",                         # NEW
    "معالج": "treatment",                            # NEW
    "لتقوية": "for_strengthening",                   # NEW
    "لحماية": "for_protection",                      # NEW
    "ستايل": "style",                                # NEW
    "الطبيعية": "natural",                           # NEW
    "وتقوية": "and_strengthening",                   # NEW
    "وتكثيف": "and_thickening",                      # NEW
    "هيربرست": "hairburst",                          # NEW
    "سترونج": "strong",                              # NEW
    "صالون": "salone",                               # NEW
    "كيرستاس": "kerastase",                          # NEW
    "بلمبى": "plumpy",                               # NEW
    "نيجيلا": "nigella",                             # NEW
    "أورجانيكا": "organica",                         # NEW
    "ريستوركس": "restorex",                          # NEW
    "شيروسا": "chirosa",                             # NEW
    "بريلكريم": "brylcreem",                         # NEW
    "شيفو": "shifu",                                 # NEW
    "تولاهير": "tola_hair",                          # NEW
    "دونا": "dona",                                  # NEW
    "شوارزكوف": "schwarzkopf",                       # NEW
    "باليت": "palette",                              # NEW
    "موديش": "modish",                               # NEW
    "بريميوم": "premium",                            # NEW
    "ويت براش": "wet_brush",                         # NEW
    "برينسيس": "princess",                           # NEW
    "ديزني": "disney",                               # NEW
    "أوف": "of",                                     # NEW
    "بـ": "with",                                    # NEW
    "بالأعشاب": "with_herbs",                        # NEW
    "عشبي": "herbal",                                # NEW
    "مقاس": "size",                                  # NEW
    "دعامة": "support",                              # NEW
    "جهاز": "device",                                # NEW
    "حزام": "belt",                                  # NEW
    "وسط": "medium",                                 # NEW
    "الدم": "blood",                                 # NEW
    "مرنة": "elastic",                               # NEW
    "ميزان": "scale",                                # NEW
    "الركبة": "knee",                                # NEW
    "معصم": "wrist",                                 # NEW
    "مفتوحة": "open",                                # NEW
    "قياس": "measurement",                           # NEW
    "ضغط": "pressure",                               # NEW
    "رباط": "bandage",                               # NEW
    "دوالي": "varicose",                             # NEW
    "ضمادة": "dressing",                             # NEW
    "رقمي": "digital",                               # NEW
    "للكبار": "for_adults",                          # NEW
    "السكر": "glucose",                              # NEW
    "بلاستر": "plaster",                             # NEW
    "للكاحل": "for_ankle",                           # NEW
    "للركبة": "for_knee",                            # NEW
    "لاصق": "adhesive",                              # NEW
    "زجاجي": "glass",                                # NEW
    "داعم": "supporter",                             # NEW
    "ذراع": "arm",                                   # NEW
    "طبي": "medical",                                # NEW
    "البطن": "abdomen",                              # NEW
    "لقياس": "for_measuring",                        # NEW
    "نسبة": "ratio",                                 # NEW
    "جراحي": "surgical",                             # NEW
    "الاصابع": "fingers",                            # NEW
    "رياضي": "sport",                                # NEW
    "ضاغط": "compression",                           # NEW
    "ضاغطة": "compression",                          # NEW
    "جبيرة": "splint",                               # NEW
    "ترمومتر": "thermometer",                        # NEW
    "للف": "for_wrapping",                           # NEW
    "حول": "around",                                 # NEW
    "حامل": "holder",                                # NEW
    "لاصقات": "patches",                             # NEW
    "جروح": "wounds",                                # NEW
    "قربة": "bottle",                                # NEW
    "تبريد": "cooling",                              # NEW
    "للرقبة": "for_neck",                            # NEW
    "اختبار": "test",                                # NEW
    "فحص": "check",                                  # NEW
    "حرارة": "temperature",                          # NEW
    "مساج": "massage",                               # NEW
    "تمليس": "straightening",                        # NEW
    "قراءة": "reading",                              # NEW
    "حرير": "silk",                                  # NEW
    "النمر": "tiger",                                # NEW
    "للغسل": "washable",                             # NEW
    "الإبهام": "thumb",                              # NEW
    "لاتكس": "latex",                                # NEW
    "هيدروكولويد": "hydrocolloid",                    # NEW
    "مطهر": "antiseptic",                            # NEW
    "السن": "age",                                   # NEW
    "كبار": "elderly",                               # NEW
    "الجبس": "cast",                                 # NEW
    "جوارب": "stockings",                            # NEW
    "رافع": "suspensory",                            # NEW
    "خصية": "scrotal",                               # NEW
    "مسحات": "swabs",                                # NEW
    "شطافة": "bidet",                                # NEW
    "نعل": "insole",                                 # NEW
    "حبوب": "pills",                                 # NEW
    "العمود": "column",                              # NEW
    "الفقري": "spinal",                              # NEW
    "سماعة": "stethoscope",                          # NEW
    "الاذن": "ear",                                  # NEW
    "الجبهة": "forehead",                            # NEW
    "للإبهام": "for_thumb",                          # NEW
    "واقي": "protector",                             # NEW
    "فوق": "above",                                  # NEW
    "تحت": "under",                                  # NEW
    "للاستحمام": "bath",                              # NEW
    "بحر": "sea",                                    # NEW
    "البحر": "sea",                                  # NEW
    "خوخ": "peach",                                  # NEW
    "برتقال": "orange",                               # NEW
    "رؤوس سوداء": "blackheads",                      # NEW
    "مزيل": "remover",                               # NEW
    "مقبض": "handle",                                # NEW
    "توت": "berry",                                  # NEW
    "فانيليا": "vanilla",                            # NEW
    "شرقي": "oriental",                              # NEW
    "فاصل": "separator",                             # NEW
    "أصابع": "toes",                                 # NEW
    "سدادات": "plugs",                               # NEW
    "غطاء": "cover",                                 # NEW
    "وسادة": "pillow",                               # NEW
    "رقبة": "neck",                                  # NEW
    "غراء": "glue",                                  # NEW
    "بلية": "roll_on",                               # NEW
    "عود": "oud",                                    # NEW
    "رمان": "pomegranate",                           # NEW
    "معقم": "sanitizer",                             # NEW
    "فرشاة": "brush",                                # NEW
    "شعر": "hair",                                   # NEW
    "لثة": "gum",                                    # NEW
    "مكياج": "makeup",                               # NEW
    "شوكولاتة": "chocolate",                         # NEW
    "فراولة": "strawberry",                          # NEW
    "نعناع": "mint",                                 # NEW
    "ليمون": "lemon",                                # NEW
    "لافندر": "lavender",                            # NEW
    "ياسمين": "jasmine",                             # NEW
    "صبار": "aloe_vera",                             # NEW
    "الوفيرا": "aloe_vera",                          # NEW
    "سم": "cm",                                      # NEW
    "لارج": "large",                                 # NEW
    "جدا": "very",                                   # NEW
    "قطع": "pieces",                                 # NEW
    "للمعصم": "for_wrist",                           # NEW
    "سكر": "sugar",                                  # NEW
    "هاي": "high",                                   # NEW
    "لايف": "life",                                  # NEW
    "هيلث": "health",                                # NEW
    "واحدة": "one",                                  # NEW
    "ناعمة": "soft",                                 # NEW
    "شاش": "gauze",                                  # NEW
    "بيتر": "better",                                # NEW
    "طبية": "medical",                               # NEW
    "متوسط": "medium",                               # NEW
    "كاحل": "ankle",                                 # NEW
    "نيوبرين": "neoprene",                           # NEW
    "النيوبرين": "neoprene",                          # NEW
    "مرن": "elastic",                                # NEW
    "استنشاق": "inhalation",                         # NEW
    "الاستنشاق": "inhalation",                       # NEW
    "كبار": "adults",                                # NEW
    "الكبار": "adults",                              # NEW
    "ظهر": "back",                                   # NEW
    "الظهر": "back",                                 # NEW
    "لاصقة": "adhesive",                             # NEW
    "حقيبة": "bag",                                  # NEW
    "للماء": "waterproof",                           # NEW
    "مطاطية": "elastic",                             # NEW
    "مشد": "corset",                                 # NEW
    "قلم": "pen",                                    # NEW
    "فقرات": "vertebrae",                            # NEW
    "العجزية": "sacral",                             # NEW
    "حمالة": "sling",                                # NEW
    "كانيولا": "cannula",                            # NEW
    "اذن": "ear",                                    # NEW
    "مرفق": "elbow",                                 # NEW
    "تنس": "tennis",                                 # NEW
    "جلوكوز": "glucose",                             # NEW
    "الجلوكوز": "glucose",                           # NEW
    "كانولا": "cannula",                             # NEW
    "للجنسين": "unisex",                             # NEW
    "لسلس": "incontinence",                          # NEW
    "مشرط": "lancet",                                # NEW
    "بواسير": "hemorrhoids",                         # NEW
    "صنبور": "tap",                                  # NEW
    "طلاء": "polish",                                # NEW
    "الأظافر": "nails",                              # NEW
    "االظافر": "nails",                              # NEW
    "حلال": "halal",                                 # NEW
    "ماسكارا": "mascara",                            # NEW
    "فيكس": "fix",                                   # NEW
    "بودي": "body",                                  # NEW
    "كونسيلر": "concealer",                          # NEW
    "مات": "matte",                                  # NEW
    "مضغوطة": "compact",                             # NEW
    "نيويورك": "new_york",                           # NEW
    "ليب": "lip",                                    # NEW
    "سيتي": "city",                                  # NEW
    "جيرل": "girl",                                  # NEW
    "جلوس": "gloss",                                 # NEW
    "الرموش": "lashes",                              # NEW
    "رموش": "lashes",                                # NEW
    "بالضغط": "press_on",                            # NEW
    "لاش": "lash",                                   # NEW
    "وير": "wear",                                   # NEW
    "ثلاثية": "triple",                              # NEW
    "تول": "tool",                                   # NEW
    "درجة": "shade",                                 # NEW
    "مضادة": "anti",                                 # NEW
    "الحواجب": "eyebrows",                           # NEW
    "ستاي": "stay",                                  # NEW
    "سموذ": "smooth",                                # NEW
    "ميديام": "medium",                              # NEW
    "للانزلاق": "anti_slip",                         # NEW
    "تحديد": "liner",                                # NEW
    "مطفي": "matte",                                 # NEW
    "لاستينج": "lasting",                            # NEW
    "الستانلس": "stainless",                         # NEW
    "ستيل": "steel",                                 # NEW
    "العيون": "eyes",                                # NEW
    "الهيالورونيك": "hyaluronic",                    # NEW
    "الالوان": "colors",                             # NEW
    "الأبعاد": "dimensions",                         # NEW
    "اسبانيا": "spain",                              # NEW
    "خافض": "depressor",                             # NEW
    "لسان": "tongue",                                # NEW
    "خشب": "wood",                                   # NEW
    "اطار": "frame",                                 # NEW
    "كالو": "callus",                                # NEW
    "امواس": "blades",                               # NEW
    "مقشط": "scraper",                               # NEW
    "أكياس": "sachets",                              # NEW
    "العمود": "column",                              # NEW
    "الفقري": "spinal",                              # NEW
    "مخدة": "pillow",                                # NEW
    "شكاكه": "lancet",                               # NEW
    "مربعه": "square",                               # NEW
    "دائرى": "round",                                # NEW
    "صندل": "sandals",                               # NEW
    "رقعة": "patch",                                 # NEW
    "عصا": "stick",                                  # NEW
    "أرجل": "legs",                                  # NEW
    "صوابع": "toes",                                 # NEW
    "ذقن": "chin",                                   # NEW
    "فوهة": "nozzle",                                # NEW
    "رضفية": "patellar",                             # NEW
    "اربي": "inguinal",                              # NEW
    "فتق": "hernia",                                 # NEW
    "سكري": "diabetic",                              # NEW
    "أسيتون": "acetone",                             # NEW
    "مصحي": "corrector",                             # NEW
    "بوستر": "booster",                              # NEW
    "بليندر": "blender",                             # NEW
    "باليت": "palette",                              # NEW
    "إيشادو": "eyeshadow",                           # NEW
    "كحل": "kohl",                                   # NEW
    "كاجال": "kajal",                                # NEW
    "لاصق": "glue",                                  # NEW
    "ثني": "curler",                                 # NEW
    "براية": "sharpener",                            # NEW
    "هايليتر": "highlighter",                        # NEW
    "تظليل": "shading",                              # NEW
    "خافي": "concealer",                             # NEW
    "عيوب": "blemishes",                             # NEW
    "برونزر": "bronzer",                             # NEW
    "خدود": "blush",                                 # NEW
    "ملمع": "gloss",                                 # NEW
    "معطف": "coat",                                  # NEW
    "علوي": "top",                                   # NEW
    "إير": "air",                                    # NEW
    "اير": "air",                                    # NEW
    "الاظافر": "nails",                              # NEW
    "قطنية": "cotton",                               # NEW
    "لوف": "love",                                   # NEW
    "فاشون": "fashion",                              # NEW
    "مور": "more",                                   # NEW
    "الابعاد": "dimensions",                         # NEW
    "نظارات": "glasses",                             # NEW
    "بريميم": "premium",                             # NEW
    "ليميتد": "limited",                             # NEW
    "ليمتيد": "limited",                             # NEW
    "اديشن": "edition",                              # NEW
    "اسيتون": "acetone",                             # NEW
    "إبهام": "thumb",                                # NEW
    "بهام": "thumb",                                 # NEW
    "بنكهة": "flavored",                             # NEW
    "ميبيلين": "maybelline",                         # NEW
    "اكستريم": "extreme",                            # NEW
    "بايب": "pipe",                                  # NEW
    "إزالة": "removal",                              # NEW
    "لإزالة": "removal",                             # NEW
    "ودعم": "support",                               # NEW
    "السيليكون": "silicone",                         # NEW
    "مطاطي": "elastic",                              # NEW

    # Units
    "مل": "ml",
    "لتر": "l",
    "مجم": "mg",
    "ملجم": "mg",
    "مج": "mg",
    "ميكروجرام": "mcg",
    "جم": "gm",
    "جرام": "gm",
    "وحده دوليه": "iu",
    "وحدة دولية": "iu",
    "سي سي": "cc",

    # Packaging
    "عبوه": "pack",
    "علبه": "box",
    "شريط": "strip",
    "كيس": "sachet",

    # Colors
    "ازرق": "blue",                                 # NEW
    "أزرق": "blue",                                 # NEW
    "احمر": "red",                                  # NEW
    "أحمر": "red",                                  # NEW
    "اخضر": "green",                                # NEW
    "أخضر": "green",                                # NEW
    "اسود": "black",                                # NEW
    "أسود": "black",                                # NEW
    "ابيض": "white",                                # NEW
    "أبيض": "white",                                # NEW
    "اصفر": "yellow",                               # NEW
    "أصفر": "yellow",                               # NEW
    "وردي": "pink",                                 # NEW
    "زهري": "pink",                                 # NEW
    "بنفسجي": "purple",                             # NEW
    "برتقالي": "orange",                             # NEW
    "بني": "brown",                                 # NEW
    "رمادي": "grey",                                # NEW
    "ذهبي": "gold",                                 # NEW
    "فضي": "silver",                                # NEW
    "بلو" : "blue",
    "بلاك": "black",
    "وايت": "white",
    "جرين": "green",
    "ريد": "red",
    "اورنج": "orange",
    "بينك": "pink",
    "بربل": "purple",
    "براون": "brown",
    "جري": "grey",
    "جولدن": "gold",
    "سيلفر": "silver",
    "بلاك هيدز": "blackheads",
    "هاند ووش": "hand_wash",
    "هاند واش": "hand_wash",
    "غسول يد": "hand_wash",
    "جل الاستحمام": "shower_gel",
    "شاور جل": "shower_gel",
    "شاور جيل": "shower_gel",
    "جل استحمام": "shower_gel",
    "مزيل مكياج": "makeup_remover",
    "نسائي": "feminine",                             # NEW
    "حميمية": "intimate",                            # NEW
    "مزدوج": "double",                               # NEW
    "منحني": "curved",                               # NEW
    "مستقيمة": "straight",                           # NEW
    "فايبرجلاس": "fiberglass",                       # NEW
    "سيزال": "sisal",                                # NEW
    "إسفنجي": "sponge",                              # NEW
    "باديكير": "pedicure",                           # NEW
    "مانيكير": "manicure",                           # NEW
    "كعب": "heel",                                   # NEW
    "مبتدئين": "beginners",                          # NEW
    "كعب": "heel",                                   # NEW
    "مبتدئين": "beginners",                          # NEW
    "كونفاتيك": "convatec",                          # NEW
    "أرجوناميك": "ergonomic",                        # NEW
    "اقتصادية": "economic",                          # NEW
    "صلبة": "hard",                                  # NEW
    "كومبليت": "complete",                           # NEW
    "منشط": "activated",                             # NEW
    "غزل البنات": "cotton_candy",                    # NEW
    "بودرة": "powder",                               # NEW
    "شفرة": "blade",                                 # NEW
    "حلاقة": "shaving",                              # NEW
    "كروم": "chrome",                                # NEW
    "حافة": "edge",                                  # NEW
    "أذن": "ear",                                    # NEW
    "الأذن": "ear",                                  # NEW
    "حفاضة": "diaper",                               # NEW
    "يومية": "daily",                                # NEW
    "سميكة": "thick",                                # NEW
    "رقيقة": "thin",                                 # NEW
    "نحيفة": "thin",                                 # NEW
    "طويلة": "long",                                 # NEW
    "بارد": "cold",                                  # NEW
    "مبللة": "wet",                                  # NEW
    "أطفال": "baby",                                 # NEW
    "مبيضة": "whitening",                            # NEW
    "ماكسي": "maxi",                                 # NEW
    "جونيور": "junior",                              # NEW
    "ميسيلار": "micellar",                           # NEW
    "شفاه": "lips",                                  # NEW
    "الشفاه": "lips",                                # NEW
    "وجه": "face",                                   # NEW
    "الوجه": "face",                                 # NEW
    "جسم": "body",                                   # NEW
    "الجسم": "body",                                 # NEW
    "للجسم": "body",                                 # NEW
    "يدين": "hands",                                 # NEW
    "اليدين": "hands",                               # NEW
    "لليدين": "hands",                               # NEW
    "اليد": "hands",                                 # NEW
    "لليد": "hands",                                 # NEW
    "قدمين": "feet",                                 # NEW
    "القدمين": "feet",                               # NEW
    "للقدمين": "feet",                               # NEW
    "القدم": "feet",                                 # NEW
    "أظافر": "nails",                                # NEW
    "اظافر": "nails",                                # NEW
    "نسائية": "feminine",                            # NEW
    "للحلاقة": "shaving",                            # NEW
    "طبيعية": "natural",                             # NEW
    "طبيعي": "natural",                              # NEW
    "بشرة": "skin",                                  # NEW
    "البشرة": "skin",                                # NEW
    "للبشرة": "skin",                                # NEW
    "العادية": "normal",                             # NEW
    "عادية": "normal",                               # NEW
    "الجافة": "dry",                                 # NEW
    "جافة": "dry",                                   # NEW
    "الحساسة": "sensitive",                          # NEW
    "حساسة": "sensitive",                            # NEW
    "الاسنان": "teeth",                              # NEW
    "للأسنان": "teeth",                              # NEW
    "للاسنان": "teeth",                              # NEW
    "اسنان": "teeth",                                # NEW
    "أسنان": "teeth",                                # NEW
    "استحمام": "bath",                               # NEW
    "الاستحمام": "bath",                             # NEW
    "للتعرق": "antiperspirant",                      # NEW
    "التعرق": "antiperspirant",                      # NEW
    "عرق": "sweat",                                  # NEW
    "العرق": "sweat",                                # NEW
    "تفتيح": "whitening",                            # NEW
    "للتفتيح": "whitening",                          # NEW
    "مفتح": "whitening",                             # NEW
    "منعش": "refreshing",                            # NEW
    "منعشة": "refreshing",                           # NEW
    "للبعوض": "mosquito",                            # NEW
    "البعوض": "mosquito",                            # NEW
    "للناموس": "mosquito",                           # NEW
    "الناموس": "mosquito",                           # NEW
    "الحشرات": "insects",                            # NEW
    "للحشرات": "insects",                            # NEW
    "الزاحفة": "crawling",                           # NEW
    "الطائرة": "flying",                             # NEW
    "قاتل": "killer",                                # NEW
    "طارد": "repellent",                             # NEW
    "طاردة": "repellent",                            # NEW
    "شريط": "strip",                                 # NEW
    "اللحية": "beard",                               # NEW
    "لحية": "beard",                                 # NEW
    "للأطفال": "baby",                               # NEW
    "للاطفال": "baby",                               # NEW
    "مبلل": "wet",                                   # NEW
    "جاف": "dry",                                    # NEW
    "فوارة": "effervescent",                         # NEW
    "فواره": "effervescent",                         # NEW
    "بانيو": "bath",                                 # NEW
    "مخمرية": "makhmaria",                           # NEW
    "عائلى": "family",                               # NEW
    "دلكة": "delka",                                 # NEW
    "حناء": "henna",                                 # NEW
    "حنه": "henna",                                  # NEW
    "قمل": "lice",                                   # NEW
    "بونيه": "bonnet",                               # NEW
    "الشعر": "hair",
    "شعر": "hair",
    "لشعر": "hair",
    "بالشعر": "hair",
    "شامبو": "shampoo",
    "بلسم": "conditioner",
    "وبلسم": "conditioner",
    "بالبلسم": "conditioner",
    "زيت": "oil",
    "بزيت": "oil",
    "وزيت": "oil",
    "زيوت": "oil",
    "هير": "hair",
    "الارجان": "argan",
    "بالارجان": "argan",
    "ارجان": "argan",
    "تساقط": "hair_loss",
    "لتساقط": "hair_loss",
    "المتساقط": "hair_loss",
    "التساقط": "hair_loss",
    "الجاف": "dry",
    "ضد": "anti",
    "مضاد": "anti",
    "المضاد": "anti",
    "برو": "pro",
    "ان": "in",
    "الشيا": "shea",
    "بزبده": "butter",
    "زبده": "butter",
    "ذبده": "butter",
    "ويت": "wet",
    "براش": "brush",
    "ليف": "leave",
    "القشره": "dandruff",
    "القشرة": "dandruff",                            # NEW
    "للقشره": "dandruff",
    "سبراي": "spray",
    "اسبراي": "spray",
    "اشقر": "blonde",
    "الهند": "india",
    "جوز": "coconut",
    "كولور": "color",
    "كولر": "color",
    "كلور": "color",
    "لون": "color",
    "مغذي": "nourishing",
    "لتغذيه": "nourishing",
    "تغذيه": "nourishing",
    "حمام": "bath",
    "فك": "detangle",
    "تشابك": "tangle",
    "التشابك": "tangle",
    "اوف": "of",
    "انواع": "types",
    "بخلاصه": "extract",
    "وخلاصه": "extract",
    "كيراتين": "keratin",
    "بالكيراتين": "keratin",
    "الراس": "scalp",
    "لفروه": "scalp",
    "كير": "care",
    "للعنايه": "care",
    "العنايه": "care",
    "التالف": "damaged",
    "للتالف": "damaged",
    "والتالف": "damaged",
    "خصم": "discount",
    "عرض": "discount",
    "جنيه": "discount",
    "لجميع": "all",
    "جميع": "all",
    "الزيتون": "olive",
    "زيتون": "olive",
    "بالزيتون": "olive",
    "لتقويه": "strengthen",
    "مقوي": "strengthen",
    "قوه": "strengthen",
    "قوي": "strong",
    "لتقليل": "reduce",
    "العسل": "honey",
    "بالعسل": "honey",
    "اند": "and",
    "سيرم": "serum",
    "فاتح": "light",
    "لترطيب": "moisturizing",
    "ترطيب": "moisturizing",
    "مرطب": "moisturizing",
    "المرطب": "moisturizing",
    "تصفيف": "styling",
    "لتصفيف": "styling",
    "لاصلاح": "repair",
    "ريبير": "repair",
    "المغربي": "moroccan",
    "العادي": "normal",
    "بدون": "without",
    "امونيا": "ammonia",
    "انتنسيف": "intensive",
    "القمح": "wheat",
    "لحمايه": "protection",
    "حمايه": "protection",
    "نيتشر": "natural",
    "ناتشر": "natural",
    "ناتشورال": "natural",
    "ناتشرلز": "natural",
    "ناتشورالز": "natural",
    "الطبيعي": "natural",
    "فريز": "frizz",
    "كيرل": "curl",
    "الكيرلي": "curly",
    "الصبار": "aloe_vera",
    "بالصبار": "aloe_vera",
    "الثوم": "garlic",
    "بالثوم": "garlic",
    "جنين": "germ",
    "السوداء": "black",
    "لتطويل": "lengthening",
    "طويل": "long",
    "دائمه": "permanent",
    "الاصفر": "yellow",
    "الجوجوبا": "jojoba",
    "لمعان": "shine",
    "ولمعان": "shine",
    "ولامع": "shine",
    "لمعانه": "shine",
    "الافوكادو": "avocado",
    "المينك": "mink",
    "المنك": "mink",
    "والمتقصف": "split_ends",
    "متقصف": "split_ends",
    "كريمي": "creamy",
    "كلينيك": "clinic",
    "غامق": "dark",
    "اللوز": "almond",
    "باللوز": "almond",
    "واللوز": "almond",
    "السلفات": "sulfate",
    "سلفات": "sulfate",
    "لوك": "look",
    "ناعم": "soft",
    "والنعومه": "soft",
    "تنعيم": "soft",
    "فرد": "straighten",
    "مجموعه": "kit",
    "الاملا": "amla",
    "بروتينات": "proteins",
    "وبروتينات": "proteins",
    "وندر": "wonder",
    "لمنع": "prevent",
    "منع": "prevent",
    "ادفانسد": "advanced",
    "نمو": "growth",
    "لنمو": "growth",
    "مشط": "comb",
    "تكثيف": "thickening",
    "بديل": "substitute",
    "المجعد": "curly",
    "مجعد": "curly",
    "لتلوين": "coloring",
    "بيري": "berry",
}

UNIT_TOKENS = {"mg", "mcg", "ml", "gm", "l", "kg", "iu", "cc"}

FORM_TOKENS = {
    "tab", "cap", "syrup", "cream", "ointment", "gel", "drops",
    "spray", "injectable", "supp", "sachet", "suspension",
    "solution", "eff", "infant", "powder", "lotion", "paste",
    "shampoo", "conditioner", "oil", "serum", "mask", "soap",
    "wash", "roll_on", "stick", "splash", "perfume", "cleanser",
    "mouthwash", "bottle", "liniment",
    "deodorant", "condom", "pads", "diapers", "wipes", "razor",
    "shower_gel", "toothpaste", "lip_balm", "antiseptic",
    "alcohol", "baby_bottle", "hair_dye",
    "scrub", "wax", "foam", "earbuds", "liquid", "air_freshener",
    "gloves", "jelly", "herbs", "foot_file", "cotton", "pumice",
    "toothpick", "clipper", "beard_wash", "micellar", "loofah",
    "toilet_paper", "underwear", "strips",           # NEW
    "tweezers", "bath_foam", "aftershave", "shaving_foam",
    "oil_replacement", "douche", "sweetener", "stockings",
    "nursing_pads", "earplugs", "trimmer", "lenses", "trap",
    "compress", "plaster", "beard_oil", "cologne",
    "body_milk", "hair_restorer", "eyebrow_razor", "toilet_cover",
    "insecticide", "heel_rasp", "nail_polish_remover", # NEW
    "blue", "red", "green", "black", "white", "yellow",
    "pink", "purple", "orange", "brown", "grey", "gold", "silver", "beige", # NEW
    "scissors", "file", "sponge", "salt", "edp", "edt", "lotion",
    "body_butter", "whitening", "tampons", "eye_mask", "neck_pillow",
    "glue", "toothbrush", "mascara", "hardener", "lozenges",
    "hair_cream", "dental_floss", "glass_cleaner", "gargle",
    "sugar_wax", "tongue_cleaner", "panty_liners", "hand_wash",
    "body_splash", "body_spray", "body_mist", "shaving_gel",
    "navy", "jar", "sea", "bath", "peach", "orange",  # NEW
    "blackheads", "remover", "handle", "berry", "vanilla",
    "oriental", "separator", "toes", "plugs", "cover", "pillow",
    "neck", "oud", "pomegranate", "sanitizer", "brush", "hair",
    "gum", "makeup", "chocolate", "strawberry", "mint", "lemon",
    "lavender", "jasmine", "aloe_vera",              # NEW
    "feminine", "intimate", "double", "curved", "straight",
    "fiberglass", "sisal", "pedicure", "manicure", "heel",
    "beginners", "ergonomic", "economic", "hard", "complete",
    "activated", "cotton_candy", "blade", "shaving", "chrome",
    "edge", "ear", "diaper", "daily", "thick", "thin", "long",
    "cold", "wet", "baby", "maxi", "junior", "lips", "face",
    "body", "hands", "feet", "nails",                # NEW
    "natural", "skin", "normal", "dry", "sensitive", "teeth",
    "antiperspirant", "sweat", "refreshing",         # NEW
    "mosquito", "insects", "crawling", "flying", "killer",
    "repellent", "strip", "beard", "effervescent", "makhmaria",
    "family", "delka", "henna", "lice", "bonnet",    # NEW
    "for_hair", "with_butter", "with_extract", "for_dandruff",
    "treatment", "plus", "head", "with_coconut", "shine", "argan",
    "nourishing", "repair", "shiny", "for_scalp", "moisturizing",
    "hyaluron", "protein", "with_protein", "softener", "smooth",
    "silky", "recipe", "swimming", "with_avocado", "snake", "pure",
    "organic", "onion", "castor", "rice", "fermented", "fermented_rice", # NEW
    "oil", "paris", "women", "for_women", "men", "for_men", "free",
    "beauty", "me", "go", "bio", "ultra", "number", "set", # NEW
    "mask", "addict", "on", "pert", "body", "semi", "dox", "to_repair",
    "scented", "di_lino", "avril", "keratin", "butter", "mash", "head",
    "shoulders", "protection", "professional", "colored", "oil_replacement", # NEW
    "blonde", "detangling", "herbal", "essences", "code", "piece",
    "permanent", "mist", "temporary", "rich", "soft", "long", "chestnut",
    "iron", "with_seeds", "with_charcoal", "detox", "volume", "dark",
    "with_extracts", "fruit", "with_shea", "with_berry", "with_apple",
    "bambusa", "for_nits", "nits", "ultra", "light", "very", "molecular",
    "for_restoring", "oval", "large", "small", "double", "action", # NEW
    "premier", "ever", "types", "curls", "rosemary", "for_strengthening",
    "for_protection", "style", "and_strengthening", "and_thickening",
    "hairburst", "strong", "salone", "plumpy", "nigella", "organica",
    "restorex", "chirosa", "brylcreem", "shifu", "tola_hair", "dona",
    "schwarzkopf", "palette", "modish", "premium", "wet_brush", "princess",
    "disney", "with_herbs", # NEW
    "size", "support", "device", "belt", "medium", "blood", "elastic",
    "scale", "knee", "wrist", "open", "measurement", "pressure", "bandage",
    "varicose", "dressing", "digital", "for_adults", "glucose", "plaster",
    "for_ankle", "for_knee", "adhesive", "glass", "supporter", "arm",
    "medical", "abdomen", "for_measuring", "ratio", "surgical", "fingers",
    "sport", "compression", "splint", "thermometer", "for_wrapping",
    "around", "holder", "patches", "wounds", "bottle", "cooling",
    "for_neck", "test", "check", "temperature", "massage", "straightening",
    "reading", "silk", "tiger", "washable", "thumb", "latex",
    "hydrocolloid", "age", "elderly", "cast", "stockings",
    "suspensory", "scrotal", "swabs", "bidet", "bleeding", "collar",
    "neck", "philadelphia", "underpads", "shoe", "finger", "drugs",
    "walker", "pelvis", "catheter", "insole", "pills", "column", "spinal",
    "stethoscope", "forehead", "for_thumb", "protector",
    "unisex", "incontinence", "lancet", "hemorrhoids", "tap", # NEW
}
