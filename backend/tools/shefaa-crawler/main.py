import urllib.request
import urllib.error
from urllib.parse import urlparse
import re
import logging
import sys
import json
import os
import argparse
from bs4 import BeautifulSoup
from rich.console import Console
from rich.table import Table
from rich.tree import Tree
from rich.panel import Panel

# Reconfigure stdout/stderr to use UTF-8 to handle special characters on Windows consoles safely
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def configure_logging(interactive: bool = False):
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)
        
    handlers = []
    if not interactive:
        handlers.append(logging.StreamHandler(sys.stdout))
    else:
        handlers.append(logging.NullHandler())
        
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        handlers=handlers,
        force=True
    )

# Initialize with standard CLI console logging enabled
configure_logging(interactive=False)

# Base Domain and Default Routing Configurations
BASE_DOMAIN = "https://chefaa.com"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

def get_base_url(country: str = "eg", lang: str = "en") -> str:
    """Compile localized categories base URL prefix."""
    return f"{BASE_DOMAIN}/{country}-{lang}/now/category/"

def get_url_route(url: str) -> str:
    """Extract only the relative website route (path + query) from a full URL."""
    if not url:
        return ""
    if not url.startswith('http'):
        return url if url.startswith('/') else '/' + url
    parsed = urlparse(url)
    route = parsed.path
    if parsed.query:
        route += f"?{parsed.query}"
    return route

# Coordinated thread locks to handle global 429 rate limit cooldowns across all workers
import threading
import time
import random

rate_limit_lock = threading.Lock()
rate_limit_cooldown_until = 0.0  # Unix timestamp

def fetch_html(url: str) -> str:
    """Fetch raw HTML content from the specified URL using robust headers with a coordinated global cooldown on HTTP 429."""
    global rate_limit_cooldown_until
    max_retries = 5
    base_delay = 2.0
    
    for attempt in range(max_retries):
        # Active wait loop: check if we are in a global cooldown period before sending the request
        while True:
            now = time.time()
            with rate_limit_lock:
                cooldown_remaining = rate_limit_cooldown_until - now
            
            if cooldown_remaining > 0:
                logging.info(f"Rate-limit cooldown active. Thread holding for another {cooldown_remaining:.1f}s...")
                time.sleep(min(cooldown_remaining, 5.0))
            else:
                break
        
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                content_type = response.headers.get_content_charset() or 'utf-8'
                return response.read().decode(content_type, errors='replace')
        except urllib.error.HTTPError as e:
            if e.code == 429:
                # Trigger a global rate-limit cooldown for 45 seconds to let the server window reset completely
                cooldown_duration = 45.0
                now = time.time()
                with rate_limit_lock:
                    if now + cooldown_duration > rate_limit_cooldown_until:
                        rate_limit_cooldown_until = now + cooldown_duration
                        logging.warning(f"HTTP 429 Rate Limit hit! Activating GLOBAL cooldown of {cooldown_duration}s to reset storefront window...")
                
                # Backoff sleep for this thread specifically
                delay = base_delay * (2 ** attempt) + random.uniform(0.5, 1.5)
                logging.warning(f"Retrying URL '{url}' in {delay:.2f}s... (Attempt {attempt+1}/{max_retries})")
                time.sleep(delay)
                continue
            elif e.code >= 500:
                delay = 1.0 * (2 ** attempt) + random.uniform(0.1, 0.5)
                logging.warning(f"HTTP {e.code} Server Error for '{url}'. Retrying in {delay:.2f}s... (Attempt {attempt+1}/{max_retries})")
                time.sleep(delay)
                continue
            else:
                logging.error(f"HTTP Error {e.code} fetching URL '{url}': {e.reason}")
                return ""
        except urllib.error.URLError as e:
            delay = base_delay * (2 ** attempt) + random.uniform(0.5, 1.5)
            logging.warning(f"Network error fetching '{url}': {str(e)}. Retrying in {delay:.2f}s... (Attempt {attempt+1}/{max_retries})")
            time.sleep(delay)
            continue
        except Exception as e:
            logging.error(f"Unexpected error fetching URL '{url}': {str(e)}")
            return ""
            
    logging.error(f"Failed to fetch URL '{url}' after {max_retries} attempts due to rate-limiting or network issues.")
    return ""

def download_image(url: str, filepath: str) -> bool:
    """Download static asset image locally with robust retry and checking coordinated global rate limits."""
    global rate_limit_cooldown_until
    if not url:
        return False
    if url.startswith('//'):
        url = "https:" + url
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    max_retries = 3
    base_delay = 1.5
    
    for attempt in range(max_retries):
        # Active wait loop: check if we are in a global cooldown period before downloading
        while True:
            now = time.time()
            with rate_limit_lock:
                cooldown_remaining = rate_limit_cooldown_until - now
            
            if cooldown_remaining > 0:
                logging.info(f"Rate-limit cooldown active. Thread holding image download for another {cooldown_remaining:.1f}s...")
                time.sleep(min(cooldown_remaining, 5.0))
            else:
                break
                
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                with open(filepath, 'wb') as f:
                    f.write(response.read())
            return True
        except urllib.error.HTTPError as e:
            if e.code == 429:
                cooldown_duration = 45.0
                now = time.time()
                with rate_limit_lock:
                    if now + cooldown_duration > rate_limit_cooldown_until:
                        rate_limit_cooldown_until = now + cooldown_duration
                        logging.warning(f"HTTP 429 Rate Limit on image! Activating GLOBAL cooldown of {cooldown_duration}s...")
                
                delay = base_delay * (2 ** attempt) + random.uniform(0.5, 1.0)
                logging.warning(f"HTTP 429 on image download {url}. Retrying in {delay:.2f}s...")
                time.sleep(delay)
                continue
            else:
                logging.error(f"HTTP Error {e.code} on image download {url}: {e.reason}")
                return False
        except Exception as e:
            delay = base_delay * (2 ** attempt) + random.uniform(0.5, 1.0)
            logging.warning(f"Error downloading image {url}: {str(e)}. Retrying in {delay:.2f}s...")
            time.sleep(delay)
            continue
            
    logging.error(f"Failed to download image {url} after {max_retries} attempts.")
    return False

# ==========================================
# 1. CATEGORY SCRAING LOGIC
# ==========================================

def get_categories_list(include_sub: bool = True, lang: str = "en", country: str = "eg", include_media: bool = False) -> list:
    """Scrape categories and subcategories dynamically based on locale."""
    base_cat_url = get_base_url(country, lang)
    url = f"{base_cat_url}medications"
    logging.info(f"Extracting categories database from page: {url}")
    html_content = fetch_html(url)
    if not html_content:
        return []

    soup = BeautifulSoup(html_content, 'html.parser')
    categories_data = []
    category_items = soup.select('li.category-link')

    for item in category_items:
        l1_div = item.find('div', class_='level1-cats')
        if not l1_div:
            continue
        l1_a = l1_div.find('a')
        if not l1_a:
            continue
        l1_name = l1_a.get_text(strip=True)
        l1_href = l1_a.get('href', '').replace(base_cat_url, '').strip()

        # Fetch parent category cover image dynamically
        cover_image = None
        if include_media:
            cover_image = fetch_category_cover(l1_href, lang, country)

        sub_categories = []
        if include_sub:
            l2_ul = item.find('ul', class_='level2-cats')
            if l2_ul:
                l2_items = l2_ul.find_all('li')
                for l2_item in l2_items:
                    l2_a = l2_item.find('a')
                    if l2_a:
                        l2_name = l2_a.get_text(strip=True)
                        l2_href = l2_a.get('href', '').replace(base_cat_url, '').strip()
                        sub_categories.append({
                            'name': l2_name,
                            'href': l2_href,
                            'slug': l2_href.strip('/').split('/')[-1]
                        })
        
        categories_data.append({
            'name': l1_name,
            'href': l1_href,
            'slug': l1_href.strip('/').split('/')[-1],
            'cover_image': cover_image or None,
            'sub_categories': sub_categories
        })
    return categories_data

def fetch_category_cover(category_href: str, lang: str = "en", country: str = "eg") -> str:
    """Fetch a category page and parse its main cover image from category-information."""
    base_cat_url = get_base_url(country, lang)
    url = category_href if category_href.startswith('http') else (base_cat_url + category_href)
    html_content = fetch_html(url)
    if not html_content:
        return ""
        
    soup = BeautifulSoup(html_content, 'html.parser')
    cat_info = soup.find(class_='category-information')
    if cat_info:
        img_tag = cat_info.find('img')
        if img_tag:
            img_url = img_tag.get('src', '')
            if img_url.startswith('//'):
                img_url = "https:" + img_url
            return img_url
    return ""

def scrape_categories_localized(include_sub: bool = True, country: str = "eg", include_media: bool = False) -> list:
    """Scrape and consolidate categories for both English and Arabic variants."""
    logging.info("Performing localized categories consolidation...")
    en_cats = get_categories_list(include_sub=include_sub, lang="en", country=country, include_media=include_media)
    ar_cats = get_categories_list(include_sub=include_sub, lang="ar", country=country, include_media=include_media)
    
    localized_cats = []
    # Map Arabic categories by clean slug
    ar_map = {cat['href'].split('/')[-1]: cat for cat in ar_cats}
    
    for en_cat in en_cats:
        href_slug = en_cat['href']
        slug_key = href_slug.split('/')[-1]
        ar_cat = ar_map.get(slug_key)
        
        # Consolidate covers
        cover = en_cat.get('cover_image') or (ar_cat.get('cover_image') if ar_cat else "")
        
        # Consolidate subcategories
        sub_cats_localized = []
        en_subs = en_cat.get('sub_categories', [])
        ar_subs = ar_cat.get('sub_categories', []) if ar_cat else []
        ar_sub_map = {sub['href'].split('/')[-1]: sub for sub in ar_subs}
        
        for en_sub in en_subs:
            sub_slug = en_sub['href']
            sub_key = sub_slug.split('/')[-1]
            ar_sub = ar_sub_map.get(sub_key)
            
            sub_cats_localized.append({
                "href_slug": sub_slug,
                "names": {
                    "en": en_sub['name'],
                    "ar": ar_sub['name'] if ar_sub else en_sub['name']
                },
                "href": en_sub['href'],
                "slug": sub_slug.strip('/').split('/')[-1]
            })
            
        localized_cats.append({
            "href_slug": href_slug,
            "cover_image": cover or None,
            "names": {
                "en": en_cat['name'],
                "ar": ar_cat['name'] if ar_cat else en_cat['name']
            },
            "href": en_cat['href'],
            "slug": href_slug.strip('/').split('/')[-1],
            "sub_categories": sub_cats_localized
        })
    return localized_cats

# ==========================================
# 2. BRANDS SCRAPING LOGIC
# ==========================================

