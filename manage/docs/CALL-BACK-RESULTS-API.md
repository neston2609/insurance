# Call Back Result API

Create a callback-result record from an agent or virtual-agent integration:

```http
POST /api/public/call-back-results
Authorization: Basic <base64(username:password)>
Content-Type: application/json
```

Configure the unique `CALLBACK_API_USERNAME` and `CALLBACK_API_PASSWORD` values in the management app's environment before using the endpoint. Requests without valid credentials receive `401`. If either credential is unset, the endpoint remains unavailable. Use HTTPS in production; Basic Authentication does not encrypt credentials on its own.

Request body:

```json
{
  "customerId": "CUST00001",
  "policyId": "POL00001",
  "status": "CONTACTED",
  "agentName": "Agentic Virtual Agent",
  "detail": "Intent"
}
```

The API verifies that the policy belongs to the supplied customer, then resolves the customer name, policy number and expiry date, and product/vehicle details from the management data. It stores `detail` as Customer Intent, `agentName` as Contacted By, and `status` as Status. A new record returns `201 Created`; if the same customer/policy pair already exists, that record is updated and returned with `200 OK` (no duplicate is created). Unknown customer/policy IDs return `404`; a customer/policy mismatch returns `400`.

Example using curl:

```sh
curl --user "$CALLBACK_API_USERNAME:$CALLBACK_API_PASSWORD" \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"CUST00001","policyId":"POL00001","status":"CONTACTED","agentName":"Agentic Virtual Agent","detail":"Intent"}' \
  https://mfecinsure.demohub24.com/api/public/call-back-results
```

The management UI lists the saved fields under **Call Back Result**. The records are stored in `data/call-back-results.json` and included in normal data backups.
