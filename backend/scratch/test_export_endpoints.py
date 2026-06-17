import requests
import sys

API_URL = "http://localhost:8000"

def test_endpoints():
    print("Fetching jobs...")
    try:
        r = requests.get(f"{API_URL}/api/matcher/jobs?limit=5")
        if r.status_code != 200:
            print(f"Error fetching jobs: {r.status_code}")
            return
        jobs = r.json().get("jobs", [])
        if not jobs:
            print("No jobs found in the system to test exports against.")
            return
        
        # Find a completed job
        completed_jobs = [j for j in jobs if j["status"] == "completed"]
        if not completed_jobs:
            print(f"Found {len(jobs)} jobs, but none are completed. Jobs: {[j['status'] for j in jobs]}")
            # Use the first job anyway as a fallback
            job = jobs[0]
            print(f"Using fallback job {job['job_id']} (status: {job['status']})")
        else:
            job = completed_jobs[0]
            print(f"Using completed job {job['job_id']}")
        
        job_id = job["job_id"]
        
        # 1. Test Excel Export
        print("\nTesting Excel Export...")
        export_params = {
            "format": "xlsx",
            "statuses": "matched,review,no_match",
            "scope": "all",
            "offset": 0,
            "limit": 100,
            "columns": "row_index,original_name,match_status,match_score,sku,custom_name_en,custom_price"
        }
        resp = requests.get(f"{API_URL}/api/matcher/job/{job_id}/export", params=export_params)
        print(f"Response Status: {resp.status_code}")
        print(f"Headers: {resp.headers}")
        if resp.status_code == 200:
            print(f"Excel Download Successful. Received {len(resp.content)} bytes.")
        else:
            print(f"Excel Download Failed: {resp.text}")
            
        # 2. Test JSON Export
        print("\nTesting JSON Export...")
        export_params["format"] = "json"
        resp = requests.get(f"{API_URL}/api/matcher/job/{job_id}/export", params=export_params)
        print(f"Response Status: {resp.status_code}")
        if resp.status_code == 200:
            print(f"JSON Download Successful. Received {len(resp.content)} bytes.")
            try:
                data = resp.json()
                print(f"Sample item count: {len(data)}")
                if data:
                    print(f"First item: {data[0]}")
            except Exception as e:
                print(f"Failed to parse JSON: {e}")
        else:
            print(f"JSON Download Failed: {resp.text}")
            
        # 3. Test TSV/TXT Export
        print("\nTesting TXT/TSV Export...")
        export_params["format"] = "txt"
        resp = requests.get(f"{API_URL}/api/matcher/job/{job_id}/export", params=export_params)
        print(f"Response Status: {resp.status_code}")
        if resp.status_code == 200:
            print(f"TXT Download Successful. Received {len(resp.content)} bytes.")
            print(f"Sample content:\n{resp.text[:500]}")
        else:
            print(f"TXT Download Failed: {resp.text}")

        # 4. Test Media Zip Export
        print("\nTesting Media Zip Export...")
        media_params = {
            "statuses": "matched,review",
            "scope": "all",
            "offset": 0,
            "limit": 50,
            "media_types": "products,brands"
        }
        resp = requests.get(f"{API_URL}/api/matcher/job/{job_id}/export_media", params=media_params)
        print(f"Response Status: {resp.status_code}")
        print(f"Headers: {resp.headers}")
        if resp.status_code == 200:
            print(f"Media ZIP Download Successful. Received {len(resp.content)} bytes.")
        else:
            print(f"Media ZIP Download Failed: {resp.text}")
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    test_endpoints()