def scrape_brands(lang: str = "en", country: str = "eg", include_media: bool = False) -> list:
    """Scrape the brands listing page for logo URLs, names, and relative routes."""
    url = f"{BASE_DOMAIN}/{country}-{lang}/now/brands"
    logging.info(f"Extracting brands list from: {url}")
    html = fetch_html(url)
    if not html:
        return []
        
    soup = BeautifulSoup(html, 'html.parser')
    brands = []
    
    # Target common elements representing brand cards/grids
    brand_containers = soup.find_all('div', class_=re.compile(r'brand|manufacturer', re.I))
    if not brand_containers:
        # Fallback to direct anchor tags referencing brand routing
        brand_containers = soup.find_all('a', href=re.compile(r'/brands/'))
        
    for item in brand_containers:
        a_tag = item if item.name == 'a' else item.find('a')
        img_tag = item.find('img') if item.name == 'div' else (a_tag.find('img') if a_tag else None)
        
        if a_tag:
            href = a_tag.get('href', '')
            name = a_tag.get_text(strip=True)
            if img_tag and not name:
                name = img_tag.get('alt', '').replace(' logo', '').strip()
                
            logo_url = ""
            if include_media and img_tag:
                logo_url = img_tag.get('src') or img_tag.get('data-src') or img_tag.get('data-lazy') or ""
                if logo_url.startswith('//'):
                    logo_url = "https:" + logo_url
                    
            if href and ('/brands/' in href or 'brand' in href):
                route = get_url_route(href)
                brand_entry = {
                    'name': name or route.split('/')[-1].replace('-', ' ').title(),
                    'href': route,
                    'slug': route.strip('/').split('/')[-1],
                    'logo_url': logo_url
                }
                if brand_entry not in brands:
                    brands.append(brand_entry)
                    
    # Secondary fallback extracting any brand uploads
    if not brands:
        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src') or ""
            if src and 'brands' in src:
                parent_a = img.find_parent('a')
                href = parent_a.get('href') if parent_a else ""
                name = img.get('alt', '').replace(' logo', '').strip()
                route = get_url_route(href) if href else f"/brands/{name.lower().replace(' ', '-')}"
                
                logo_url = ""
                if include_media:
                    logo_url = src if src.startswith('http') or src.startswith('//') else (BASE_DOMAIN + src)
                
                brands.append({
                    'name': name or route.split('/')[-1].replace('-', ' ').title(),
                    'href': route,
                    'slug': route.strip('/').split('/')[-1],
                    'logo_url': logo_url
                })
                
    return brands

def scrape_brands_localized(country: str = "eg", include_media: bool = False) -> list:
    """Scrape and consolidate brands for both localized sub-routes."""
    logging.info("Performing localized brands consolidation...")
    en_brands = scrape_brands(lang="en", country=country, include_media=include_media)
    ar_brands = scrape_brands(lang="ar", country=country, include_media=include_media)
    
    localized_brands = []
    # Match by final brand name slug
    ar_map = {brand['href'].split('/')[-1]: brand for brand in ar_brands}
    
    for en_brand in en_brands:
        slug = en_brand['href'].split('/')[-1]
        ar_brand = ar_map.get(slug)
        
        logo = en_brand.get('logo_url') or (ar_brand.get('logo_url') if ar_brand else "")
        
        localized_brands.append({
            "href_slug": en_brand['href'],
            "slug": slug,
            "logo_url": logo or None,
            "names": {
                "en": en_brand['name'],
                "ar": ar_brand['name'] if ar_brand else en_brand['name']
            }
        })
    return localized_brands

_brands_lookup_cache = None

def get_brand_details(brand_name: str, country: str = "eg") -> dict:
    """Resolve brand object containing slug/id and localized/standard names from scraped catalogs."""
    global _brands_lookup_cache
    if not brand_name:
        return None
        
    if _brands_lookup_cache is None:
        _brands_lookup_cache = {}
        base_dir = os.path.dirname(os.path.abspath(__file__))
        extracted_data_dir = os.path.abspath(os.path.join(base_dir, "..", "..", "data", "extracted"))
        cat_file = os.path.join(extracted_data_dir, "brands_localized.json")
        if not os.path.exists(cat_file):
            cat_file = os.path.join(extracted_data_dir, "brands.json")
            
        if os.path.exists(cat_file):
            try:
                with open(cat_file, 'r', encoding='utf-8') as f:
                    brands_data = json.load(f)
                    for b in brands_data:
                        names = b.get('names', {})
                        en_name = names.get('en', b.get('name', ''))
                        ar_name = names.get('ar', '')
                        logo_url = b.get('logo_url')
                        
                        path = b.get('href_slug') or b.get('href', '')
                        # Convert to normalized site-side relative routing slug
                        # E.g. "eg-en/now/brands/منتجات-بندولين-penduline" -> "brands/منتجات-بندولين-penduline"
                        brand_id = path.replace('/eg-en/', '').replace('/eg-ar/', '').strip('/')
                        
                        brand_obj = {
                            "id": brand_id,
                            "names": {
                                "en": en_name,
                                "ar": ar_name or en_name
                            },
                            "logo_url": logo_url or None
                        }
                        if en_name:
                            _brands_lookup_cache[en_name.lower().strip()] = brand_obj
                        if ar_name:
                            _brands_lookup_cache[ar_name.lower().strip()] = brand_obj
            except Exception as e:
                logging.warning(f"Error loading brand catalog file: {e}")
                
    key = brand_name.lower().strip()
    if key in _brands_lookup_cache:
        return _brands_lookup_cache[key]
        
    # Return raw name with None id if not present in the verified brands list
    return {
        "id": None,
        "names": {
            "en": brand_name,
            "ar": brand_name
        },
        "logo_url": None
    }

_categories_lookup_cache = None

def get_category_details(category_href: str) -> dict:
    """Resolve category object containing relative path/id and names catalog."""
    global _categories_lookup_cache
    if not category_href:
        return None
        
    cleaned_href = category_href.replace('https://chefaa.com', '').replace(':443', '').strip('/')
    cleaned_href = re.sub(r'^(eg-en|eg-ar)/now/category/', '', cleaned_href).strip('/')
    
    if _categories_lookup_cache is None:
        _categories_lookup_cache = {}
        base_dir = os.path.dirname(os.path.abspath(__file__))
        extracted_data_dir = os.path.abspath(os.path.join(base_dir, "..", "..", "data", "extracted"))
        for filename in [os.path.join(extracted_data_dir, "categories_localized.json"), os.path.join(extracted_data_dir, "categories.json")]:
            if os.path.exists(filename):
                try:
                    with open(filename, 'r', encoding='utf-8') as f:
                        cats = json.load(f)
                        def traverse(node):
                            c_path = node.get('href_slug') or node.get('href') or ""
                            c_key = c_path.replace('https://chefaa.com', '').replace(':443', '').strip('/')
                            c_key = re.sub(r'^(eg-en|eg-ar)/now/category/', '', c_key).strip('/')
                            
                            names = node.get('names', {})
                            en_name = names.get('en', node.get('name', ''))
                            ar_name = names.get('ar', '')
                            
                            cat_obj = {
                                "id": c_key,
                                "names": {
                                    "en": en_name,
                                    "ar": ar_name or en_name
                                },
                                "name": en_name
                            }
                            if c_key:
                                _categories_lookup_cache[c_key] = cat_obj
                                
                            for sub in node.get('sub_categories', []):
                                traverse(sub)
                                
                        for cat in cats:
                            traverse(cat)
                except Exception:
                    pass
                    
    if cleaned_href in _categories_lookup_cache:
        return _categories_lookup_cache[cleaned_href]
        
    for k, v in _categories_lookup_cache.items():
        if k in cleaned_href or cleaned_href in k:
            return v
            
    fallback_name = cleaned_href.split('/')[-1].replace('-', ' ').title()
    return {
        "id": cleaned_href,
        "names": {
            "en": fallback_name,
            "ar": fallback_name
        },
        "name": fallback_name
    }

def format_product_brand_and_category(prod: dict, category_href: str, lang: str = "en", localize: bool = False):
    """Integrate ID/slug and Name fields into the brand and category mappings in the target product dict."""
    cat_details = get_category_details(category_href)
    if localize:
        prod["category"] = {
            "id": cat_details["id"],
            "names": cat_details["names"]
        }
    else:
        prod["category"] = {
            "id": cat_details["id"],
            "name": cat_details["names"].get(lang, cat_details["name"])
        }
        
    raw_brand = prod.get("brand")
    if isinstance(raw_brand, dict):
        return
        
    if not raw_brand:
        prod["brand"] = None
        return
        
    brand_details = get_brand_details(raw_brand)
    if localize:
        prod["brand"] = {
            "id": brand_details["id"],
            "names": brand_details["names"],
            "logo_url": brand_details["logo_url"]
        }
    else:
        prod["brand"] = {
            "id": brand_details["id"],
            "name": brand_details["names"].get(lang, raw_brand),
            "logo_url": brand_details["logo_url"]
        }

# ==========================================
# 3. PRODUCT SCRAING LOGIC
# ==========================================

def fetch_product_details(product_url: str) -> dict:
    """Fetch and parse detailed landing properties for a specific product."""
    full_url = product_url if product_url.startswith('http') else (BASE_DOMAIN + product_url)
    html = fetch_html(full_url)
    if not html:
        return {
            'description': '',
            'overview': '',
            'specification': {},
            'featured_image': '',
            'images': [],
            'brand': ''
        }
        
    soup = BeautifulSoup(html, 'html.parser')
    
    # 1. Plain text description
    meta_desc = soup.find('meta', attrs={"name": "description"})
    description = meta_desc.get('content', '').strip() if meta_desc else ""
    
    # 2. Overview (Rich-Text HTML from Overview tab-pane)
    overview_div = soup.find(id="nav-home")
    overview_rich = str(overview_div) if overview_div else ""
    
    # 3. Specifications Table
    specifications = {}
    spec_pane = soup.find(id="nav-profile")
    if spec_pane:
        rows = spec_pane.find_all('tr')
        for row in rows:
            tds = row.find_all('td')
            if len(tds) >= 2:
                key = tds[0].get_text(strip=True)
                val = tds[1].get_text(strip=True)
                specifications[key] = val
                
    # 4. Brand extraction
    brand = specifications.get('Brand', '').strip()
    
    # 5. Gallery images from Carousel Slider
    gallery_images = []
    carousel = soup.find('div', id='carousel-slider')
    if carousel:
        carousel_items = carousel.find_all('div', class_='carousel-item')
        for item in carousel_items:
            img_tag = item.find('img')
            if img_tag:
                src = img_tag.get('src') or img_tag.get('data-src')
                if src and 'public/uploads/products' in src:
                    if src.startswith('//'):
                        src = "https:" + src
                    gallery_images.append(src)
                    
    if not gallery_images:
        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src')
            if src and 'public/uploads/products' in src:
                if src.startswith('//'):
                    src = "https:" + src
                if src not in gallery_images:
                    gallery_images.append(src)
                    
    featured_image = gallery_images[0] if gallery_images else ""
    
    return {
        'description': description,
        'overview': overview_rich,
        'specification': specifications,
        'featured_image': featured_image,
        'images': gallery_images,
        'brand': brand
    }


