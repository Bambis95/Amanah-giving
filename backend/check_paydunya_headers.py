import paydunya

from core.config import settings


paydunya.api_keys = {
    "PAYDUNYA-MASTER-KEY": settings.paydunya_master_key,
    "PAYDUNYA-PRIVATE-KEY": settings.paydunya_private_key,
    "PAYDUNYA-TOKEN": settings.paydunya_token,
}

paydunya.debug = True

from paydunya import Invoice, Store

invoice = Invoice(Store(name="Amanah Giving"))

master = invoice.headers["PAYDUNYA-MASTER-KEY"]
private = invoice.headers["PAYDUNYA-PRIVATE-KEY"]
token = invoice.headers["PAYDUNYA-TOKEN"]

print("ENDPOINT:", invoice.get_rsc_endpoint("checkout-invoice/create"))
print("MASTER LEN:", len(master))
print("PRIVATE LEN:", len(private))
print("TOKEN LEN:", len(token))
print("MASTER HAS SPACE:", " " in master)
print("PRIVATE HAS SPACE:", " " in private)
print("TOKEN HAS SPACE:", " " in token)
print("MASTER HAS QUOTE:", '"' in master or "'" in master)
print("PRIVATE HAS QUOTE:", '"' in private or "'" in private)
print("TOKEN HAS QUOTE:", '"' in token or "'" in token)