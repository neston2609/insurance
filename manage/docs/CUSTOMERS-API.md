# Customers API

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