# ==========================================
# MEILISEARCH CRAWLER BACKEND
# ==========================================

def fetch_products_from_meili(country: str = "eg", category_slug: str = None, on_progress=None, should_cancel=None, max_products: int = None) -> list:
    """
    Fetch all products matching a category_slug from Meilisearch index.
    If category_slug is None or 'all', fetches all products.
    Uses dynamic price range slicing to bypass the 1000-hits Meilisearch ceiling.
    """
    index = f"products_{country.lower()}"
    if country.lower() == 'ae':
        index = "products_eg"
        
    url = f"https://meilisearch.chefaa.com/indexes/{index}/search"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Authorization': 'Bearer aa66bf66db30dea9b9746c8f6397d7a0112a055c70d80527b300c3dec85fcc41',
        'Content-Type': 'application/json'
    }
    
    base_filter = None
    if category_slug and category_slug.lower() != 'all':
        category_slug = category_slug.replace("'", "\\'")
        base_filter = f"level_one_category.slug = '{category_slug}' OR level_two_category.slug = '{category_slug}'"
        
    # Determine the maximum price dynamically to establish initial boundary
    max_price = 100000
    try:
        data = {
            'q': '',
            'limit': 1,
            'sort': ['price:desc']
        }
        if base_filter:
            data['filter'] = base_filter
        req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=20) as res:
            parsed = json.loads(res.read().decode('utf-8'))
            if parsed.get('hits'):
                max_price = parsed['hits'][0].get('price', 100000)
    except Exception as e:
        logging.warning(f"Failed to fetch max price from Meilisearch, using default 100,000: {e}")
        
    ranges_to_check = [(0, max_price)]
    collected_hits = []
    seen_ids = set()

    def _at_limit() -> bool:
        return max_products is not None and len(collected_hits) >= max_products

    def _report_progress(message: str) -> None:
        if should_cancel and should_cancel():
            raise InterruptedError("Pipeline cancelled")
        if on_progress:
            on_progress(len(collected_hits), message)
    
    while ranges_to_check:
        if should_cancel and should_cancel():
            raise InterruptedError("Pipeline cancelled")
        if _at_limit():
            break
        min_p, max_p = ranges_to_check.pop(0)
        
        price_filter = f"price >= {min_p} AND price <= {max_p}"
        current_filter = f"({base_filter}) AND ({price_filter})" if base_filter else price_filter
        
        try:
            data = {
                'q': '',
                'limit': 0,
                'filter': current_filter
            }
            req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=20) as res:
                parsed = json.loads(res.read().decode('utf-8'))
                est_hits = parsed.get('estimatedTotalHits', 0)
        except Exception as e:
            logging.error(f"Meilisearch API query error on range {min_p}-{max_p}: {e}")
            raise e
            
        if est_hits == 0:
            continue
            
        # If hits count is less than 1,000, we can safely page and fetch everything
        if est_hits < 1000 or min_p >= max_p:
            offset = 0
            limit = 250
            while True:
                if should_cancel and should_cancel():
                    raise InterruptedError("Pipeline cancelled")
                data = {
                    'q': '',
                    'limit': limit,
                    'offset': offset,
                    'filter': current_filter
                }
                req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
                with urllib.request.urlopen(req, timeout=20) as res:
                    parsed = json.loads(res.read().decode('utf-8'))
                    hits = parsed.get('hits', [])
                    if not hits:
                        break
                    for hit in hits:
                        h_id = hit.get('slug')
                        if h_id not in seen_ids:
                            seen_ids.add(h_id)
                            collected_hits.append(hit)
                            if _at_limit():
                                break
                    _report_progress(f"Fetched {len(collected_hits):,} products from Meilisearch…")
                    if _at_limit() or len(hits) < limit:
                        break
                    offset += limit
                if _at_limit():
                    break
        else:
            # Split the price range to divide-and-conquer
            mid_p = round((min_p + max_p) / 2.0, 2)
            if mid_p == min_p or mid_p == max_p:
                min_p = max_p
                ranges_to_check.append((min_p, max_p))
            else:
                ranges_to_check.append((min_p, mid_p))
                ranges_to_check.append((mid_p + 0.01, max_p))

    _report_progress(f"Meilisearch fetch complete — {len(collected_hits):,} products")
    return collected_hits


