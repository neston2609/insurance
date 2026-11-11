# Genesys AVA Schedule Callback API

Create a future callback in Genesys Cloud using the configured MFEC Insure queue:

```http
POST /api/admin/genesys/schedule-callback
Authorization: Basic <base64(username:password)>
Content-Type: application/json
```

Use the existing Management username and password. The API also accepts an authenticated Management session. Use HTTPS in production. The endpoint never accepts a caller-supplied Genesys queue ID.

## Request

All listed fields are required. Text fields may be empty if they do not apply. `timezone` must be `Asia/Bangkok`.

```json
{
  "scheduleType": "RELATIVE_MINUTES",
  "delayMinutes": 10,
  "dayOffset": 0,
  "callbackDate": "",
  "callbackTime": "",
  "timezone": "Asia/Bangkok",
  "callbackNumber": "0652936493",
  "callbackUserName": "สุวัจชัย รสิกวรรณ",
  "customerIntent": "RENEWAL_REQUEST",
  "productInterest": "Accident Usage Protection",
  "customerQuestion": "ต้องการสอบถามส่วนลดต่ออายุ",
  "conversationSummary": "ลูกค้าสนใจต่ออายุประกันรถ BYD Atto 3 และต้องการสอบถามส่วนลด"
}
```

Supported schedule types:

- `RELATIVE_MINUTES`: `delayMinutes` from the current instant (1–525600).
- `DAY_OFFSET_TIME`: Bangkok current date plus `dayOffset` (0–365), combined with `callbackTime` in `HH:mm`.
- `ABSOLUTE_DATE_TIME`: `callbackDate` (`YYYY-MM-DD`) and `callbackTime` (`HH:mm`), interpreted in Bangkok time.

The service resolves wall-clock date/time using the IANA `Asia/Bangkok` zone, rejects past times, and sends UTC ISO-8601 to Genesys. Thai mobile numbers are normalized to E.164. Thai AVA context is sent using the Genesys callback `data` map with `AVA_INTENT`, `AVA_PRODUCT_INTEREST`, `AVA_CUSTOMER_QUESTION`, and `AVA_SUMMARY` keys.

## Success

HTTP `200`:

```json
{
  "callbackCreated": true,
  "callbackId": "genesys-conversation-id",
  "callbackNumber": "0652936493",
  "scheduledTimeUtc": "2026-11-15T03:00:00.000Z",
  "scheduledTimeThai": "15 พฤศจิกายน 2569 เวลา 10:00 น."
}
```

An identical request within the configured duplicate-protection window returns the original scheduled callback ID rather than creating another callback. If Genesys accepts an asynchronous create without returning an identifier, `callbackId` is the stable local audit record ID.

## Failures

Invalid request/phone/time returns HTTP `400`, with `callbackCreated: false` and a safe error code (`INVALID_REQUEST`, `INVALID_PHONE`, or `INVALID_CALLBACK_TIME`). Genesys OAuth/API failures return HTTP `502` and safe codes (`GENESYS_AUTH_ERROR` or `GENESYS_CALLBACK_ERROR`). An in-flight duplicate request returns HTTP `409` (`DUPLICATE_REQUEST`).

## Server configuration

Set all four values to enable integration; partial configuration prevents startup:

```text
GENESYS_CLIENT_ID
GENESYS_CLIENT_SECRET
GENESYS_REGION=ap_southeast_2
GENESYS_CALLBACK_QUEUE_ID
```

`GENESYS_CALLBACK_DUPLICATE_WINDOW_MS` is optional (default `300000`, maximum `86400000`). Client secrets and access tokens are never returned, persisted, or logged. Callback audit records are stored separately in `DATA_DIR/genesys-callback-audit.json`.
