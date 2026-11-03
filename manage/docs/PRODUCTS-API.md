# Products API

## Get products

```http
GET https://mfecinsure.demohub24.com/api/admin/products/all
Authorization: Basic <base64(username:password)>
```

Use the Management account used to sign in to `/manage`. In production use HTTPS. This read-only API returns all products as `{ "items": [...], "total": number }` without pagination, preserving all product fields. It does not modify product records. Requests are rate limited. If `productId` is supplied, only exact matches are returned. Multiple IDs may be repeated or comma separated; omit the parameter to return all products.

Examples:

```sh
# All products
curl --user "$MANAGE_USERNAME:$MANAGE_PASSWORD" \
  https://mfecinsure.demohub24.com/api/admin/products/all

# Several products, repeated query parameter
curl --user "$MANAGE_USERNAME:$MANAGE_PASSWORD" \
  'https://mfecinsure.demohub24.com/api/admin/products/all?productId=PROD00001&productId=PROD00002'

# Several products, comma-separated
curl --user "$MANAGE_USERNAME:$MANAGE_PASSWORD" \
  'https://mfecinsure.demohub24.com/api/admin/products/all?productId=PROD00001,PROD00002'
```

Successful response:

```json
{
  "items": [
    {
      "productId": "PROD00001",
      "productCode": "MOTOR-001",
      "slug": "motor-one",
      "productName": "Example Motor Insurance",
      "productType": "MOTOR",
      "vehicleType": "CAR",
      "insuranceClass": "1",
      "shortDescription": "Example coverage",
      "description": "Example product description",
      "insurerName": "Example Insurance",
      "startingPremium": 12000,
      "coverage": {},
      "coverageLimits": {},
      "features": [],
      "terms": [],
      "eligibleVehicleTypes": ["CAR"],
      "minVehicleAge": 0,
      "maxVehicleAge": 20,
      "active": true,
      "featured": false,
      "displayOrder": 1,
      "createdAt": "2026-01-10T08:00:00.000Z",
      "updatedAt": "2026-01-10T08:00:00.000Z"
    }
  ],
  "total": 1
}
```

Invalid or missing credentials return `401`. Empty matches return `{"items":[],"total":0}`. The existing `GET /api/admin/products` Management endpoint remains unchanged and session-only with its search and pagination behavior.
