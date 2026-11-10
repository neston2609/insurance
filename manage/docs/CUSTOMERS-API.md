# Customers API

## Find a customer by mobile phone

```http
GET https://mfecinsure.demohub24.com/api/admin/customers/by-phone?phone=0818376355
Authorization: Basic <base64(username:password)>
```

Use the Management account used to sign in to `/manage`, over HTTPS in production. The `phone` query parameter accepts Thai mobile numbers in local (`0818376355`), country-code (`66818376355`), or international (`+66818376355`) format. The API normalizes these formats before matching. It returns the customer record, all matching policies with full policy fields, linked product details, and `totalPolicies`. Invalid or missing phone numbers return `400`; a valid number with no matching customer returns `404`. Responses are not cached and requests are rate limited.

```sh
curl --user "$MANAGE_USERNAME:$MANAGE_PASSWORD" \
  'https://mfecinsure.demohub24.com/api/admin/customers/by-phone?phone=%2B66818376355'
```

If you prefer not to put the phone number in the URL, send it in a JSON request body with `POST` to the same full URI:

```sh
curl --user "$MANAGE_USERNAME:$MANAGE_PASSWORD" \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+66818376355"}' \
  'https://mfecinsure.demohub24.com/api/admin/customers/by-phone'
```

Both `GET` and `POST` accept the same three phone formats and return the same response. Use HTTPS in production.

Example response:

```json
{
  "customer": {
    "customerId": "CUST00001",
    "firstName": "สมชาย",
    "lastName": "ตัวอย่าง",
    "phone": "+66812345678"
  },
  "policies": [
    {
      "policyId": "POL00001",
      "policyNumber": "MFEC-MC-2026-00001",
      "customerId": "CUST00001",
      "productId": "PROD00006",
      "effectiveDate": "2026-01-15",
      "expiryDate": "2026-11-14",
      "premium": 4250,
      "vehicle": {
        "vehicleType": "MOTORCYCLE",
        "brand": "Honda",
        "model": "PCX 160",
        "year": 2024,
        "licensePlate": "กข 1234",
        "province": "กรุงเทพมหานคร"
      },
      "product": {
        "productId": "PROD00006",
        "productName": "Example motorcycle insurance"
      },
      "daysUntilExpiry": 0
    }
  ],
  "totalPolicies": 1
}
```

The response example is abbreviated; each policy includes all stored policy fields and the full linked product record.

## Get customers

```http
GET https://mfecinsure.demohub24.com/api/admin/customers/all
Authorization: Basic <base64(username:password)>
```

Use the Management account used to sign in to `/manage`. In production use HTTPS. This read-only API returns all customers as `{ "items": [...], "total": number }` without pagination, preserving all customer fields. It does not modify customer records. Requests are rate limited. If `customerId` is supplied, only exact matches are returned. Multiple IDs may be repeated or comma separated; omit the parameter to return all customers.

Examples:

```sh
# All customers
curl --user "$MANAGE_USERNAME:$MANAGE_PASSWORD" \
  https://mfecinsure.demohub24.com/api/admin/customers/all

# Several customers, repeated query parameter
curl --user "$MANAGE_USERNAME:$MANAGE_PASSWORD" \
  'https://mfecinsure.demohub24.com/api/admin/customers/all?customerId=CUST00001&customerId=CUST00002'

# Several customers, comma-separated
curl --user "$MANAGE_USERNAME:$MANAGE_PASSWORD" \
  'https://mfecinsure.demohub24.com/api/admin/customers/all?customerId=CUST00001,CUST00002'
```

Successful response:

```json
{
  "items": [
    {
      "customerId": "CUST00001",
      "firstName": "Example",
      "lastName": "Customer",
      "phone": "0812345678",
      "email": "customer@example.com",
      "preferredChannel": "LINE",
      "province": "Bangkok",
      "dnc": false,
      "createdAt": "2026-01-10T08:00:00.000Z",
      "updatedAt": "2026-01-10T08:00:00.000Z"
    }
  ],
  "total": 1
}
```

Invalid or missing credentials return `401`. Empty matches return `{"items":[],"total":0}`. The existing `GET /api/admin/customers` Management endpoint remains unchanged and session-only with its search and pagination behavior.
