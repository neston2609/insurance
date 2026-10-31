# Call Back Result API

Create a callback-result record from an agent or virtual-agent integration:

```http
POST /api/public/call-back-results
Authorization: Basic <base64(username:password)>
Content-Type: application/json
```

Use the same Management username and password used to sign in to `/manage`. Requests without valid credentials receive `401`. Use HTTPS in production; Basic Authentication does not encrypt credentials on its own.

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

The API verifies that the policy belongs to the supplied customer, then resolves the customer name, policy number and expiry date, and product/vehicle details from the management data. It stores `detail` as Customer Intent, `agentName` as Contacted By, `status` as Status, and adds `createdAt` using the server's current date and time. When the same customer/policy pair is submitted again, its record is updated (including the timestamp) and returned with `200 OK`; no duplicate is created. A new record returns `201 Created`. Unknown customer/policy IDs return `404`; a customer/policy mismatch returns `400`.

Example using curl:

```sh
curl --user "$CALLBACK_API_USERNAME:$CALLBACK_API_PASSWORD" \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"CUST00001","policyId":"POL00001","status":"CONTACTED","agentName":"Agentic Virtual Agent","detail":"Intent"}' \
  https://mfecinsure.demohub24.com/api/public/call-back-results
```

The management UI lists the timestamp as the first **Date/Time** column under **Call Back Result**. Management users can delete records from that page; the delete API is `DELETE /api/admin/call-back-results/:id` and requires a Management session. The records are stored in `data/call-back-results.json` and included in normal data backups.
