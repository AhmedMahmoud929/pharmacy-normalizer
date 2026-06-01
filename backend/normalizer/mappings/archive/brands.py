# ---------------------------------------------------------------------------
# Brand name mapping (Arabic → English canonical brand)
# ---------------------------------------------------------------------------

BRAND_MAP: dict[str, str] = {
    # A
    "اموكسيل": "amoxil",
    "اوجمنتين": "augmentin",
    "املوديبين": "amlodipine",
    "افاميس": "avamys",
    "افوفا": "avova",
    "أفوفا": "avova",
    "افريكانا": "africana",
    "اديداس": "adidas",
    "أديداس": "adidas",
    "اكوا فريش": "aquafresh",
    "أماندا": "amanda",
    "اماندا": "amanda",
    "أماندا ميلانو": "amanda",                       # NEW
    "أزهى": "azha",                                  # NEW
    "ازهى": "azha",
    "أورال بي": "oral b",                            # NEW
    "اورال بي": "oral b",                            # NEW
    "اورال لايت": "oral light",                      # NEW
    "أورال- بي": "oral b",                           # NEW
    "أليجون": "eligun",                              # NEW
    "اليجون": "eligun",                              # NEW
    "أزوتيك ميكس": "azotic mix",                     # NEW
    "أكس": "axe",                                    # NEW
    "اكس": "axe",                                    # NEW
    "اكس ال": "xl",                                  # NEW
    "أوسوم": "awesome",                              # NEW
    "اوسوم": "awesome",                              # NEW
    "أكنو": "acno",                                  # NEW
    "اكنو": "acno",                                  # NEW
    "أفاق": "afaq",                                  # NEW
    "آفاق": "afaq",                                  # NEW
    "أما هير": "ama hair",                            # NEW
    "أيسى": "icy",                                   # NEW
    "أيس": "ice",                                    # NEW
    "أكرينال": "ecrinal",                            # NEW
    "اكرينال": "ecrinal",                            # NEW
    "أزارو": "azzaro",                               # NEW
    "ازارو": "azzaro",                               # NEW
    "أبديت": "update",                               # NEW
    "ابديت": "update",                               # NEW
    "أوكت ماكرو": "oct macro",                       # NEW
    "أوكت - فيمينين": "oct feminine",                # NEW
    "استيلين": "estelin",
    "أديداس": "adidas",
    "اديداس": "adidas",
    "اليس": "alice",                                 # NEW
    "ايما": "ema",                                   # NEW
    "إيما": "ema",                                   # NEW
    "ايبيك": "epic",                                 # NEW
    "إيزي كير": "easy care",                         # NEW
    "ايزي كير": "easy care",                         # NEW
    "إيزي سويت": "easy sweet",                       # NEW
    "ايزي سويت": "easy sweet",                       # NEW
    "إيزي": "easy",                                  # NEW
    "ايزي": "easy",                                  # NEW
    "أولد سبايس": "old spice",                       # NEW
    "اولد سبايس": "old spice",                       # NEW
    "أزهي": "azha",                                  # NEW
    "أزهى": "azha",                                  # NEW
    "أوريكس- إم جي": "oryx mg",                      # NEW
    "أوركس-إم جي": "oryx mg",                        # NEW
    "اورال شاين": "oral shine",                      # NEW
    "انجرام": "ingram",                              # NEW
    "اليجا": "elija",                                # NEW
    "إيف ميشيل": "eve michel",                       # NEW
    "ايف ميشيل": "eve michel",                       # NEW
    "ايفوني": "evony",                               # NEW
    "إيفوني": "evony",                               # NEW
    "ايكو ستايل": "eco style",                       # NEW
    "المصطفى": "al mostafa",                         # NEW
    "أزارو كروم": "azzaro chrome",                   # NEW
    "أزوتيك فليكس": "azotic flex",                   # NEW
    "أنيما دبل سبورت": "anima double sport",         # NEW
    "او ار بى": "orb",                               # NEW
    "اوبتي فري": "opti-free",                        # NEW
    "أوراسين": "oracin",                             # NEW
    "أورازان": "orazan",                             # NEW
    "أوريا": "urea",                                 # NEW
    "أورجاكيرا": "orgakera",                         # NEW
    "أو بى": "o.b.",                                 # NEW
    "ألبيسين": "alpecin",                            # NEW
    "اروما": "aroma",                                # NEW
    "أماندا": "amanda",                              # NEW
    "اماندا": "amanda",                              # NEW
    "أرديل": "ardell",                               # NEW
    "ايرا": "aira",                                  # NEW
    "ايلي": "elie",                                  # NEW
    "إيلى": "elie",                                  # NEW
    "افدانس بروفن": "advance_proven",                # NEW
    "ابينا": "abena",                                # NEW
    "أبون": "abone",                                 # NEW
    "اجرادو": "agrado",                              # NEW
    "اليكس كير": "alex_care",                        # NEW
    "الوكيتا": "alokita",                            # NEW
    "عنتر": "antar",                                 # NEW

    # B
    "بانادول": "panadol",
    "باندول": "panadol",
    "بروفين": "brufen",
    "بيتادين": "betadine",
    "بيكو": "bico",
    "بوبانا": "bobana",
    "بيزلين": "beesline",
    "بارودونتاكس": "parodontax",
    "بارودونتكس": "parodontax",                       # NEW
    "بيوديرما": "bioderma",
    "باليا": "balea",                                # NEW
    "بابلز": "bubbles",
    "بيبو": "bebo",
    "بامبرز": "pampers",
    "بيور": "pure",
    "بيور جلو": "pure glow",                          # NEW
    "بودى ليشيوس": "body licious",                   # NEW
    "بيوبوينت": "biopoint",                          # NEW
    "برايت": "bright",                               # NEW
    "بابيا": "papia",                                # NEW
    "باتيستي": "batiste",                            # NEW
    "بامبينو": "bambino",                            # NEW
    "بيبيتو": "bebeto",                              # NEW
    "بليدج": "pledge",                               # NEW
    "بينير": "pioneer",                              # NEW
    "بلو لاين": "blue line",                         # NEW
    "بى جى": "bg",                                   # NEW
    "بالموليف": "palmolive",                         # NEW
    "بيرز": "pears",                                 # NEW
    "بيرلا": "perla",                                # NEW
    "بانات": "banat",                                # NEW
    "بكسى فريش": "pixi fresh",                       # NEW
    "بيدرو": "pedro",                                # NEW
    "بيبي اكتيف": "baby active",                     # NEW
    "برودرينك": "prodrink",                          # NEW
    "بكسى": "pixi",                                  # NEW
    "بوتاتو": "potato",                              # NEW
    "بيندولين": "penduline",                         # NEW
    "بندولين": "penduline",
    "بوباي": "bobai",                                # NEW
    "براون": "braun",                                # NEW
    "بيوتي فورميلاز": "beauty formulas",             # NEW
    "بيو بالانس": "bio balance",                     # NEW
    "بيورير": "beurer",                              # NEW
    "باترفلاي": "butterfly",                         # NEW
    "بروت": "brut",                                  # NEW
    "بونيتا": "bonita",                              # NEW
    "بيونيكس": "bionnex",                            # NEW
    "بيوفيكس": "biofix",                             # NEW
    "بابلي": "bubbly",                               # NEW
    "باث اند": "bath & body works",                  # NEW
    "باث اند بادي وركس": "bath & body works",        # NEW
    "باث اند بودي ووركس": "bath & body works",        # NEW
    "باتيستي": "batiste",                            # NEW
    "بايوثرم": "biotherm",                           # NEW
    "بوديليشوس": "bodylicious",                      # NEW
    "بودي ليشوس": "bodylicious",                     # NEW
    "بوديم": "bodym",                                # NEW
    "بيونيك": "bionike",                             # NEW
    "بانابرايم": "panaprime",                        # NEW
    "بيو هير": "bio_hair",                           # NEW
    "بيوهير": "bio_hair",                            # NEW
    "بيولوكس": "biolux",                             # NEW
    "بايو لوكس": "biolux",                           # NEW
    "بلوكوبيشيا": "blocopicia",                      # NEW
    "بلوندي": "blondie",                             # NEW
    "بون": "bon",                                    # NEW
    "بابلز": "bubbles",                              # NEW
    "بريلكريم": "brylcreem",                         # NEW
    "بريشيك": "precheck",                            # NEW
    "بيورير": "beurer",                              # NEW
    "بيلا": "bella",                                 # NEW
    "بلستكس": "blistex",                             # NEW
    "بورجوا": "bourjois",                            # NEW
    "بوبانا": "bobana",                              # NEW
    "براون": "braun",                                # NEW

    # C
    "سيبرالكس": "cipralex",
    "سيتال": "cetal",
    "كولجيت": "colgate",
    "كوريغا": "corega",
    "كوريجا": "corega",                              # NEW
    "كلير": "clear",
    "كلوس اب": "close up",
    "كلوز اب": "close up",
    "كلوس أب": "close up",                           # NEW
    "كير & مور": "care & more",                      # NEW
    "كير أند مور": "care & more",                    # NEW
    "كير فري": "carefree",                           # NEW
    "كيرفري": "carefree",                            # NEW
    "كارمكس": "carmex",                              # NEW
    "كارمن": "carmen",                               # NEW
    "كامي": "camay",                                 # NEW
    "كاماي": "camay",                                # NEW
    "كوكو واكس": "coco wax",                         # NEW
    "كليوباترا": "cleopatra",                        # NEW
    "كوردو": "cordo",                                # NEW
    "كواليتا": "qualita",                            # NEW
    "كلر مي": "color me",                            # NEW
    "كولور مي": "color me",                          # NEW
    "سندريلا": "cinderella",                         # NEW
    "كوين": "queen",                                 # NEW
    "كلاري": "clari",                                # NEW
    "كانتو": "canto",                                # NEW
    "كليراديرم": "clearaderm",                       # NEW
    "كوكو": "coco",                                  # NEW
    "كيتادان": "ketadan",                            # NEW
    "كيور ايد": "cure-aid",                          # NEW
    "شاليس": "chalis",                               # NEW
    "تشيك": "schick",
    "شيف كود": "chef code",
    "خمس خمسات": "five fives",                       # NEW
    "كالفن كلاين": "calvin klein",                    # NEW
    "كارولينا هيريرا": "carolina herrera",            # NEW
    "كامارا": "camara",                              # NEW
    "سيرافى": "cerave",                              # NEW
    "كابري توب": "capri top",                        # NEW
    "كرست": "crest",                                 # NEW
    "سى اى اف": "cif",                               # NEW
    "كامينا": "camina",                              # NEW
    "كاروتين": "carroten",                           # NEW
    "كونترول": "control",                            # NEW
    "كراك دول": "crack doll",                        # NEW
    "كير لاين": "careline",                          # NEW
    "كارمن": "carmen",                               # NEW
    "كيريس": "caress",                               # NEW
    "كريس": "caress",                                # NEW
    "شيكو": "chicco",                                # NEW
    "تشوانغ ري": "chuang ri",                        # NEW
    "كلوريتا": "clorita",                            # NEW
    "كولور مي": "color me",                          # NEW
    "كلور مي": "color me",                           # NEW
    "كلوس اب": "close up",                           # NEW
    "كلوز اب": "close up",                           # NEW
    "كوزمو أبي": "cosmo api",                        # NEW
    "شيستي": "chisty",                               # NEW
    "كاريزما": "charisma",                           # NEW
    "كاوس كيدز": "chaos_kids",                       # NEW
    "شيروسا": "chirosa",                             # NEW

    # D
    "دولفين": "dolphin",
    "ديكساميثازون": "dexamethasone",
    "داكتارين": "daktarin",
    "ديكلاك": "diclac",
    "ديوركس": "durex",
    "ديتول": "dettol",
    "دوف": "dove",
    "دابر": "dabur",
    "دابر هربال": "dabur",                           # NEW
    "دراى فريش": "dry fresh",
    "دراكون": "drakon",
    "دوركو": "dorco",                                # NEW
    "ديوديرم": "deoderm",                            # NEW
    "ديفول": "devol",                                # NEW
    "ديرماكتيف": "dermactive",                       # NEW
    "كاتريس": "catrice",                             # NEW
    "سيبال": "cybele",                               # NEW
    "سيبيل": "cybele",                               # NEW
    "ديڤا": "diva",                                  # NEW
    "ديرماتيك": "dermatics",                         # NEW
    "ديرما اكتيف": "dermactive",                     # NEW
    "ديوك": "duke",                                  # NEW
    "كونفاتيك": "convatec",                          # NEW
    "ديبلومات": "diplomat",                          # NEW
    "دير": "deer",                                   # NEW
    "دازلينج وايت": "dazzling white",                # NEW
    "دى جى وايت": "dj white",                        # NEW
    "دكتور في": "dr. v",                             # NEW
    "دكتور سان": "dr. san",                          # NEW
    "دكتور ميد": "dr. med",                          # NEW
    "ديوركس": "durex",
    "دانهيل": "dunhill",                             # NEW
    "ديسيو": "desio",                                # NEW
    "دراى": "dry",                                   # NEW
    "ديب هيت": "deep heat",                          # NEW
    "ديبوردنت": "depurdent",                         # NEW
    "ديفير": "differ",                               # NEW
    "درمانت": "dermant",                            # NEW
    "دكتور راشيل": "dr. rashel",                     # NEW
    "دكتور ارجان": "dr. argan",                      # NEW
    "دراى جو": "dry go",                             # NEW
    "دى جى لونج": "dj long",                         # NEW
    "د فلودنت": "dr. flodent",                       # NEW
    "ديرموميد": "dermomed",                          # NEW
    "دونتودنت": "dontodent",                         # NEW
    "دنتون": "denton",                               # NEW
    "دي جي كير": "dj care",                          # NEW
    "دوشيال": "doshial",                             # NEW
    "دينت بلس": "dent plus",                         # NEW
    "دنلوب": "dunlop",                               # NEW

    # E
    "ايفا": "eva",
    "ايڤا": "eva",
    "إيفا": "eva",                                   # NEW
    "انليفن": "enliven",
    "ان ليفين": "enliven",                           # NEW
    "إيفر بيور": "ever pure",
    "ايما": "ema",                                   # NEW
    "ايبلين": "ebelin",                              # NEW
    "ايسنس": "essence",                              # NEW
    "ايسينس": "essence",                             # NEW
    "انيركوس": "enercos",                            # NEW
    "ايفوني": "evony",                               # NEW
    "إيموفورم": "emoform",                           # NEW
    "إيموفورم-إف": "emoform",                        # NEW
    "استيارا": "estiara",                            # NEW
    "انشانتر": "enchanteur",                         # NEW
    "أمبير": "emper",                                # NEW
    "امبر": "emper",                                 # NEW
    "ايلي ساب": "elie saab",                         # NEW
    "إيليت": "elite",                                # NEW
    "ايميل ديامانت": "email diamant",                # NEW
    "ان ليفين": "enliven",                           # NEW
    "انكتو": "inecto",                               # NEW
    "انتيكو": "antico",                              # NEW
    "اسكادا": "escada",                              # NEW

    # F
    "فولتارين": "voltaren",
    "فيوسيدين": "fusidin",
    "فنتولين": "ventolin",
    "فلاجيل": "flagyl",
    "فينادون": "fenadon",
    "فينستيل": "fenistil",
    "فيبروسيل": "vibrocil",
    "فلوموكس": "flumox",
    "فليكسوناز": "flixonase",
    "فوكس": "fox",
    "فوج": "fogg",
    "فلة": "fulla",
    "فا": "fa",
    "فيت": "veet",
    "ڤيت": "veet",                                   # NEW
    "فاين": "fine",
    "فلورنتينا": "florentina",                       # NEW
    "فلورينتينا": "florentina",                      # NEW
    "فريدا": "frida",                                # NEW
    "فلافي": "fluffy",                               # NEW
    "فلامنجو": "flamingo",                           # NEW
    "فافيلين": "vaveline",                           # NEW
    "فريش توك": "fresh talk",                        # NEW
    "فيل جود": "feel good",                          # NEW
    "فيمي 9": "femi 9",                              # NEW
    "فيم": "fem",                                    # NEW
    "فيم فريش": "femfresh",                          # NEW
    "فلورو": "fluoro",                               # NEW
    "فليكرز دنت": "flickerz dent",                   # NEW
    "فيوناتاج": "fionatage",                         # NEW
    "فاكيشن": "vacation",                            # NEW
    "فيرنا بيوتيكا": "verna biotica",                # NEW
    "فيردول": "verdol",                              # NEW
    "فنجي كير": "fungicare",                         # NEW
    "فروتينا": "frutina",                            # NEW
    "فريش دايز": "fresh days",                       # NEW
    "فولتن": "foltene",                              # NEW
    "فيت بار": "fit bar",                            # NEW
    "فافلين": "vavline",                             # NEW
    "فوكس": "fuchs",                                 # NEW
    "فاميليا": "familia",                            # NEW
    "فيوري": "fiore",                                # NEW
    "فيانسية": "fiancee",                            # NEW
    "فيرو": "fiero",                                 # NEW
    "فاشكول": "fashkool",                            # NEW
    "فوليتون": "folitone",                           # NEW
    "فاست كير": "fast_care",                         # NEW
    "فايسيد": "viced",                               # NEW
    "فيرست فوك": "first_focus",                      # NEW
    "فاين كير": "fine_care",                         # NEW
    "فلامنجو": "flamingo",                           # NEW
    "فاستر": "faster",                               # NEW
    "فليكسي": "flexy",                               # NEW
    "فلايون": "flyon",                               # NEW
    "فليون": "flyon",                                # NEW
    "فورتونا": "fortuna",                            # NEW
    "فايف دي": "5d",                                 # NEW

    # G
    "جيليت": "gillette",
    "جيلت": "gillette",
    "جليد": "glade",
    "جليسوليد": "glysolid",
    "جولد": "gold",                                  # NEW
    "جي دوكس": "g-dox",                              # NEW
    "جم سى": "gum c",                                # NEW
    "جيرمانى": "germany",                            # NEW
    "جريس": "grace",                                 # NEW
    "جوت تو بي": "got2b",                            # NEW
    "جي كازانوفا": "j. casanova",                    # NEW
    "جريت من": "great man",                          # NEW
    "جرين لييف": "green leaf",                       # NEW
    "جليس": "gliss",                                 # NEW
    "جيرلي": "girly",                                # NEW
    "جرلي": "girly",                                 # NEW
    "جرانزيا": "granzia",                            # NEW
    "جيبسونا": "gypsona",                            # NEW

    # H
    "هيستازين": "histazin",
    "هيد اند شولدرز": "head & shoulders",
    "هيد أند شولدرز": "head & shoulders",            # NEW
    "هاي جين": "hi geen",
    "هير كود": "hair code",                          # NEW
    "هيركود": "hair code",                           # NEW
    "حياة سترالين": "hayat stralin",                 # NEW
    "هيمالايا": "himalaya",                          # NEW
    "هيدرافيت": "hydravit",                          # NEW
    "هارفي": "harvey",                               # NEW
    "هاندي": "handy",                                # NEW
    "هابي": "happy",                                 # NEW
    "هابى": "happy",                                 # NEW
    "حرير": "harir",                                 # NEW
    "هيوجو بوس": "hugo boss",                        # NEW
    "هوجو بوس": "hugo boss",                         # NEW
    "هاجيز": "huggies",                              # NEW
    "هوجو": "hugo",                                  # NEW
    "هوغو بوس": "hugo boss",                         # NEW
    "هيديرم": "heiderm",                             # NEW
    "هيالو-فيم": "hyalo-fem",                        # NEW
    "هوت سترايك": "hot strike",                      # NEW
    "هيربال": "herbal essences",                     # NEW
    "هيرا": "hera",                                  # NEW
    "هيربري": "hairberry",                           # NEW
    "هير ويلث": "hair_wealth",                       # NEW
    "هوالي": "huali",                                # NEW
    "حياة": "hayat",                                 # NEW
    "هيلثي": "healthy",                              # NEW
    "هيفين": "heaven",                               # NEW
    "هاي لايف": "high_life",                         # NEW
    "هاى ميديك": "high_medic",                       # NEW
    "هولدر": "holder",                               # NEW

    # I
    "انفينيتي": "infinity",
    "اي-ام": "i_m",                                  # NEW
    "إمبريس": "impress",                             # NEW
    "امبريس": "impress",                             # NEW
    "ايمبريس": "impress",                            # NEW
    "آي إم": "i_m",                                  # NEW
    "إيزيس": "isis",
    "ايزيس": "isis",
    "إيزابيلا": "isabella",
    "إنفينيتي ناتشورالز": "infinity naturals",       # NEW

    # J
    "جونسون": "johnson",
    "جويس": "joyce",                                 # NEW
    "جوفياليتي": "joviality",                        # NEW
    "جوي دروبس": "joy drops",                        # NEW
    "جونميرا": "jonmera",                            # NEW
    "كيكو ميلانو": "kiko_milano",                    # NEW
    "جون فرانس": "jean_francois",                    # NEW
    "جاسبر": "jasper",                               # NEW

    # K
    "كتافلام": "cataflam",
    "كونجستال": "congestal",
    "كانستين": "canesten",
    "كلاريتين": "claritine",
    "كولاجرا": "kolagra",
    "كيماجيل": "kemagel",                            # NEW
    "كينج سي جيليت": "king c gillette",              # NEW

    # L
    "لوريال": "loreal",
    "لونا": "luna",
    "ليسترين": "listerine",
    "ليسترن": "listerine",                           # NEW
    "لابيلو": "labello",
    "لاكمي": "lakme",                                # NEW
    "ليدي سبيد ستيك": "lady speed stick",
    "ليدي سبيد": "lady speed stick",
    "لوكس": "lux",                                   # NEW
    "ليلاك": "lilac",                                # NEW
    "لايفبوي": "lifebuoy",                           # NEW
    "لايف بوي": "lifebuoy",                          # NEW
    "لانا": "lana",                                  # NEW
    "لو فالكون": "le falcon",                        # NEW
    "لايف فى": "life femi",                          # NEW
    "لورد": "lord",                                  # NEW
    "لارا": "lara",                                  # NEW
    "لاكتوهيرب": "lactoherb",                        # NEW
    "لوجوسجين": "logusgin",                          # NEW
    "لوريجين": "l'origine",                          # NEW
    "ل اوريجين": "l'origine",                        # NEW
    "ليدي سوفت": "lady soft",                        # NEW
    "لايف كير": "life care",                         # NEW
    "ليسيو": "lissio",                               # NEW
    "لوريال": "l'oreal",                             # NEW
    "لوريال باريس": "l'oreal",                       # NEW
    "لوتس": "lotus",                                 # NEW
    "لافي نيتروال": "la vie natural",                # NEW
    "لوكن": "looken",                                # NEW
    "ليكسورا": "lexura",                             # NEW

    # M
    "مود": "mood",
    "مان لوك": "man look",
    "مان لوك إكسبرت": "man look",                    # NEW
    "مولبيد": "molped",
    "مولبد": "molped",
    "المسواك": "miswak",
    "ميلانو": "milano",
    "ماكس تاتش": "max touch",                        # NEW
    "موروكان اويل": "moroccan oil",                  # NEW
    "ميلاتكس": "melatex",                            # NEW
    "موفيليكس": "movilix",                           # NEW
    "ميكوناز": "miconaz",                            # NEW
    "ماريمر": "marimer",                             # NEW
    "ماش بريمير": "mash premier",                    # NEW
    "ماش بريميير": "mash premier",                   # NEW
    "ماش": "mash",                                   # NEW
    "مايبيلين": "maybelline",                        # NEW
    "ميبلين": "maybelline",                          # NEW
    "مافالا": "mavala",                              # NEW
    "ميلانو فارما": "milano_pharma",                 # NEW
    "ميفوليس": "mivolis",                            # NEW
    "ميديا": "media",                                # NEW
    "مود": "mood",                                   # NEW
    "ميديل": "medel",                                # NEW
    "ميدزانا": "medzana",                            # NEW
    "ميراكل": "miracle",                             # NEW
    "ميركل": "miracle",                              # NEW
    "مموا": "mmoi",                                  # NEW
    "مينوكسيلوك": "minoxilook",                      # NEW
    "مورا": "mora",                                  # NEW
    "مستر ماسل": "mr. muscle",                       # NEW
    "ماليزيا": "malaysia",                           # NEW
    "ماستر لاش": "master lash",                      # NEW
    "ميديميكس": "medimix",                           # NEW
    "مستر ستار": "mr. star",                         # NEW
    "مولفيكس": "molfix",                             # NEW
    "موروكانويل": "moroccanoil",                     # NEW
    "مالفا": "malva",                                # NEW
    "ميليسا": "melissa",                             # NEW
    "ميجو": "migo",                                  # NEW
    "ميرادا": "mirada",                              # NEW
    "ماكرو أوكتي": "macro octi",                     # NEW
    "ماين كرافت": "minecraft",                       # NEW

    # N
    "نيكسيوم": "nexium",
    "نازونكس": "nasonex",
    "نيفيا": "nivea",
    "نيجيلا": "nigella",                             # NEW
    "نانو تريت": "nano treat",
    "نانوتريت": "nano treat",                        # NEW
    "نورميلان": "normilan",                          # NEW
    "نايك": "nike",                                  # NEW
    "نايس لايف": "nice life",                        # NEW
    "نيكوريت": "nicorette",                          # NEW
    "نيودين": "neodine",                             # NEW
    "نيوتريفام": "nutrifam",                         # NEW
    "نيرامار": "niramar",                            # NEW
    "نيبولا": "nebula",                              # NEW
    "نو هير": "no hair",                             # NEW
    "نولافير": "nolaver",                            # NEW
    "نات شل": "nat shell",                           # NEW
    "نسايم": "nasayem",                              # NEW
    "نوكس": "nuxe",                                  # NEW
    "نيو ستايل سفن": "new style 7",                  # NEW
    "نابلسي شاهين": "nabulsi shahin",                # NEW
    "نابلس": "nabulsi",                              # NEW
    "ناسيتا": "nascita",                             # NEW
    "نانو": "nano",                                  # NEW
    "ناتشرز باونتي": "nature's bounty",              # NEW
    "نورمال كلينيك": "normal clinic",                # NEW

    # O
    "اوتريفين": "otrivin",
    "اوتريفين ساينوس": "otrivin sinus",
    "اوميجا": "omega",
    "اورال": "oral",
    "اولويز": "always",
    "ألويز": "always",
    "الويز": "always",                               # NEW
    "أوكت - فيمينين": "oct feminine",                # NEW
    "اون": "on",                                     # NEW
    "اوميجا كير": "omega_care",                      # NEW
    "اوبو": "oppo",                                  # NEW
    "وان بوند": "one bond",                          # NEW
    "وان تاتش": "one touch",                         # NEW
    "أوروفكس": "orovex",                             # NEW
    "اونكس": "onyx",                                 # NEW
    "أوروفكس": "orovex",                             # NEW
    "اولابلكس": "olaplex",                           # NEW
    "اولابليكس": "olaplex",                          # NEW
    "أرثوباد": "orthopad",                           # NEW
    "ارثوباد": "orthopad",                           # NEW
    "اون كول": "on_call",                            # NEW
    "أورجانيكا": "organica",                         # NEW

    # P
    "باراسيتامول": "paracetamol",
    "بانتين": "pantene",
    "باكو رابان": "paco rabanne",
    "برايفت": "private",                             # NEW
    "بالموليف": "palmolive",                         # NEW
    "بوتاتو": "potato",                              # NEW
    "بيندولين": "penduline",                         # NEW
    "بيرفيومرز": "perfumer's choice",                # NEW
    "كوالاتكس": "qualatex",                          # NEW
    "فارما باك": "pharmapack",                       # NEW
    "بلانت هيلث": "plant_health",                    # NEW
    "بلانت هيلت": "plant_health",                    # NEW
    "فارماباك": "pharmapack",                        # NEW
    "بلمبى": "plumpy",                               # NEW
    "بلمبى كيرلز": "plumpy_curls",                   # NEW

    # Q
    "كواليتا": "qualita",                            # NEW
    "كويك اند": "quick & clean",                     # NEW

    # R
    "رينومار": "rhinomar",
    "ريكسونا": "rexona",
    "ريد": "raid",
    "رويال": "royal",
    "ريفون": "rivon",                                # NEW
    "روسماكس": "rossmax",                            # NEW
    "راش برش": "rush_brush",                         # NEW
    "ريستوركس": "restorex",                          # NEW
    "رويتس": "roots",                                # NEW
    "روفا اسبانيا": "rofa_spain",                    # NEW
    "رو افريكان": "raw_african",                     # NEW
    "روفادين": "rovadin",                            # NEW
    "روفان": "rovan",                                # NEW
    "روفا اسبانيا": "rova",                          # NEW
    "ريجين": "rogaine",                              # NEW
    "راكسيرا": "raxera",                             # NEW
    "ريلاكس فام": "relax fem",                        # NEW
    "ريلاكس": "relax",                               # NEW
    "ريف": "reeve",                                  # NEW
    "رومانس": "romance",                             # NEW
    "ريفارست": "revarrest",                          # NEW
    "رايت جارد": "right guard",                      # NEW
    "ريل مان": "real man",                           # NEW
    "ريال مان": "real man",                          # NEW
    "ريلمان": "real man",                            # NEW

    # S
    "سودوكريم": "sudocrem",
    "سنسوداين": "sensodyne",
    "ستارفيل": "starville",
    "شان": "shaan",
    "سيجنال": "signal",
    "سوفي": "sofy",
    "سوفى": "sofy",                                  # NEW
    "سينزو -1": "senso-1",                           # NEW
    "سنسوديرم": "sensoderm",                         # NEW
    "سلينكي": "slinky",                              # NEW
    "سيكريت": "secret",                              # NEW
    "ستاركي": "starky",                              # NEW
    "سدرة": "sidra",                                 # NEW
    "شهرزاد": "shahrazad",                           # NEW
    "اس جي اس": "sgs",                               # NEW
    "سانيتا": "sanita",                              # NEW
    "سوبر كيدز": "super kids",                       # NEW
    "سمارت كولكشن": "smart collection",               # NEW
    "سمارت هوم": "smart home",                       # NEW
    "سى بيرل": "sea pearl",                          # NEW
    "سيلك بلاست": "silk plast",                      # NEW
    "سافلون": "savlon",                              # NEW
    "سيكم": "sekem",                                 # NEW
    "سيكام": "sekem",                                # NEW
    "سافيور": "saviour",                             # NEW
    "سايرو": "sairo",                                # NEW
    "سابيل": "sapil",                                # NEW
    "سبيل": "sapil",                                 # NEW
    "سانت ايفز": "st. ives",                         # NEW
    "سانت آيفز": "st. ives",                         # NEW
    "سلازنجر": "slazenger",                          # NEW
    "سوب اند غلوري": "soap & glory",                 # NEW
    "سولوديكس": "solodex",                           # NEW
    "سوناتا": "sonata",                              # NEW
    "سبيدي كلين": "speedy clean",                    # NEW
    "شى": "she",                                     # NEW
    "سينس لايت": "sense light",                      # NEW
    "سيباميد": "sebamed",                            # NEW
    "سان": "san",                                    # NEW
    "سانداكير": "sandacare",                         # NEW
    "ساني": "sani",                                  # NEW
    "شول": "scholl",                                 # NEW
    "سيفودون": "sevodon",                            # NEW
    "سيناتور": "senator",                            # NEW
    "سومافي": "somavi",                              # NEW
    "سانوسان": "sanosan",                            # NEW
    "السادا": "alsada",                              # NEW
    "دونا": "dona",                                  # NEW
    "ديرما اكتيف": "derma_active",                   # NEW
    "دوكراي": "ducray",                              # NEW
    "شيفو": "shifu",                                 # NEW
    "سترونج فيل": "strong_ville",                    # NEW
    "سيري لامبانج": "siri_lampang",                  # NEW
    "سبيشيال": "special",                            # NEW
    "سبيشال": "special",                             # NEW
    "ستيفيانا": "steviana",                          # NEW
    "ستيرى-ستريب": "steri_strip",                   # NEW
    "ستيري ستريب": "steri_strip",                    # NEW

    # T
    "تلفاست": "telfast",
    "تريسيمي": "tresemme",
    "تريو": "trio",                                  # NEW
    "تريو برو": "trio pro",                          # NEW
    "تيجاديرم": "tegaderm",                          # NEW
    "ذا باث لاند": "the_bath_land",                  # NEW
    "تراى تكت": "tri-tect",                          # NEW
    "تيريزيا": "teresia",                            # NEW
    "تمارا": "tamara",                               # NEW
    "تيلر": "tiler",                                 # NEW
    "توب ميديكال": "top medical",                    # NEW
    "تامباكس": "tampax",                             # NEW
    "توب": "top",                                    # NEW
    "تريند": "trend",                                # NEW
    "ثيراميد": "theramed",                           # NEW
    "تيمو": "temo",                                  # NEW
    "يوني فركتوز": "uni_fructose",                   # NEW
    "فينوسان": "venosan",                            # NEW
    "ياكسي": "yaxi",                                 # NEW
    "يولو": "yolo",                                  # NEW
    "ياسمينا": "yasmina",                            # NEW
    "زولا": "zola",                                  # NEW
    "تينكل": "tinkle",                               # NEW
    "ذا بادي شوب": "the body shop",                  # NEW
    "تريسمي": "tresemme",                            # NEW
    "توب تول": "top_tool",                           # NEW
    "تيتانيا": "titania",                            # NEW
    "تريم ميديكال": "trim_medical",                  # NEW
    "تريكو": "trico",                                # NEW

    # U
    "يورياج": "uriage",                              # NEW
    "الترا صن": "ultrasun",                          # NEW

    # V
    "فاتيكا": "vatika",
    "فازلين": "vaseline",
    "فيشي": "vichy",
    "فيبكس": "vibex",
    "فيبيكس": "vibex",                               # NEW
    "في": "v",                                       # NEW
    "في-جارد": "v-guard",                            # NEW
    "في-جى نورم": "vg norm",                         # NEW
    "فيوناتاج": "fionatage",                         # NEW
    "فيكتوريا سيكريت": "victoria's secret",          # NEW
    "فيلفت": "velvet",                               # NEW
    "فيلفيت": "velvet",                              # NEW
    "في بيوتي": "v beauty",                          # NEW
    "فاي": "vi",                                     # NEW
    "فيفاريا": "vivarea",                            # NEW
    "في جي ار": "vgr",                               # NEW
    "فاسو": "vasso",                                 # NEW

    # W
    "واييت": "white",                                # NEW
    "وايت": "white",                                 # NEW
    "وايب ات": "wipe it",                            # NEW
    "ويندكس": "windex",                              # NEW
    "ويف": "wave",                                   # NEW

    # Y
    "يولو": "yolo",
    "يوريمل": "urimel",                              # NEW
    "يارا": "yara",                                  # NEW
    "يورياج": "uriage",                              # NEW
    "واي ام": "ym",                                  # NEW
    "يوكو": "yoko",                                  # NEW

    # Z
    "زوفيراكس": "zovirax",
    "زيرتيك": "zyrtec",
    "زاك": "zak",
    "زينة": "zeina",
    "زينا": "zeina",                                 # NEW
    "زركونيا": "zirconia",                           # NEW
    "زاكت": "zact",                                  # NEW
    "زيسيتو": "ziseto",                              # NEW
    "زي": "z",                                       # NEW

    "kamena": "kamena",
    "كامينا": "kamena",
    "haircode": "haircode",
    "هيركود": "haircode",
    "avenox": "avenox",
    "افينوكس": "avenox",
    "frootina": "frootina",
    "فروتينا": "frootina",
    "dear": "dear",
    "ديير": "dear",
    "keto": "keto",
    "كيتو": "keto",
    "senor": "senor",
    "سينور": "senor",
    "سنيور": "senor",
    "never die": "never_die",
    "نيفر داي": "never_die",
    "amanda": "amanda",
    "أماندا": "amanda",
    "اماندا": "amanda",
    "savannah": "savannah",
    "سافانا": "savannah",
    "dry": "dry",
    "دراى": "dry",
    "دراي": "dry",
    "savior": "savior",
    "سافيور": "savior",
    "b-fresh": "b_fresh",
    "بي - فريش": "b_fresh",
    "escada taj": "escada_taj",
    "اسكادا تاج": "escada_taj",
    "givenchy dahlia divin": "givenchy_dahlia_divin",
    "جيفنشي داليا ديفين": "givenchy_dahlia_divin",
    "khamrah": "khamrah",
    "خمرة": "khamrah",
    "lacoste blanc": "lacoste_blanc",
    "لاكوست بلانك": "lacoste_blanc",
    "lacoste white": "lacoste_blanc",
    "لاكوست وايت": "lacoste_blanc",
    "lady million": "lady_million",
    "ليدي مليون": "lady_million",
    "lancome": "lancome",
    "لانكوم": "lancome",
    "maison de paris": "maison_de_paris",
    "ميزون دو باريس": "maison_de_paris",
    "olympea": "olympea",
    "اولمبيا": "olympea",
    "1 million": "one_million",
    "وان مليون": "one_million",
    "invictus": "invictus",
    "انفيكتوس": "invictus",
    "sauvage": "sauvage",
    "سوفاج": "sauvage",
    "giorgio armani si": "giorgio_armani_si",
    "جورجيو أرماني سي": "giorgio_armani_si",
    "si passione": "si_passione",
    "سي باشون": "si_passione",
    "spicebomb": "spicebomb",
    "سبايس بومب": "spicebomb",
    "stronger with you": "stronger_with_you",
    "سترونجر ويز يو": "stronger_with_you",
    "septona": "septona",
    "سيبتونا": "septona",
    "vanery": "vanery",
    "فانيري": "vanery",
    "titania": "titania",
    "تيتانيا": "titania",
    "five fives": "five_fives",
    "خمس خمسات": "five_fives",
    "ثلاث خمسات": "three_fives",
    "happy dream": "happy_dream",
    "هابي دريم": "happy_dream",
    "love i": "love_i",
    "لف اي": "love_i",
    "molped": "molped",
    "مولبيد": "molped",
    "mego's": "megos",
    "ميجوز": "megos",
    "good eve": "good_eve",
    "جود ايف": "good_eve",
    "shave code": "shave_code",
    "شيف كود": "shave_code",
    "firma care": "firma_care",
    "فيرما كير": "firma_care",
    "firma": "firma",
    "فيرما": "firma",
    "sterillium": "sterillium",
    "ستيريليوم": "sterillium",
    "sapil": "sapil",
    "سابيل": "sapil",
    "swim guard": "swim_guard",
    "سويم جارد": "swim_guard",
    "helmaderm": "helmaderm",
    "هيلماديرم": "helmaderm",
    "dry show": "dry_show",
    "دري شو": "dry_show",
    "nine times": "nine_times",
    "ناين تايمز": "nine_times",
    "premier": "premier",
    "بريميير": "premier",
    "medova": "medova",
    "ميدوفا": "medova",
    "hi do": "hi_do",
    "هاي دو": "hi_do",
    "she daisy": "she_daisy",
    "شي ديزي": "she_daisy",
    "bg": "bg",
    "بي جي": "bg",
    "chaos": "chaos",
    "كاوس": "chaos",
    "melatex": "melatex",
    "ميلاتكس": "melatex",
    "zat": "zat",
    "زات": "zat",
    "hair daily": "hair_daily",
    "هاير دايلي": "hair_daily",
    "هير دايلي": "hair_daily",
    "extra": "extra",
    "اكسترا": "extra",
    "pyrsol": "pyrsol",
    "بيرسول": "pyrsol",
    "good care": "good_care",
    "جود كير": "good_care",
    "fiona": "fiona",
    "فيونا": "fiona",
    "kerox": "kerox",
    "كيروكس": "kerox",
    "avova": "avova",
    "افوفا": "avova",
    "أفوفا": "avova",
    "bobana": "bobana",
    "بوبانا": "bobana",
    "lara care": "lara_care",
    "لارا كير": "lara_care",
    "lara": "lara",
    "لارا": "lara",
    "alevana": "alevana",
    "اليفانا ستار جوفيت": "alevana",
    "اليفانا": "alevana",
    "alaska": "alaska",
    "الاسكا": "alaska",
    "amanda milano": "amanda_milano",
    "اماندا ميلانو": "amanda_milano",
    "care & more": "care_and_more",
    "كيراند مور": "care_and_more",
    "كير & مور": "care_and_more",
    "coco": "coco",
    "كوكو": "coco",
    "derma 10": "derma_10",
    "ديرما 10": "derma_10",
    "dr. rashel": "dr_rashel",
    "د. راشيل": "dr_rashel",
    "enchanteur": "enchanteur",
    "إنشانتور": "enchanteur",
    "le karite": "le_karite",
    "لى كاريتيه": "le_karite",
    "navii": "navii",
    "نافي": "navii",
    "ventamor": "ventamor",
    "فينتامور": "ventamor",
    "memwa": "memwa",
    "مموا": "memwa",
    "mint fresh": "mint_fresh",
    "منت فريش": "mint_fresh",
    "mr muscle": "mr_muscle",
    "مستر ماسل": "mr_muscle",
    "nano treat": "nano_treat",
    "نانو تريت": "nano_treat",
    "oral shine": "oral_shine",
    "اورال شاين": "oral_shine",
    "orix mg": "orix_mg",
    "أوركس-إم جي": "orix_mg",
    "أوريكس- إم جي": "orix_mg",
    "paco rabanne": "paco_rabanne",
    "باكو رابان": "paco_rabanne",
    "papia": "papia",
    "بابيا": "papia",
    "perla": "perla",
    "بيرلا": "perla",
    "pears": "pears",
    "بيرز": "pears",
    "penduline": "penduline",
    "بيندولين": "penduline",
    "بندولين": "penduline",
    "potato": "potato",
    "بوتاتو": "potato",
    "ob_procomfort": "ob_procomfort",
    "بروكومفورت أو بي": "ob_procomfort",
    "pure": "pure",
    "بيور": "pure",
    "raxeira": "raxeira",
    "راكسييرا": "raxeira",
    "revitaly": "revitaly",
    "ريفيتالي": "revitaly",
    "royal": "royal",
    "رويال": "royal",
    "sanita": "sanita",
    "سانيتا": "sanita",
    "sekem": "sekem",
    "سيكم": "sekem",
    "سيكام": "sekem",
    "smart home": "smart_home",
    "سمارت هوم": "smart_home",
    "smart collection": "smart_collection",
    "سمارت كولكشن": "smart_collection",
    "astiki": "astiki",
    "استيكي": "astiki",
    "super kids": "super_kids",
    "سوبر كيدز": "super_kids",
    "jawaher": "jawaher",
    "جواهر": "jawaher",
    "ted lapidus": "ted_lapidus",
    "تيد لابيدوس": "ted_lapidus",
    "theramed": "theramed",
    "ثيراميد": "theramed",
    "disila": "disila",
    "ديسيلا": "disila",
    "twist & go": "twist_and_go",
    "تويست اند جو": "twist_and_go",
    "famex": "famex",
    "فاميكس": "famex",
    "vatika": "vatika",
    "فاتيكا": "vatika",
    "velvet": "velvet",
    "فيلفت": "velvet",
    "فيلفيت": "velvet",
    "xl": "xl",
    "إكس إل": "xl",
    "uno": "uno",
    "يونو": "uno",
    "yves michel": "yves_michel",
    "إيف ميشيل": "yves_michel",
    "zeina": "zeina",
    "زينه": "zeina",
    "زينة": "zeina",
    "z": "z",
    "زي": "z",
    "feel good": "feel_good",
    "فيل جود": "feel_good",
    "raw african": "raw_african",
    "رو افريكان": "raw_african",
    "رو أفريكان": "raw_african",
    "babe": "babe",
    "بابي": "babe",
    "she": "she",
    "هي": "she",
    "q sani hex": "q_sani_hex",
    "كيو ساني هكس": "q_sani_hex",
    "beurer": "beurer",
    "بيورير": "beurer",
    "purederm": "purederm",
    "بيورديرم": "purederm",
    "calvin klein": "calvin_klein",
    "كيلفين كلاين": "calvin_klein",
    "nut shell": "nut_shell",
    "نات شل": "nut_shell",
    "bodylicious": "bodylicious",
    "بوديليشوس": "bodylicious",
    "joviality": "joviality",
    "جوفياليتي": "joviality",
    "alice": "alice",
    "اليس": "alice",
    "derweis": "derweis",
    "ديرويس": "derweis",
    "givan": "givan",
    "جيفان": "givan",
    "femfresh": "femfresh",
    "فيم فريش": "femfresh",
    "milano pharma": "milano_pharma",
    "ميلانو فارما": "milano_pharma",
    "n natural": "n_natural",
    "ان ناتشورال": "n_natural",
    "areej": "areej",
    "أريج": "areej",
    "the hair addict": "the_hair_addict",
    "ذا هير اديكت": "the_hair_addict",
    "avec l'or": "avec_l_or",
    "أفيك ليور": "avec_l_or",
    "bioblas": "bioblas",
    "بيوبلاس": "bioblas",
    "bio me": "bio_me",
    "بايو مي": "bio_me",
    "trims 10": "trims_10",
    "تريمز 10": "trims_10",
    "body way": "body_way",
    "بودى واى": "body_way",
    "acadia": "acadia",
    "اكاديا": "acadia",
    "mash premiere": "mash_premiere",
    "ماش بريمير": "mash_premiere",
    "vebix": "vebix",
    "فيبيكس": "vebix",
    "tricol": "tricol",
    "تريكول": "tricol",
    "marvel": "marvel",
    "مارفيل": "marvel",
    "no acne": "no_acne",
    "نو اكني": "no_acne",
    "rofa": "rofa",
    "روفا": "rofa",
    "azha": "azha",
    "ازهي": "azha",
    "أزها": "azha",
    "mr beard": "mr_beard",
    "مستر بيرد": "mr_beard",
    "7 stars": "7_stars",
    "7 ستار": "7_stars",
    "windex": "windex",
    "ويندكس": "windex",
    "derma active": "derma_active",
    "ديرما اكتيف": "derma_active",
    "selengena": "selengena",
    "سيلينجينا": "selengena",
    "opidal": "opidal",
    "أوبيدال": "opidal",
    "bless": "bless",
    "بليس": "bless",
    "glory": "glory",
    "جلورى": "glory",
    "جلوري": "glory",
    "trex": "trex",
    "تريكس": "trex",
    "anivagene": "anivagene",
    "أنيفاجين": "anivagene",
    "انيفاجين": "anivagene",
    "bio soft": "bio_soft",
    "بيو سوفت": "bio_soft",
    "بايو سوفت": "bio_soft",
    "schwarzkopf": "schwarzkopf",
    "شوارزكوف": "schwarzkopf",
    "seropipe": "seropipe",
    "سيروبايب": "seropipe",
    "man zone": "man_zone",
    "مان زون": "man_zone",
    "palette": "palette",
    "باليت": "palette",
    "frida": "frida",
    "فريدا": "frida",
    "fashkool": "fashkool",
    "فاشكول": "fashkool",
    "joly": "joly",
    "جولي": "joly",
    "bonabella": "bonabella",
    "بونابيلا": "bonabella",
    "alo eva": "alo_eva",
    "الو ايفا": "alo_eva",
    "الو إيڤا": "alo_eva",
    "hemani": "hemani",
    "هيمانى": "hemani",
    "skinova image": "skinova_image",
    "سكينوفا ايمدج": "skinova_image",
    "emami": "emami",
    "إمامي": "emami",
    "امامي": "emami",
    "cecilia": "cecilia",
    "سيسيليا": "cecilia",
    "herbal essences": "herbal_essences",
    "هيربل إسنسز": "herbal_essences",
    "هيربل اسنسز": "herbal_essences",
    "casanova": "casanova",
    "كازانوفا": "casanova",
    "titilo": "titilo",
    "تيتيلو": "titilo",
    "g dox": "g_dox",
    "جي دوكس": "g_dox",
    "anafortan": "anafortan",
    "انافورتن": "anafortan",
    "darian": "darian",
    "داريان": "darian",
    "herbamix": "herbamix",
    "هيرباميكس": "herbamix",
    "revon": "revon",
    "ريفون": "revon",
    "profair": "profair",
    "بروفير": "profair",
    "dr. selwan": "dr_selwan",
    "دكتور سلوان": "dr_selwan",
    "energy": "energy",
    "انيرجي": "energy",
    "انيررجي": "energy",
    "mink": "mink",
    "مينك": "mink",
    "منك": "mink",
    "starky": "starky",
    "ستاركي": "starky",
    "ستاركى": "starky",
    "weezer": "weezer",
    "ويزر": "weezer",
    "fiancee": "fiancee",
    "فيانسيه": "fiancee",
    "parachute": "parachute",
    "باراشوت": "parachute",
    "bigen": "bigen",
    "بايجن": "bigen",
    "nyda": "nyda",
    "نايدا": "nyda",
    "dodge": "dodge",
    "دودج": "dodge",
    "sc": "sc",
    "اس سي": "sc",
    "maxanagen": "maxanagen",
    "ماكساناجين": "maxanagen",
    "cantu": "cantu",
    "كانتو": "cantu",
    "lotus": "lotus",
    "لوتس": "lotus",
    "bio point": "bio_point",
    "بيوبوينت": "bio_point",
    "trichup": "trichup",
    "تريشوب": "trichup",
    "ors": "ors",
    "أو أر أس": "ors",
    "sparkle": "sparkle",
    "سباركل": "sparkle",
    "justin blue": "justin_blue",
    "جاستن بلو": "justin_blue",
    "vital": "vital",
    "فيتال": "vital",
    "nature results": "nature_results",
    "نتائج الطبيعة": "nature_results",
    "nebula xyl": "nebula_xyl",
    "نيبولا اكس واى ال": "nebula_xyl",
    "amla": "amla",
    "املا": "amla",
    "devol": "devol",
    "ديفول": "devol",
    "tola": "tola",
    "تولا": "tola",
    "africana": "africana",
    "افريكانا": "africana",
    "dago": "dago",
    "داجو": "dago",
    "every strand": "every_strand",
    "ايفرى ستاند": "every_strand",
    "ايفري ستراند": "every_strand",
    "black again": "black_again",
    "بلاك أجين": "black_again",
    "back black": "back_black",
    "باك بلاك": "back_black",
    "organic body care": "organic_body_care",
    "اورجانيك بادي كير": "organic_body_care",
    "cafa": "cafa",
    "كافا": "cafa",
    "clary": "clary",
    "كلاري": "clary",
    "capixy": "capixy",
    "كابكسي": "capixy",
    "divine scalp": "divine_scalp",
    "ديفين سكالب": "divine_scalp",
    "herots": "herots",
    "هيروتس": "herots",
    "man look expert": "man_look_expert",
    "مان لوك إكسبرت": "man_look_expert",
    "man look": "man_look",
    "مان لوك": "man_look",
    "paradoz": "paradoz",
    "بارادوز": "paradoz",
    "blankie": "blankie",
    "بلانكي": "blankie",
    "gk hair": "gk_hair",
    "جي كي هير": "gk_hair",
    "جي كى هير": "gk_hair",
    "global keratin": "global_keratin",
    "جلوبال كيراتين": "global_keratin",
    "topic": "topic",
    "توبيك": "topic",
    "sonata": "sonata",
    "سوناتا": "sonata",
    "fluxrid": "fluxrid",
    "فلاكسريد": "fluxrid",
    "red fox": "red_fox",
    "ريد فوكس": "red_fox",
    "belloran": "belloran",
    "بيلوران": "belloran",
    "royal honey": "royal_honey",
    "رويال هنى": "royal_honey",
    "dr. miracle": "dr_miracle",
    "دكتور ميركل": "dr_miracle",
    "hair control": "hair_control",
    "هير كنترول": "hair_control",
    "fresh kiddo": "fresh_kiddo",
    "فريش كيدو": "fresh_kiddo",
    "lendo": "lendo",
    "ليندو": "lendo",
    "tamara": "tamara",
    "تمارا": "tamara",
    "aligon": "aligon",
    "أليجون": "aligon",
    "الفيف": "elvive",
    "ليزا": "liza",
    "كينزو": "kenzo",                                # NEW
    "كارتانا": "kartana",                            # NEW
    "ليسيل": "licel",                                # NEW
    "لي كاريتيه": "le_karite",                       # NEW
    "كيرستاس": "kerastase",                          # NEW
    "تريكوفيل": "tricovel",
    "صانسيلك": "sunsilk",
    "غارنييه": "garnier",
    "ال صالون": "il_salone",
    "ديزني": "disney",
    "برودجي": "prodigy",
    "كيش كينج": "kesh_king",
    "بالمرز": "palmers",
    "الفابارف": "alfaparf",
    "البرهان": "al_borhan",
    "بيك": "pic",                                    # NEW
    "بلانيت": "planet",                              # NEW
    "ميدي": "medi",                                  # NEW
    "ميجوس": "mejos",                                # NEW
}
