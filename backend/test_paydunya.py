import paydunya

from core.config import settings


paydunya.api_keys = {
    "PAYDUNYA-MASTER-KEY": settings.paydunya_master_key,
    "PAYDUNYA-PRIVATE-KEY": settings.paydunya_private_key,
    "PAYDUNYA-TOKEN": settings.paydunya_token,
}

paydunya.debug = True

store = paydunya.Store(
    name="Amanah Giving",
)

invoice = paydunya.Invoice(store)

invoice.description = "Test de paiement Amanah Giving"
invoice.total_amount = 1000

successful, response = invoice.create()

print("SUCCESS:", successful)
print("RESPONSE TYPE:", type(response).__name__)
print("RESPONSE:", repr(response))