def scrape_products(category_href: str, page: int = 1, lang: str = "en", country: str = "eg", session_table: Table = None) -> tuple:
    """Fetch and parse products listing for a specific category or subcategory at page N."""
    # Attempt Meilisearch query first for speed and absolute completeness
    try:
        category_slug = category_href.strip('/').split('/')[-1]
        all_hits = fetch_products_from_meili(country=country, category_slug=category_slug)
        
        # Paginate Meilisearch hits locally to match page bounds if necessary
        page_size = 20
        offset = (page - 1) * page_size
        sliced_hits = all_hits[offset : offset + page_size]
        
        products = []
        for hit in sliced_hits:
            brand_data = hit.get('brands') or {}
            brand_val = {
                "id": brand_data.get('slug'),
                "name": brand_data.get(f'title_{lang}') or brand_data.get('title_en') or brand_data.get('slug', '').title(),
                "logo_url": brand_data.get('images')
            } if brand_data else None
            
            l1_cat = hit.get('level_one_category') or {}
            cat_val = {
                "id": l1_cat.get('slug'),
                "name": l1_cat.get(f'title_{lang}') or l1_cat.get('title_en')
            }
            
            l2_list = hit.get('level_two_category') or []
            if isinstance(l2_list, list) and len(l2_list) > 0:
                l2_cat = l2_list[0]
                subcat_val = {
                    "id": l2_cat.get('slug'),
                    "name": l2_cat.get(f'title_{lang}') or l2_cat.get('title_en')
                }
            elif isinstance(l2_list, dict) and l2_list.get('slug'):
                subcat_val = {
                    "id": l2_list.get('slug'),
                    "name": l2_list.get(f'title_{lang}') or l2_list.get('title_en')
                }
            else:
                subcat_val = None
            
            full_url = hit.get('full_url', '')
            url_route = get_url_route(full_url)
            
            spec = {}
            if brand_data:
                spec['Brand'] = brand_data.get('title_en') or brand_data.get('slug', '').title()
                
            try:
                raw_price = float(hit.get('price') or 0)
            except (ValueError, TypeError):
                raw_price = 0.0
            if raw_price >= 1000000.0:  # Exclude barcode-level outliers
                raw_price = 0.0
            price_str = "{:.2f}".format(raw_price)
            
            products.append({
                'name': hit.get(f'title_{lang}') or hit.get('title_en', ''),
                'price': price_str,
                'currency': 'SAR' if 'sa' in full_url else 'EGP',
                'image': hit.get('image', ''),
                'url': url_route,
                'brand': brand_val,
                'category': cat_val,
                'subcategory': subcat_val,
                'description': hit.get(f'description_{lang}') or hit.get('description_en', ''),
                'overview': '',
                'specification': spec
            })
            
        max_page = max(1, (len(all_hits) + page_size - 1) // page_size)
        
        # Add details to session table
        prices = []
        for p in products:
            price_str = p.get('price', '')
            if price_str:
                clean_p = re.sub(r'[^\d.]', '', price_str)
                if clean_p:
                    try:
                        val = float(clean_p)
                        if 0 < val < 1000000.0:  # Exclude barcode-level outliers
                            prices.append(val)
                    except ValueError:
                        pass
        
        status_str = "[bold green]Success (API)[/bold green]"
        products_count = str(len(products))
        price_range_str = "N/A"
        avg_price_str = "N/A"
        
        if prices:
            min_p = min(prices)
            max_p = max(prices)
            avg_p = sum(prices) / len(prices)
            currency_code = products[0].get('currency', 'EGP')
            price_range_str = f"{min_p:.1f} - {max_p:.1f} {currency_code}"
            avg_price_str = f"{avg_p:.1f} {currency_code}"
            
        logging.info(f"Successfully fetched API Page {page} ({lang.upper()}) | Found {len(products)} products of {len(all_hits)} total.")
        
        if session_table is not None:
            session_table.add_row(
                str(page),
                lang.upper(),
                status_str,
                products_count,
                price_range_str,
                avg_price_str
            )
            
        return products, max_page
        
    except Exception as meili_err:
        logging.warning(f"Meilisearch API crawler failed or not indexed ({meili_err}). Falling back to HTML scraping...")
        
        # Original HTML Scraping code
        base_cat_url = get_base_url(country, lang)
        url = category_href if category_href.startswith('http') else (base_cat_url + category_href)
        url_with_page = f"{url}?page={page}" if "?" not in url else f"{url}&page={page}"
        
        logging.info(f"Fetching page {page} ({lang.upper()}) from: {url_with_page}")
        
        html_content = fetch_html(url_with_page)
        if not html_content:
            logging.warning(f"Failed to fetch page {page} ({lang.upper()})")
            
            if session_table is not None:
                session_table.add_row(str(page), lang.upper(), "[bold red]Failed[/bold red]", "0", "N/A", "N/A")
            return [], 1
            
        soup = BeautifulSoup(html_content, 'html.parser')
        products = []
        
        product_divs = soup.find_all('div', class_='item', itemprop='itemListElement')
        for div in product_divs:
            link_tag = div.find('a', class_='product_details_link')
            href = link_tag.get('href', '') if link_tag else ''
            
            name_tag = div.find('span', itemprop='name')
            name = name_tag.get('content') or name_tag.get_text(strip=True) if name_tag else ''
            
            img_tag = div.find('meta', itemprop='image')
            image = img_tag.get('content') if img_tag else ''
            
            price_tag = div.find('span', itemprop='price')
            price = price_tag.get('content') or price_tag.get_text(strip=True) if price_tag else ''
            
            curr_tag = div.find('span', itemprop='priceCurrency')
            currency = curr_tag.get('content') or curr_tag.get_text(strip=True) if curr_tag else ''
            
            products.append({
                'name': name,
                'price': price,
                'currency': currency,
                'image': image,
                'url': get_url_route(href)
            })
            
        max_page = 1
        for a in soup.find_all('a', href=True):
            href_attr = a['href']
            if 'page=' in href_attr:
                try:
                    page_num = int(href_attr.split('page=')[-1].split('&')[0])
                    if page_num > max_page:
                        max_page = page_num
                except ValueError:
                    pass
                    
        # Page Summary Stats calculation
        prices = []
        for p in products:
            price_str = p.get('price', '')
            if price_str:
                clean_p = re.sub(r'[^\d.]', '', price_str)
                if clean_p:
                    try:
                        prices.append(float(clean_p))
                    except ValueError:
                        pass
        
        status_str = "[bold green]Success[/bold green]"
        products_count = str(len(products))
        price_range_str = "N/A"
        avg_price_str = "N/A"
        
        if prices:
            min_p = min(prices)
            max_p = max(prices)
            avg_p = sum(prices) / len(prices)
            currency_code = products[0].get('currency', 'EGP')
            price_range_str = f"{min_p:.1f} - {max_p:.1f} {currency_code}"
            avg_price_str = f"{avg_p:.1f} {currency_code}"
            
        stat_msg = f"Successfully fetched Page {page} ({lang.upper()}) | Found {len(products)} products."
        if prices:
            stat_msg += f" [Price range: {price_range_str} | Average: {avg_price_str}]"
            
        logging.info(stat_msg)
        
        if session_table is not None:
            session_table.add_row(
                str(page),
                lang.upper(),
                status_str,
                products_count,
                price_range_str,
                avg_price_str
            )
            
        return products, max_page


def scrape_products_localized(category_href: str, pages: list, deep: bool = False, country: str = "eg", session_table: Table = None, output_path: str = None, previously_scraped: list = None, workers: int = 4, use_current_db: bool = False, db_lookup: dict = None) -> list:
    """Scrape and merge product details dynamically matching across localization catalogs."""
    # Attempt Meilisearch localized fetching first for maximum efficiency
    try:
        category_slug = category_href.strip('/').split('/')[-1]
        all_hits = fetch_products_from_meili(country=country, category_slug=category_slug)
        
        # Campaign-wide product deduplication
        seen_slugs = set()
        if previously_scraped:
            for p in previously_scraped:
                slug = p.get('id') or p.get('slug')
                if slug:
                    seen_slugs.add(slug)
        
        filtered_hits = [h for h in all_hits if h.get('slug') not in seen_slugs]
        
        # Paginate results based on pages list using unique filtered hits
        page_size = 20
        sliced_hits = []
        for p in pages:
            page_hits = filtered_hits[(p - 1) * page_size : p * page_size]
            sliced_hits.extend(page_hits)
            # Log standard API page success for backend telemetries
            print(f"Successfully fetched API Page {p} (EN/AR) | Found {len(page_hits)} unique products of {len(filtered_hits)} remaining total.")
            
        localized_products = []
        if deep and sliced_hits:
            from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn, MofNCompleteColumn, TimeRemainingColumn
            from concurrent.futures import ThreadPoolExecutor, as_completed
            import threading
            
            save_lock = threading.Lock()
            
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(bar_width=30, style="magenta", complete_style="bold green"),
                TaskProgressColumn(),
                MofNCompleteColumn(),
                TextColumn("•"),
                TimeRemainingColumn(),
                console=Console()
            ) as progress:
                task = progress.add_task("[bold cyan]Deep Enriching Product Specifications (API Path)...[/bold cyan]", total=len(sliced_hits))
                
                def fetch_and_enrich_hit(hit):
                    slug = hit.get('slug')
                    if use_current_db and db_lookup and slug in db_lookup:
                        cached = db_lookup[slug]
                        print(f"[CACHE HIT] Loaded details from database cache reference for product: {slug}")
                        en_details = {
                            'description': cached.get('description', ''),
                            'overview': cached.get('overview', {}).get('en', '') if isinstance(cached.get('overview'), dict) else cached.get('overview', ''),
                            'specification': cached.get('specification', {}),
                            'featured_image': cached.get('featured_image', ''),
                            'images': cached.get('images', []),
                            'brand': cached.get('brand', {}).get('names', {}).get('en', '') if isinstance(cached.get('brand'), dict) else cached.get('brand', '')
                        }
                        ar_details = {
                            'description': '',
                            'overview': cached.get('overview', {}).get('ar', '') if isinstance(cached.get('overview'), dict) else '',
                            'specification': {},
                            'featured_image': cached.get('featured_image', ''),
                            'images': cached.get('images', []),
                            'brand': cached.get('brand', {}).get('names', {}).get('ar', '') if isinstance(cached.get('brand'), dict) else cached.get('brand', '')
                        }
                        return hit, en_details, ar_details

                    en_url = f"/eg-en/nowProduct/{slug}" if country.lower() == 'eg' else f"/{country.lower()}-en/nowProduct/{slug}"
                    ar_url = f"/eg-ar/nowProduct/{slug}" if country.lower() == 'eg' else f"/{country.lower()}-ar/nowProduct/{slug}"
                    
                    en_details = fetch_product_details(en_url)
                    
                    # Polite randomized delay between variant requests
                    time.sleep(random.uniform(0.3, 0.6))
                    
                    ar_details = fetch_product_details(ar_url)
                    
                    # Polite spacing delay between separate product iterations in this worker thread
                    time.sleep(random.uniform(0.4, 0.9))
                    
                    return hit, en_details, ar_details

                # Fetch specifications concurrently
                with ThreadPoolExecutor(max_workers=workers) as executor:
                    futures = {executor.submit(fetch_and_enrich_hit, hit): hit for hit in sliced_hits}
                    
                    for future in as_completed(futures):
                        hit, en_details, ar_details = future.result()
                        slug = hit.get('slug')
                        
                        prod_display_name = hit.get('title_en', '')[:25] + "..." if len(hit.get('title_en', '')) > 25 else hit.get('title_en', '')
                        progress.update(task, description=f"[bold yellow]Scraping specs for:[/bold yellow] {prod_display_name}")
                        
                        # Print standard progress log for external piped processes
                        print(f"[{len(localized_products) + 1}/{len(sliced_hits)}] Scraping specs for: {hit.get('title_en', '')}")
                        
                        # Update specs
                        spec = {}
                        spec.update(en_details.get('specification', {}))
                        spec.update(ar_details.get('specification', {}))
                        
                        # Resolve brand
                        brand_data = hit.get('brands') or {}
                        brand_val = {
                            "id": brand_data.get('slug'),
                            "names": {
                                "en": brand_data.get('title_en') or brand_data.get('slug', '').title(),
                                "ar": brand_data.get('title_ar') or brand_data.get('title_en') or brand_data.get('slug', '').title()
                            },
                            "logo_url": brand_data.get('images')
                        } if brand_data else None
                        
                        l1_cat = hit.get('level_one_category') or {}
                        cat_val = {
                            "id": l1_cat.get('slug'),
                            "names": {
                                "en": l1_cat.get('title_en'),
                                "ar": l1_cat.get('title_ar')
                            }
                        }
                        
                        l2_list = hit.get('level_two_category') or []
                        if isinstance(l2_list, list) and len(l2_list) > 0:
                            l2_cat = l2_list[0]
                            subcat_val = {
                                "id": l2_cat.get('slug'),
                                "names": {
                                    "en": l2_cat.get('title_en'),
                                    "ar": l2_cat.get('title_ar')
                                }
                            }
                        elif isinstance(l2_list, dict) and l2_list.get('slug'):
                            subcat_val = {
                                "id": l2_list.get('slug'),
                                "names": {
                                    "en": l2_list.get('title_en'),
                                    "ar": l2_list.get('title_ar')
                                }
                            }
                        else:
                            subcat_val = None
                            
                        full_url = hit.get('full_url', '')
                        url_route = get_url_route(full_url)
                        
                        try:
                            raw_price = float(hit.get('price') or 0)
                        except (ValueError, TypeError):
                            raw_price = 0.0
                        if raw_price >= 1000000.0:  # Exclude barcode-level outliers
                            raw_price = 0.0
                        price_str = "{:.2f}".format(raw_price)
                        featured_img = en_details.get('featured_image') or hit.get('image') or ''
                        images = en_details.get('images') or [featured_img] if featured_img else []
                        
                        with save_lock:
                            localized_products.append({
                                "id": slug,
                                "brand": brand_val,
                                "featured_image": featured_img,
                                "images": images,
                                "names": {
                                    "en": hit.get('title_en', ''),
                                    "ar": hit.get('title_ar', '')
                                },
                                "price": price_str,
                                "currency": 'SAR' if 'sa' in full_url else 'EGP',
                                "url": url_route,
                                "description": en_details.get('description') or hit.get('description_en', ''),
                                "overview": {
                                    "en": en_details.get('overview', ''),
                                    "ar": ar_details.get('overview', '')
                                },
                                "specification": spec,
                                "category": cat_val,
                                "subcategory": subcat_val
                            })
                            
                            # Periodic auto-save after each product deep enrichment to prevent data loss on force-kills
                            if output_path:
                                try:
                                    temp_list = [dict(p) for p in localized_products]
                                    for prod in temp_list:
                                        format_product_brand_and_category(prod, category_href, localize=True)
                                    current_all = (previously_scraped or []) + temp_list
                                    with open(output_path, 'w', encoding='utf-8') as f:
                                        json.dump(current_all, f, indent=4, ensure_ascii=False)
                                except Exception:
                                    pass
                                    
                        progress.advance(task)
        else:
            for hit in sliced_hits:
                brand_data = hit.get('brands') or {}
                brand_val = {
                    "id": brand_data.get('slug'),
                    "names": {
                        "en": brand_data.get('title_en') or brand_data.get('slug', '').title(),
                        "ar": brand_data.get('title_ar') or brand_data.get('title_en') or brand_data.get('slug', '').title()
                    },
                    "logo_url": brand_data.get('images')
                } if brand_data else None
                
                l1_cat = hit.get('level_one_category') or {}
                cat_val = {
                    "id": l1_cat.get('slug'),
                    "names": {
                        "en": l1_cat.get('title_en'),
                        "ar": l1_cat.get('title_ar')
                    }
                }
                
                l2_list = hit.get('level_two_category') or []
                if isinstance(l2_list, list) and len(l2_list) > 0:
                    l2_cat = l2_list[0]
                    subcat_val = {
                        "id": l2_cat.get('slug'),
                        "names": {
                            "en": l2_cat.get('title_en'),
                            "ar": l2_cat.get('title_ar')
                        }
                    }
                elif isinstance(l2_list, dict) and l2_list.get('slug'):
                    subcat_val = {
                        "id": l2_list.get('slug'),
                        "names": {
                            "en": l2_list.get('title_en'),
                            "ar": l2_list.get('title_ar')
                        }
                    }
                else:
                    subcat_val = None
                
                full_url = hit.get('full_url', '')
                url_route = get_url_route(full_url)
                
                spec = {}
                if brand_data:
                    spec['Brand'] = brand_data.get('title_en') or brand_data.get('slug', '').title()
                    
                try:
                    raw_price = float(hit.get('price') or 0)
                except (ValueError, TypeError):
                    raw_price = 0.0
                if raw_price >= 1000000.0:  # Exclude barcode-level outliers
                    raw_price = 0.0
                price_str = "{:.2f}".format(raw_price)
                featured_img = hit.get('image') or ''
                
                localized_products.append({
                    "id": hit.get('slug'),
                    "brand": brand_val,
                    "featured_image": featured_img,
                    "images": [featured_img] if featured_img else [],
                    "names": {
                        "en": hit.get('title_en', ''),
                        "ar": hit.get('title_ar', '')
                    },
                    "price": price_str,
                    "currency": 'SAR' if 'sa' in full_url else 'EGP',
                    "url": url_route,
                    "description": hit.get('description_en', ''),
                    "overview": {
                        "en": "",
                        "ar": ""
                    },
                    "specification": spec,
                    "category": cat_val,
                    "subcategory": subcat_val
                })
            
        # Add virtual session stats for localized table
        if session_table is not None:
            # Add one entry for each page loaded
            for p in pages:
                # Count items on this page
                page_hits = filtered_hits[(p-1)*page_size : p*page_size]
                prices = []
                for h in page_hits:
                    try:
                        val = float(h.get('price') or 0)
                        if 0 < val < 1000000.0:  # Exclude barcode-level outliers
                            prices.append(val)
                    except (ValueError, TypeError):
                        pass
                price_range_str = "N/A"
                avg_price_str = "N/A"
                if prices:
                    price_range_str = f"{min(prices):.1f} - {max(prices):.1f} EGP"
                    avg_price_str = f"{sum(prices)/len(prices):.1f} EGP"
                session_table.add_row(
                    str(p),
                    "EN/AR",
                    "[bold green]Success (API)[/bold green]",
                    str(len(page_hits)),
                    price_range_str,
                    avg_price_str
                )
                
        return localized_products
        
    except Exception as meili_err:
        logging.warning(f"Meilisearch API crawler failed or not indexed ({meili_err}). Falling back to HTML scraping...")
        
        # Original HTML-scraping logic
        from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn, MofNCompleteColumn, TimeRemainingColumn
        
        all_en_prods = []
        all_ar_prods = []
        
        # 1. Fetching Catalog Pages with dynamic visual progress tracking
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(bar_width=30, style="magenta", complete_style="bold green"),
            TaskProgressColumn(),
            MofNCompleteColumn(),
            console=Console()
        ) as progress:
            task = progress.add_task("[bold cyan]Fetching Catalog Pages...[/bold cyan]", total=len(pages) * 2)
            
            for p in pages:
                progress.update(task, description=f"[bold yellow]Catalog (EN) Page {p}...[/bold yellow]")
                en_prods, _ = scrape_products(category_href, page=p, lang="en", country=country, session_table=session_table)
                all_en_prods.extend(en_prods)
                progress.advance(task)
                
                progress.update(task, description=f"[bold yellow]Catalog (AR) Page {p}...[/bold yellow]")
                ar_prods, _ = scrape_products(category_href, page=p, lang="ar", country=country, session_table=session_table)
                all_ar_prods.extend(ar_prods)
                progress.advance(task)
                
        # Map Arabic items by last url slug
        ar_map = {prod['url'].split('/')[-1]: prod for prod in all_ar_prods}
        localized_products = []
        
        # 2. Deep Enrichment with highly visual specs progression mapping
        if deep and all_en_prods:
            from concurrent.futures import ThreadPoolExecutor, as_completed
            import threading
            
            save_lock = threading.Lock()
            
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(bar_width=30, style="magenta", complete_style="bold green"),
                TaskProgressColumn(),
                MofNCompleteColumn(),
                TextColumn("•"),
                TimeRemainingColumn(),
                console=Console()
            ) as progress:
                task = progress.add_task("[bold cyan]Deep Enriching Product Specifications...[/bold cyan]", total=len(all_en_prods))
                
                def fetch_and_enrich_prod(en_prod):
                    slug = en_prod['url'].split('/')[-1]
                    ar_prod = ar_map.get(slug)
                    
                    if use_current_db and db_lookup and slug in db_lookup:
                        cached = db_lookup[slug]
                        print(f"[CACHE HIT] Loaded details from database cache reference for product: {slug}")
                        en_details = {
                            'description': cached.get('description', ''),
                            'overview': cached.get('overview', {}).get('en', '') if isinstance(cached.get('overview'), dict) else cached.get('overview', ''),
                            'specification': cached.get('specification', {}),
                            'featured_image': cached.get('featured_image', ''),
                            'images': cached.get('images', []),
                            'brand': cached.get('brand', {}).get('names', {}).get('en', '') if isinstance(cached.get('brand'), dict) else cached.get('brand', '')
                        }
                        ar_details = {
                            'description': '',
                            'overview': cached.get('overview', {}).get('ar', '') if isinstance(cached.get('overview'), dict) else '',
                            'specification': {},
                            'featured_image': cached.get('featured_image', ''),
                            'images': cached.get('images', []),
                            'brand': cached.get('brand', {}).get('names', {}).get('ar', '') if isinstance(cached.get('brand'), dict) else cached.get('brand', '')
                        }
                        return en_prod, ar_prod, en_details, ar_details

                    en_details = fetch_product_details(en_prod['url'])
                    if ar_prod:
                        ar_details = fetch_product_details(ar_prod['url'])
                    else:
                        ar_url = en_prod['url'].replace('-en/', '-ar/')
                        ar_details = fetch_product_details(ar_url)
                        
                    return en_prod, ar_prod, en_details, ar_details

                # Fetch specifications concurrently
                with ThreadPoolExecutor(max_workers=workers) as executor:
                    futures = {executor.submit(fetch_and_enrich_prod, en_prod): en_prod for en_prod in all_en_prods}
                    
                    for future in as_completed(futures):
                        en_prod, ar_prod, en_details, ar_details = future.result()
                        slug = en_prod['url'].split('/')[-1]
                        
                        prod_display_name = en_prod['name'][:25] + "..." if len(en_prod['name']) > 25 else en_prod['name']
                        progress.update(task, description=f"[bold yellow]Scraping specs for:[/bold yellow] {prod_display_name}")
                        
                        # Print standard progress log for external piped processes
                        print(f"[{len(localized_products) + 1}/{len(all_en_prods)}] Scraping specs for: {en_prod['name']}")
                        
                        brand = en_details.get('brand') or ar_details.get('brand') or ""
                        featured_image = en_details.get('featured_image') or en_prod.get('image') or ""
                        images = en_details.get('images') or [featured_image] if featured_image else []
                        
                        with save_lock:
                            localized_products.append({
                                "id": slug,
                                "brand": brand or None,
                                "featured_image": featured_image or None,
                                "images": images,
                                "names": {
                                    "en": en_prod['name'],
                                    "ar": ar_prod['name'] if ar_prod else en_prod['name']
                                },
                                "price": en_prod['price'],
                                "currency": en_prod['currency'],
                                "url": en_prod['url'],
                                "description": en_details.get('description', ''),
                                "overview": {
                                    "en": en_details.get('overview', ''),
                                    "ar": ar_details.get('overview', '')
                                },
                                "specification": en_details.get('specification', {})
                            })
                            
                            # Periodic auto-save after each product deep enrichment to prevent data loss on force-kills
                            if output_path:
                                try:
                                    temp_list = [dict(p) for p in localized_products]
                                    for prod in temp_list:
                                        format_product_brand_and_category(prod, category_href, localize=True)
                                    current_all = (previously_scraped or []) + temp_list
                                    with open(output_path, 'w', encoding='utf-8') as f:
                                        json.dump(current_all, f, indent=4, ensure_ascii=False)
                                except Exception:
                                    pass
                                    
                        progress.advance(task)
        else:
            # Standard fast non-deep localized mappings
            for en_prod in all_en_prods:
                slug = en_prod['url'].split('/')[-1]
                ar_prod = ar_map.get(slug)
                
                localized_products.append({
                    "id": slug,
                    "brand": None,
                    "featured_image": en_prod.get('image') or None,
                    "images": [en_prod.get('image')] if en_prod.get('image') else [],
                    "names": {
                        "en": en_prod['name'],
                        "ar": ar_prod['name'] if ar_prod else en_prod['name']
                    },
                    "price": en_prod['price'],
                    "currency": en_prod['currency'],
                    "url": en_prod['url'],
                    "description": "",
                    "overview": {
                        "en": "",
                        "ar": ""
                    },
                    "specification": {}
                })
                
        for prod in localized_products:
            format_product_brand_and_category(prod, category_href, localize=True)
            
        # Periodic auto-save after category is fully crawled (for non-deep runs)
        if output_path:
            try:
                current_all = (previously_scraped or []) + localized_products
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(current_all, f, indent=4, ensure_ascii=False)
            except Exception:
                pass
            
        return localized_products


