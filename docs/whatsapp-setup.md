# WhatsApp order-status bot — setup

Customers message the MEZU WhatsApp number; the bot (Claude) looks up **their own
orders by their WhatsApp number** and replies with order + shipping status in Hebrew.
Customer-initiated "service" conversations are **free** on the Cloud API.

## What the code does (already built)
- `GET/POST /api/whatsapp` — Meta webhook (verification + incoming messages)
- `src/lib/wa-cloud.ts` — send messages, verify signature
- `src/lib/order-lookup.ts` — find the sender's orders + K-Express shipping status
- `src/lib/wa-bot.ts` — Claude composes the reply (grounded in real data)

## One-time Meta setup (you do this)
1. **Meta Business account** → https://business.facebook.com
2. **Developers app**: https://developers.facebook.com → Create App → type *Business* → add the **WhatsApp** product.
3. In WhatsApp → API setup: you get a **test number** + a temporary token. Note the **Phone number ID**.
4. **Add your real sending number** (a number NOT currently on a WhatsApp/WhatsApp-Business app), verify it by SMS/call, and set a display name.
5. **Business Verification** (Meta Business Settings → Security Center): required to message real customers / raise limits. One-time, free, needs business docs. (Until verified you can only message ~5 test numbers.)
6. **Permanent token**: create a *System User* in Business Settings → assign the app → generate a token with `whatsapp_business_messaging` + `whatsapp_business_management`. This is `WHATSAPP_TOKEN`.
7. **Webhook**: WhatsApp → Configuration → Edit webhook:
   - Callback URL: `https://mezu-crm.vercel.app/api/whatsapp`
   - Verify token: any string you choose → put the same value in `WHATSAPP_VERIFY_TOKEN`.
   - Subscribe to the **messages** field.
8. (Optional, recommended) copy the app's **App Secret** → `WHATSAPP_APP_SECRET` (enables request-signature checks).

## Env vars (Vercel → Project → Settings → Environment Variables)
```
WHATSAPP_VERIFY_TOKEN   = <the string you chose in step 7>
WHATSAPP_TOKEN          = <permanent system-user token, step 6>
WHATSAPP_PHONE_NUMBER_ID= <from step 3>
WHATSAPP_APP_SECRET     = <app secret, optional>
ANTHROPIC_API_KEY       = <Claude API key>
# already set for the CRM: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, RUN_* (tracking)
```
Add to all environments (Production + Preview), then redeploy.

## Notes
- Matching is by the **sender's WhatsApp number** → their `customers.phone` (normalized to `0XXXXXXXXX`). So a customer only ever sees their own orders. They can also send an order number to narrow down.
- If `ANTHROPIC_API_KEY` is missing, the bot still replies with a plain templated status (no AI).
- Shipping status comes from K-Express (`getTracking`) for orders that have a tracking number.
