import urllib.request
import urllib.error
import json
import sys

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    url = "https://meilisearch.chefaa.com/indexes/products_eg/search"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Authorization': 'Bearer aa66bf66db30dea9b9746c8f6397d7a0112a055c70d80527b300c3dec85fcc41',
        'Content-Type': 'application/json'
    }

    # سنحاول طلب منتجات بـ offset = 1000 لتجاوز الحد الأقصى
    payload = {
        'q': '',
        'limit': 10,
        'offset': 1000
    }

    print("Sending Meilisearch query with offset=1000...")
    
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            response_data = json.loads(res.read().decode('utf-8'))
            print("\nResponse Received successfully:")
            print(json.dumps(response_data, indent=4, ensure_ascii=False))
    except urllib.error.HTTPError as e:
        print(f"\nHTTP Error {e.code}: {e.reason}")
        try:
            error_body = e.read().decode('utf-8')
            print("Error details from server:")
            print(json.dumps(json.loads(error_body), indent=4))
        except Exception:
            pass
    except Exception as e:
        print(f"\nError: {e}")

if __name__ == "__main__":
    main()