# ==========================================
# 4. INTERACTIVE WIZARD MODE
# ==========================================

def run_interactive_mode(output_file: str):
    # Quiet console logging to keep terminal completely clean and elegant
    configure_logging(interactive=True)
    
    console = Console()
    console.print(Panel("[bold cyan]Welcome to the Chefaa Scraper Interactive Terminal[/bold cyan]\n"
                        "This mode assists you in exploring and scraping product lists from Chefaa dynamically.",
                        border_style="cyan"))

    def ask_yes_no(question: str, default: bool = True) -> bool:
        default_str = "[bold green]Y[/bold green]/n" if default else "y/[bold red]N[/bold red]"
        console.print(f"[bold white]{question}[/bold white] ({default_str}): ", end="")
        val = input().strip().lower()
        if not val:
            return default
        return val.startswith('y')

    # Config Options
    console.print("\n[bold magenta]Step 1: Set Localization Parameters[/bold magenta]")
    console.print("[bold white]Enter storefront country code ('eg', 'sa', 'ae') [default: eg]: [/bold white]", end="")
    country = input().strip().lower() or "eg"
    
    loc_choice = ask_yes_no("Bundle English & Arabic storefronts together (--localize)", default=True)
    lang = "en"
    if not loc_choice:
        console.print("[bold white]Enter catalog language ('en', 'ar') [default: en]: [/bold white]", end="")
        lang = input().strip().lower() or "en"

    # Load categories list
    os.makedirs("data", exist_ok=True)
    json_path = "data/categories_localized.json" if loc_choice else "data/categories.json"
    categories = []
    
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            try:
                categories = json.load(f)
            except Exception:
                pass
                
    if not categories:
        console.print("[yellow]Local category index not found. Fetching categories dynamically...[/yellow]")
        if loc_choice:
            categories = scrape_categories_localized(include_sub=True, country=country)
        else:
            categories = get_categories_list(include_sub=True, lang=lang, country=country)
        # Save so it can be reused
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(categories, f, indent=4, ensure_ascii=False)

    def format_cat_name(item):
        if loc_choice:
            en_n = item.get('names', {}).get('en', '')
            ar_n = item.get('names', {}).get('ar', '')
            return f"[bold green]{en_n}[/bold green] | [yellow]{ar_n}[/yellow]"
        return f"[bold green]{item.get('name', '')}[/bold green]"

    # 1. Ask about parent category
    console.print("\n[bold magenta]Step 2: Choose a Parent Category[/bold magenta]")
    for idx, cat in enumerate(categories):
        console.print(f"  [{idx + 1}] {format_cat_name(cat)}")
    console.print("  [all] Fetch products from ALL categories")
    
    while True:
        console.print("\n[bold white]Enter category choice (number or 'all'): [/bold white]", end="")
        choice = input().strip().lower()
        if choice == 'all':
            selected_cats = categories
            specific_sub = False
            break
        elif choice.isdigit() and 1 <= int(choice) <= len(categories):
            selected_cats = [categories[int(choice) - 1]]
            specific_sub = True
            break
        else:
            console.print("[red]Invalid choice. Please enter a valid number or 'all'.[/red]")

    # 2. Ask about subcategories
    target_category_paths = []
    if specific_sub:
        parent_cat = selected_cats[0]
        sub_cats = parent_cat.get('sub_categories', [])
        console.print(f"\n[bold magenta]Step 3: Choose a Sub-category under {format_cat_name(parent_cat)}[/bold magenta]")
        console.print("  [0] Entire Category (including all sub-categories)")
        for idx, sub in enumerate(sub_cats):
            console.print(f"  [{idx + 1}] {format_cat_name(sub)}")
        console.print("  [all] Scrape all sub-categories individually")

        while True:
            console.print("\n[bold white]Enter sub-category choice (number, '0', or 'all'): [/bold white]", end="")
            sub_choice = input().strip().lower()
            if sub_choice == '0':
                path = parent_cat.get('href') or parent_cat.get('href_slug')
                target_category_paths = [(parent_cat, path)]
                break
            elif sub_choice == 'all':
                target_category_paths = []
                for sub in sub_cats:
                    path = sub.get('href') or sub.get('href_slug')
                    target_category_paths.append((sub, path))
                break
            elif sub_choice.isdigit() and 1 <= int(sub_choice) <= len(sub_cats):
                selected_sub = sub_cats[int(sub_choice) - 1]
                path = selected_sub.get('href') or selected_sub.get('href_slug')
                target_category_paths = [(selected_sub, path)]
                break
            else:
                console.print("[red]Invalid choice. Please enter a valid index.[/red]")
    else:
        target_category_paths = []
        for cat in selected_cats:
            path = cat.get('href') or cat.get('href_slug')
            target_category_paths.append((cat, path))

    # 3. Ask about page constraints
    console.print("\n[bold magenta]Step 4: Detect and Select Page Range[/bold magenta]")
    first_item, first_path = target_category_paths[0]
    console.print(f"[dim]Checking page limit for category: {format_cat_name(first_item)}...[/dim]")
    _, max_pages_detected = scrape_products(first_path, page=1, lang=lang, country=country)
    console.print(f"[green]Successfully detected {max_pages_detected} pages available.[/green]")

    while True:
        console.print(f"\n[bold white]Enter a specific page (1-{max_pages_detected}) or 'all' for all pages [default: 1]: [/bold white]", end="")
        page_choice = input().strip().lower()
        if not page_choice:
            pages_to_scrape = [1]
            break
        elif page_choice == 'all':
            pages_to_scrape = list(range(1, max_pages_detected + 1))
            break
        elif page_choice.isdigit() and 1 <= int(page_choice) <= max_pages_detected:
            pages_to_scrape = [int(page_choice)]
            break
        else:
            console.print(f"[red]Please enter a valid page number (1-{max_pages_detected}) or 'all'.[/red]")

    # 4. Ask about deep scraping and downloads
    console.print("\n[bold magenta]Step 5: Scraping Preferences[/bold magenta]")
    deep_choice = ask_yes_no("Deep scrape detailed specifications (brand, full specification, overview)", default=True)
    dl_choice = ask_yes_no("Download and organize static images locally under data/media", default=False)

    # 5. Perform scraping pipeline
    console.print("\n[bold cyan]⚡ Scraper executing... Please stand by.[/bold cyan]\n")
    all_products = []
    
    for item_obj, path in target_category_paths:
        console.print(f"\n[bold blue]▶ Scrape Session: {format_cat_name(item_obj)}[/bold blue]")
        
        session_table = Table(
            title=f"Session Stats: {item_obj.get('names', {}).get('en', '') if loc_choice else item_obj.get('name', '')}", 
            show_header=True, 
            header_style="bold magenta", 
            border_style="cyan"
        )
        session_table.add_column("Page", style="bold green", justify="center")
        session_table.add_column("Locale", style="bold yellow", justify="center")
        session_table.add_column("Status", justify="center")
        session_table.add_column("Products Found", justify="right", style="cyan")
        session_table.add_column("Price Range", justify="right", style="green")
        session_table.add_column("Average Price", justify="right", style="yellow")
        
        if loc_choice:
            console.print(f"  [cyan]Scraping & Localizing pages: {pages_to_scrape}...[/cyan]")
            prods = scrape_products_localized(path, pages_to_scrape, deep=deep_choice, country=country, session_table=session_table)
            all_products.extend(prods)
            console.print(session_table)
            console.print(f"  [green]Successfully consolidated {len(prods)} localized products.[/green]")
        else:
            for p in pages_to_scrape:
                console.print(f"  [cyan]Scraping page {p}...[/cyan]")
                prods, _ = scrape_products(path, page=p, lang=lang, country=country, session_table=session_table)
                
                # Fetch details if requested
                if deep_choice and prods:
                    console.print(f"  [dim]Enriching {len(prods)} products with detailed specs...[/dim]")
                    for idx, pr in enumerate(prods):
                        console.print(f"    ({idx+1}/{len(prods)}) Specifications for: {pr['name']}...")
                        details = fetch_product_details(pr['url'])
                        pr.update(details)
                
                # Standardize brand and category schemas
                for pr in prods:
                    format_product_brand_and_category(pr, path, lang=lang, localize=False)
                    
                all_products.extend(prods)
            console.print(session_table)
            console.print(f"  [green]Successfully collected {len(all_products)} products.[/green]")

    # 6. Execute media downloader if enabled
    if dl_choice and all_products:
        console.print("\n[bold magenta]Step 6: Asset Downloader Executing[/bold magenta]")
        for idx, prod in enumerate(all_products):
            name = prod.get('name') or (prod.get('names', {}).get('en', '') if loc_choice else "")
            prod_id = prod.get('id') or prod.get('url', '').split('/')[-1]
            img_url = prod.get('featured_image') or prod.get('image') or ""
            
            if img_url:
                target_path = f"data/media/products/{prod_id}.png"
                console.print(f"   ({idx+1}/{len(all_products)}) Downloading image for '{name}'...")
                download_image(img_url, target_path)

    # 7. Output results
    default_output = "data/products_localized.json" if loc_choice else "data/products.json"
    final_output = output_file or default_output
    with open(final_output, 'w', encoding='utf-8') as f:
        json.dump(all_products, f, indent=4, ensure_ascii=False)
        
    console.print("\n")
    console.print(Panel(f"[bold green]Scraping Complete![/bold green]\n"
                        f"Scraped Category/Paths Count: {len(target_category_paths)}\n"
                        f"Pages scraped: {pages_to_scrape}\n"
                        f"Total Products collected: {len(all_products)}\n"
                        f"Results exported successfully to: [bold]{final_output}[/bold]",
                        border_style="green"))

    # Render summary preview
    if all_products:
        table = Table(title="Scraped Products Preview (Top 15)", show_header=True, header_style="bold magenta", border_style="cyan")
        if loc_choice:
            table.add_column("Product Name (en)", style="bold green", overflow="fold", width=25)
            table.add_column("Brand", style="bold yellow", width=12)
            table.add_column("Price (en)", justify="right", style="bold green", width=10)
            table.add_column("Product ID", style="blue")
            
            for prod in all_products[:15]:
                name_en = prod.get('names', {}).get('en', '')
                price = prod.get('price', '')
                currency = prod.get('currency', '')
                table.add_row(name_en, prod.get('brand') or "No Brand", f"{price} {currency}", prod.get('id'))
        else:
            table.add_column("Product Name", style="bold green", overflow="fold", width=25)
            table.add_column("Brand", style="bold yellow", width=12)
            table.add_column("Price", justify="right", style="bold green", width=10)
            table.add_column("Relative Route", style="blue")
            
            for prod in all_products[:15]:
                table.add_row(prod.get('name'), prod.get('brand') or "No Brand", f"{prod.get('price')} {prod.get('currency')}", prod.get('url'))
            
        console.print("\n")
        console.print(table)
        console.print("\n")
        
    # Re-enable standard console logging output
    configure_logging(interactive=False)

