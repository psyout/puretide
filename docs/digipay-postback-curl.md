# DigiPay postback – curl checks

Your postback **always returns HTTP 200** with an XML body (`<rsp stat="ok">` or `<rsp stat="fail">`). Use these from your **VPS** so the request comes from an allowed IP.

## 1. Allow your VPS IP (one-time)

On the server, set in `.env` (or your env config):

```bash
DIGIPAY_POSTBACK_ALLOWED_IP=185.240.29.227,82.221.139.21
```

(Use your real outbound IP if different; get it with `curl -s ifconfig.me`.)

Restart the app after changing env.

---

## 2. Curl from the VPS

Run these **from the VPS** (e.g. SSH into `mail` / `puretide`).

**A) Check HTTP status and save XML:**

```bash
curl -s -w "\nHTTP_CODE:%{http_code}\n" -o /tmp/postback_resp.xml \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "session=6101_test&amount=29_99&status=approved" \
  https://puretide.ca/api/digipay/postback
```

**B) Show status code and body:**

```bash
echo "--- HTTP status ---"
grep HTTP_CODE /tmp/postback_resp.xml || true

echo "--- Response XML ---"
cat /tmp/postback_resp.xml
```

You should see **HTTP_CODE:200** and valid XML. If the IP is not allowed you’ll get XML with `<rsp stat="fail">` and error 101 (unauthorized IP). If IP is allowed but there’s no order for `6101_test`, you’ll get a different fail code (e.g. 102); the important part is **200 + valid XML**.

**C) One-liner (status + XML):**

```bash
curl -s -w "\n\nHTTP status: %{http_code}\n" \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "session=6101_test&amount=29_99&status=approved" \
  https://puretide.ca/api/digipay/postback
```

---

## 3. Optional – expect “ok” (only if order exists)

If you have an order in the DB with `session = 6101_test` and total 29.99, the same curl can return `<rsp stat="ok">` and “Purchase successfully processed”. Otherwise you’ll get a fail (e.g. “Invalid session variable”) – still **200 + valid XML**, which is enough to prove the endpoint works.
