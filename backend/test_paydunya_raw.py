import requests

from core.config import settings


url = "https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create"

headers = {
    "PAYDUNYA-MASTER-KEY": settings.paydunya_master_key,
    "PAYDUNYA-PRIVATE-KEY": settings.paydunya_private_key,
    "PAYDUNYA-TOKEN": settings.paydunya_token,
    "Content-Type": "application/json",
}

payload = {
    "invoice": {
        "total_amount": 1000,
        "description": "Test Amanah Giving",
    },
    "store": {
        "name": "Amanah Giving",
        "tagline": "Plateforme de dons",
        "website_url": settings.frontend_url,
    },
}

response = requests.post(
    url,
    json=payload,
    headers=headers,
    timeout=30,
)

print("HTTP STATUS:", response.status_code)
print("RESPONSE:", response.text)