def run_media_extraction(products_source_path: str, workers: int = 2, localize: bool = False):
    """Download physical images for a compiled results catalog with multi-threading and zip compression."""
    import time
    import random
    import zipfile
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    if not os.path.exists(products_source_path):
        logging.error(f"[MEDIA] Source path '{products_source_path}' does not exist.")
        return False
        
    try:
        with open(products_source_path, 'r', encoding='utf-8') as f:
            all_products = json.load(f)
    except Exception as e:
        logging.error(f"[MEDIA] Failed to parse source catalog: {str(e)}")
        return False
        
    if not isinstance(all_products, list) or not all_products:
        logging.warning("[MEDIA] No products found in source catalog to download images for.")
        print(f"[MEDIA] COMPLETE: 0/0 images downloaded. ZIP success: True")
        sys.stdout.flush()
        return True
        
    logging.info(f"[MEDIA] Starting image download phase for {len(all_products)} products with {workers} workers...")
    
    dir_to_zip = "data/media/products"
    os.makedirs(dir_to_zip, exist_ok=True)
    
    completed = 0
    total = len(all_products)
    
    def download_worker(idx, prod):
        name = prod.get('name') if not localize else prod.get('names', {}).get('en', '')
        prod_id = prod.get('id') or prod.get('url', '').split('/')[-1]
        img_url = prod.get('featured_image') or prod.get('image') or ""
        if not img_url:
            return idx, name, False, "No URL"
            
        dl_path = f"{dir_to_zip}/{prod_id}.png"
        success = download_image(img_url, dl_path)
        return idx, name, success, dl_path
        
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(download_worker, idx, prod): prod for idx, prod in enumerate(all_products)}
        
        for future in as_completed(futures):
            idx, name, success, details = future.result()
            completed += 1
            if success:
                print(f"[MEDIA] {completed}/{total} Downloaded: {name}")
            else:
                print(f"[MEDIA] {completed}/{total} Failed/Skipped: {name} (Error/No URL)")
            sys.stdout.flush()
            
    # Now compress downloaded media into media.zip
    zip_path = os.path.join(os.path.dirname(products_source_path), "media.zip")
    
    logging.info(f"[MEDIA] Archiving images from {dir_to_zip} into {zip_path}...")
    
    zip_success = False
    if os.path.exists(dir_to_zip):
        try:
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                written_count = 0
                for root, _, files in os.walk(dir_to_zip):
                    for file in files:
                        full_file_path = os.path.join(root, file)
                        rel_path = os.path.relpath(full_file_path, dir_to_zip)
                        zipf.write(full_file_path, rel_path)
                        written_count += 1
                        
            logging.info(f"[MEDIA] Compiled {written_count} images into {zip_path}.")
            zip_success = True
            
            # Clean up temporary raw images upon successful zip creation to conserve disk space (CON-004)
            for file in os.listdir(dir_to_zip):
                file_path = os.path.join(dir_to_zip, file)
                try:
                    if os.path.isfile(file_path):
                        os.unlink(file_path)
                except Exception as clean_err:
                    logging.warning(f"Could not clean up raw file {file_path}: {clean_err}")
                    
        except Exception as e:
            logging.error(f"[MEDIA] Failed to create ZIP archive: {str(e)}")
            
    print(f"[MEDIA] COMPLETE: {completed}/{total} images processed. ZIP success: {zip_success}")
    sys.stdout.flush()
    return zip_success

# ==========================================
# 5. MASTER CLI CONTROL ENTRYPOINT
# ==========================================

def main():
    parser = argparse.ArgumentParser(description="Chefaa Scraper CLI & Master Control Script")
    parser.add_argument("--categories", action="store_true", help="Fetch main categories and print summary")
    parser.add_argument("--sub-categories", action="store_true", help="Fetch categories and their nested sub-categories")
    parser.add_argument("--brands", action="store_true", help="Fetch and scrape manufacturer brands list")
    parser.add_argument("--products", type=str, help="Specify category href, 'all', or 'quick-5' (first 5 categories only) to scrape products listing")
    parser.add_argument("--category-limit", type=int, default=None, help="Limit the number of parent categories to crawl [default: None]")
    parser.add_argument("--deep", action="store_true", help="Fetch and enrich items with detailed specifications")
    parser.add_argument("--include-media", action="store_true", help="Fetch category covers or brand logos")
    parser.add_argument("--pages", type=str, default="1", help="Select page number, range '1-5', or 'all' [default: 1]")
    parser.add_argument("--download", action="store_true", help="Download and categorize assets locally under data/media")
    parser.add_argument("--lang", type=str, default="en", choices=["en", "ar"], help="Primary catalog language [default: en]")
    parser.add_argument("--country", type=str, default="eg", choices=["eg", "sa", "ae"], help="Primary storefront country [default: eg]")
    parser.add_argument("--localize", action="store_true", help="Scrape and consolidate Arabic & English variant profiles comprehensively")
    parser.add_argument("--stats-only", action="store_true", help="Fetch and print available categories and their product counts")
    parser.add_argument("--output", type=str, help="Specify output path for the JSON database")
    parser.add_argument("--mode", type=str, choices=["interactive", "silent"], help="Set interface execution mode")
    parser.add_argument("--workers", type=int, default=4, help="Number of concurrent threads for specifications scraping [default: 4]")
    parser.add_argument("--crawl-mode", type=str, default="both", choices=["catalog", "media", "both"], help="Execution mode of the campaign [default: both]")
    parser.add_argument("--source", type=str, help="Path to existing results.json for media extraction mode")
    parser.add_argument("--use-current-db", action="store_true", help="Use current stored products database as cache to avoid fetching duplicates")

    args = parser.parse_args()
    console = Console()

    # Determine execution mode: if arguments are passed, default to silent CLI
    has_args = len(sys.argv) > 1
    run_mode = "interactive"
    if args.mode == "silent" or (has_args and args.mode != "interactive"):
        run_mode = "silent"

    if run_mode == "interactive":
        run_interactive_mode(args.output)
        return

    # SILENT CLI PIPELINE
    os.makedirs("data", exist_ok=True)

    if args.crawl_mode == "media":
        if not args.source:
            logging.error("[MEDIA] --source argument is required when --crawl-mode is set to 'media'.")
            sys.exit(1)
        success = run_media_extraction(args.source, workers=args.workers or 2, localize=args.localize)
        sys.exit(0 if success else 1)

    # 0. Category stats-only mode
    if args.stats_only:
        country = args.country
        index = f"products_{country.lower()}"
        if country.lower() == 'ae':
            index = "products_eg"
            
        url = f"https://meilisearch.chefaa.com/indexes/{index}/search"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Authorization': 'Bearer aa66bf66db30dea9b9746c8f6397d7a0112a055c70d80527b300c3dec85fcc41',
            'Content-Type': 'application/json'
        }
        
        counts = {}
        try:
            data = {
                'q': '',
                'limit': 0,
                'facets': ['level_one_category.slug']
            }
            req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=20) as res:
                parsed = json.loads(res.read().decode('utf-8'))
                counts = parsed.get('facetDistribution', {}).get('level_one_category.slug', {})
        except Exception as e:
            logging.warning(f"Could not retrieve category product counts from Meilisearch: {e}")
            
        # Fetch categories structure
        try:
            cats = scrape_categories_localized(include_sub=False, country=country)
        except Exception as e:
            logging.warning(f"Could not retrieve categories via localized HTML crawl: {e}")
            cats = []
            
        # If cats is empty, populate from counts keys
        if not cats:
            cats = [{"id": k, "names": {"en": k.replace("-", " ").title(), "ar": "N/A"}} for k in counts.keys()]
            
        # Build a beautiful Rich Table
        table = Table(title=f"Chefaa Category Statistics - {country.upper()}", show_header=True, header_style="bold magenta", border_style="cyan")
        table.add_column("Category Slug", style="bold yellow")
        table.add_column("English Name", style="bold green")
        table.add_column("Arabic Name", style="bold green", justify="right")
        table.add_column("Product Count", justify="right", style="bold cyan")
        
        total_products = 0
        for cat in cats:
            href_val = cat.get('href_slug') or cat.get('href', '') or cat.get('id', '')
            cat_slug = href_val.strip('/').split('/')[-1] if href_val else ''
            
            count = counts.get(cat_slug, 0)
            total_products += count
            
            names = cat.get('names', {}) or {'en': cat.get('name', 'N/A'), 'ar': 'N/A'}
            table.add_row(
                cat_slug,
                names.get('en', 'N/A'),
                names.get('ar', 'N/A'),
                f"{count:,}" if count else "0"
            )
            
        console.print("\n")
        console.print(table)
        console.print(f"\n[bold green]Total indexed products across all categories:[/bold green] [bold cyan]{total_products:,}[/bold cyan]\n")
        return

    # 1. Scrape Categories / Sub-categories
    if args.categories or args.sub_categories:
        output_path = args.output or "data/categories.json"
        
        if args.localize:
            data = scrape_categories_localized(include_sub=bool(args.sub_categories), country=args.country, include_media=args.include_media)
        else:
            data = get_categories_list(include_sub=bool(args.sub_categories), lang=args.lang, country=args.country, include_media=args.include_media)
            
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
            
        logging.info(f"Saved categories structure to '{output_path}'")

        # Category Image Downloader
        if args.download:
            logging.info("Starting localized categories cover image downloading...")
            for idx, cat in enumerate(data):
                href_slug = cat.get('href_slug') or cat.get('href', '')
                slug = href_slug.split('/')[-1]
                cover_url = cat.get('cover_image')
                if cover_url:
                    dl_path = f"data/media/categories/{slug}.png"
                    logging.info(f"[{idx+1}/{len(data)}] Downloading cover for {cat.get('href')}...")
                    download_image(cover_url, dl_path)
        
        # Display rich layout
        tree = Tree(f"[bold cyan]Chefaa Categories Index (Localized: {args.localize})[/bold cyan]")
        for cat in data:
            name_label = cat.get('name') if not args.localize else cat.get('names', {}).get('en', '')
            slug_label = cat.get('href') if not args.localize else cat.get('href_slug')
            branch = tree.add(f"[bold green]{name_label}[/bold green] [dim]({slug_label})[/dim]")
            
            if args.sub_categories:
                for sub in cat.get('sub_categories', []):
                    sub_name = sub.get('name') if not args.localize else sub.get('names', {}).get('en', '')
                    sub_slug = sub.get('href') if not args.localize else sub.get('href_slug')
                    branch.add(f"[yellow]{sub_name}[/yellow] [dim]({sub_slug})[/dim]")
        console.print(tree)

    # 2. Scrape Brands list
    elif args.brands:
        output_path = args.output or "data/brands.json"
        
        if args.localize:
            data = scrape_brands_localized(country=args.country, include_media=args.include_media)
        else:
            data = scrape_brands(lang=args.lang, country=args.country, include_media=args.include_media)
            
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
            
        logging.info(f"Saved brands database to '{output_path}'")

        # Brand Image Downloader
        if args.download:
            logging.info("Starting localized brand logo downloading...")
            for idx, brand in enumerate(data):
                slug = brand.get('href_slug', brand.get('href', '')).split('/')[-1]
                logo_url = brand.get('logo_url')
                if logo_url:
                    dl_path = f"data/media/brands/{slug}.png"
                    logging.info(f"[{idx+1}/{len(data)}] Downloading logo for {brand.get('name', slug)}...")
                    download_image(logo_url, dl_path)

        # Display Summary Table
        table = Table(title="Chefaa Brands Database", show_header=True, header_style="bold magenta", border_style="cyan")
        table.add_column("Brand Name", style="bold green", width=25)
        table.add_column("Relative Path", style="yellow")
        
        for brand in data:
            name_display = brand.get('name') if not args.localize else brand.get('names', {}).get('en', '')
            path_display = brand.get('href') if not args.localize else brand.get('href_slug')
            table.add_row(name_display, path_display)
        console.print(table)

    # 3. Scrape Products
    elif args.products:
        # Quiet standard console stream logging to display pristine Rich telemetry instead!
        # Unless stdout is not a TTY (piped subprocess), in which case standard logging helps debug progress!
        configure_logging(interactive=sys.stdout.isatty())
        
        output_path = args.output or "data/products.json"
        category_href = args.products
        
        # Resolve all target paths if 'all' or 'quick-5' is passed
        target_categories = []
        if category_href.lower() in ['all', 'quick-5']:
            # Load categories index
            cat_file = "data/categories_localized.json" if args.localize else "data/categories.json"
            if not os.path.exists(cat_file):
                cat_file = "data/categories.json"
            
            categories = []
            if os.path.exists(cat_file):
                with open(cat_file, 'r', encoding='utf-8') as f:
                    try:
                        categories = json.load(f)
                    except Exception:
                        pass
            
            if not categories:
                # Dynamically fetch categories list
                if args.localize:
                    categories = scrape_categories_localized(include_sub=True, country=args.country)
                else:
                    categories = get_categories_list(include_sub=True, lang=args.lang, country=args.country)
                with open(cat_file, 'w', encoding='utf-8') as f:
                    json.dump(categories, f, indent=4, ensure_ascii=False)
            
            # Determine limit
            limit = args.category_limit if args.category_limit is not None else (5 if category_href.lower() == 'quick-5' else None)
            
            if limit is not None:
                # Grab the first N parent categories and do NOT crawl subcategories!
                for cat in categories[:limit]:
                    path = cat.get('href') or cat.get('href_slug')
                    target_categories.append((cat.get('names', {}).get('en') if args.localize else cat.get('name'), path))
            else:
                # Gather all href slugs (both parent and subcategories to prevent skipping main-category-only products)
                for cat in categories:
                    # Always crawl the parent category
                    path = cat.get('href') or cat.get('href_slug')
                    target_categories.append((cat.get('names', {}).get('en') if args.localize else cat.get('name'), path))
                    
                    # Also crawl the subcategories if they exist
                    sub_cats = cat.get('sub_categories', [])
                    for sub in sub_cats:
                        sub_path = sub.get('href') or sub.get('href_slug')
                        target_categories.append((sub.get('names', {}).get('en') if args.localize else sub.get('name'), sub_path))
        else:
            target_categories = [(category_href, category_href)]

        db_lookup = {}
        if args.use_current_db:
            import glob
            # Resolve all possible paths to crawler outputs and master databases
            paths = [
                "../../data/extracted/crawler/jobs/*/results.json",
                "../data/extracted/crawler/jobs/*/results.json",
                "backend/data/extracted/crawler/jobs/*/results.json",
                "../../data/extracted/chefaa_products_eg.json",
                "../data/extracted/chefaa_products_eg.json",
                "backend/data/extracted/chefaa_products_eg.json"
            ]
            for pattern in paths:
                for path in glob.glob(pattern):
                    if os.path.exists(path):
                        try:
                            logging.info(f"Loading local cache reference from {path}...")
                            with open(path, 'r', encoding='utf-8') as f:
                                cached_data = json.load(f)
                                if isinstance(cached_data, list):
                                    for prod in cached_data:
                                        prod_slug = prod.get('id') or prod.get('slug')
                                        if not prod_slug and prod.get('url'):
                                            prod_slug = prod.get('url').strip('/').split('/')[-1]
                                        if prod_slug:
                                            db_lookup[prod_slug] = prod
                        except Exception as e:
                            logging.warning(f"Could not load cache path {path}: {e}")
            logging.info(f"Loaded {len(db_lookup)} cache entries from past crawls/databases.")

        # Print high-fidelity execution summary blueprint panel
        console.print(Panel(
            f"[bold cyan]Chefaa Localized Product Crawler Execution Blueprint[/bold cyan]\n\n"
            f"  • [bold white]Consolidation Mode[/bold white] : {'Localized Consolidation (--localize)' if args.localize else 'Single Language (' + args.lang + ')'}\n"
            f"  • [bold white]Deep Specs Enrichment[/bold white]  : {'Enabled' if args.deep else 'Disabled'}\n"
            f"  • [bold white]Total Categories Target[/bold white]: {len(target_categories)} nodes\n"
            f"  • [bold white]Pages To Scrape[/bold white]        : {args.pages}\n"
            f"  • [bold white]Export Target File[/bold white]    : {output_path}",
            border_style="magenta"
        ))

        all_products = []
        for idx, (name_label, path) in enumerate(target_categories):
            console.print(f"\n[bold magenta]▶ [{idx+1}/{len(target_categories)}] Crawl Session:[/bold magenta] [bold green]{name_label}[/bold green] [dim]({path})[/dim]")
            
            # Resolve page range
            pages_to_scrape = []
            if args.pages.isdigit():
                pages_to_scrape = [int(args.pages)]
            elif '-' in args.pages:
                try:
                    start, end = map(int, args.pages.split('-'))
                    pages_to_scrape = list(range(start, end + 1))
                except ValueError:
                    pages_to_scrape = [1]
            elif args.pages.lower() == 'all':
                # Dynamically fetch page count context
                _, max_pages_detected = scrape_products(path, page=1, lang=args.lang, country=args.country)
                pages_to_scrape = list(range(1, max_pages_detected + 1))
            else:
                pages_to_scrape = [1]
                
            session_table = Table(
                title=f"Session Stats: {name_label}", 
                show_header=True, 
                header_style="bold magenta", 
                border_style="cyan"
            )
            session_table.add_column("Page", style="bold green", justify="center")
            session_table.add_column("Locale", style="bold yellow", justify="center")
            session_table.add_column("Status", justify="center")
            session_table.add_column("Products Found", justify="right", style="cyan")
            session_table.add_column("Price Range", justify="right", style="green")
            session_table.add_column("Average Price", justify="right", style="yellow")

            if args.localize:
                prods = scrape_products_localized(path, pages_to_scrape, deep=args.deep, country=args.country, session_table=session_table, output_path=output_path, previously_scraped=all_products, workers=args.workers, use_current_db=args.use_current_db, db_lookup=db_lookup)
                all_products.extend(prods)
            else:
                for p in pages_to_scrape:
                    prods, _ = scrape_products(path, page=p, lang=args.lang, country=args.country, session_table=session_table)
                    
                    # Deep fetch
                    if args.deep and prods:
                        from concurrent.futures import ThreadPoolExecutor, as_completed
                        import threading
                        
                        save_lock = threading.Lock()
                        
                        def fetch_single_lang_details(pr):
                            slug = pr['url'].split('/')[-1] if pr.get('url') else ''
                            if args.use_current_db and slug in db_lookup:
                                cached = db_lookup[slug]
                                print(f"[CACHE HIT] Loaded details from database cache reference for product: {slug}")
                                details = {
                                    'description': cached.get('description', ''),
                                    'overview': cached.get('overview', {}).get(args.lang, '') if isinstance(cached.get('overview'), dict) else cached.get('overview', ''),
                                    'specification': cached.get('specification', {}),
                                    'featured_image': cached.get('featured_image', ''),
                                    'images': cached.get('images', []),
                                    'brand': cached.get('brand', {}).get('names', {}).get(args.lang, '') if isinstance(cached.get('brand'), dict) else cached.get('brand', '')
                                }
                                return pr, details
                            details = fetch_product_details(pr['url'])
                            return pr, details
                        
                        workers_count = args.workers
                        
                        with ThreadPoolExecutor(max_workers=workers_count) as executor:
                            futures = {executor.submit(fetch_single_lang_details, pr): pr for pr in prods}
                            
                            for idx_p, future in enumerate(as_completed(futures)):
                                pr, details = future.result()
                                pr.update(details)
                                
                                console.print(f"      [dim]({idx_p+1}/{len(prods)}) Specifications for: {pr['name']}...[/dim]")
                                
                                # Incremental save during single-language deep specs scraping
                                if output_path:
                                    with save_lock:
                                        try:
                                            temp_all = all_products + prods
                                            with open(output_path, 'w', encoding='utf-8') as f:
                                                json.dump(temp_all, f, indent=4, ensure_ascii=False)
                                        except Exception:
                                            pass
                            
                    # Standardize brand and category schemas
                    for pr in prods:
                        format_product_brand_and_category(pr, path, lang=args.lang, localize=False)
                        
                    all_products.extend(prods)
                    
                    # Save after each page in single-language mode
                    if output_path:
                        try:
                            with open(output_path, 'w', encoding='utf-8') as f:
                                json.dump(all_products, f, indent=4, ensure_ascii=False)
                        except Exception:
                            pass
            
            console.print(session_table)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(all_products, f, indent=4, ensure_ascii=False)
            
        console.print(Panel(
            f"[bold green]Product Scraping Execution Completed Successfully![/bold green]\n\n"
            f"  • [bold white]Total Products collected[/bold white]: {len(all_products)}\n"
            f"  • [bold white]Database saved to[/bold white]       : [bold]{output_path}[/bold]",
            border_style="green"
        ))

        # Re-enable standard console logging output
        configure_logging(interactive=False)
            
        logging.info(f"Saved scraped product list to '{output_path}'")

        # Product Image Downloader
        should_download = False
        if args.crawl_mode == "both":
            should_download = True
        elif args.crawl_mode == "catalog":
            should_download = False
        elif args.download: # fallback compatibility for deprecated --download argument
            should_download = True
            
        if should_download and all_products:
            logging.info("Starting decoupled product image downloading from source results...")
            run_media_extraction(output_path, workers=args.workers or 2, localize=args.localize)

        # Print Preview
        if all_products:
            table = Table(title=f"Products Scraped Listing Preview ({len(all_products)} total)", show_header=True, header_style="bold magenta", border_style="cyan")
            if args.localize:
                table.add_column("Product Name (en)", style="bold green", overflow="fold", width=25)
                table.add_column("Brand", style="bold yellow", width=12)
                table.add_column("Price (en)", justify="right", style="bold green", width=10)
                table.add_column("Product ID", style="blue")
                
                for prod in all_products[:15]:
                    name_en = prod.get('names', {}).get('en', '')
                    price = prod.get('price', '')
                    currency = prod.get('currency', '')
                    
                    brand_val = prod.get('brand')
                    brand_name = "No Brand"
                    if isinstance(brand_val, dict):
                        brand_name = brand_val.get('name') or brand_val.get('names', {}).get('en', 'No Brand')
                    elif isinstance(brand_val, str) and brand_val:
                        brand_name = brand_val
                        
                    table.add_row(name_en, brand_name, f"{price} {currency}", prod.get('id'))
            else:
                table.add_column("Product Name", style="bold green", overflow="fold", width=25)
                table.add_column("Brand", style="bold yellow", width=12)
                table.add_column("Price", justify="right", style="bold green", width=10)
                table.add_column("Relative Route", style="blue")
                
                for prod in all_products[:15]:
                    brand_val = prod.get('brand')
                    brand_name = "No Brand"
                    if isinstance(brand_val, dict):
                        brand_name = brand_val.get('name') or brand_val.get('names', {}).get('en', 'No Brand')
                    elif isinstance(brand_val, str) and brand_val:
                        brand_name = brand_val
                        
                    table.add_row(prod.get('name'), brand_name, f"{prod.get('price')} {prod.get('currency')}", prod.get('url'))
            console.print(table)

if __name__ == "__main__":
    main()
