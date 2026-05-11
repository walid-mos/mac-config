# Hetzner Cloud API - Live Pricing & Availability

The skill tables are hand-verified snapshots. For authoritative, real-time data use the Hetzner Cloud API. Treat the API as the source of truth when a price might be stale, when the user provisions outside EU, or when a SKU is missing from the tables.

## Authentication

All endpoints require a Bearer token - even read-only catalog endpoints. Obtain one at:
**Hetzner Cloud Console → project → Security → API Tokens → Read**

A **Read** token is sufficient for everything in this file. No Write token is ever needed for pricing lookups.

```bash
export HETZNER_API_KEY_READ="<your-read-token>"
```

## Endpoints

Base URL: `https://api.hetzner.cloud/v1`

| Endpoint | Returns | Use for |
|---|---|---|
| `GET /server_types` | Full catalog: 25+ SKUs with cores, RAM, disk, arch, category, per-location availability, per-location prices | Specs + deprecation status |
| `GET /pricing` | Currency, vat_rate, prices for server_types, volumes, images, load_balancers, traffic, floating_ips, primary_ips | Prices only, one consolidated payload |
| `GET /datacenters` | 6 datacenters and their supported server_types | "Where can I provision X?" |

## Quick recipes

**List every server type with per-location availability and deprecation:**
```bash
curl -s -H "Authorization: Bearer $HETZNER_API_KEY_READ" \
  https://api.hetzner.cloud/v1/server_types \
  | jq -r '.server_types[]
    | "\(.name) [\(.architecture)/\(.cpu_type) \(.cores)c/\(.memory)G/\(.disk)GB]: "
      + ([.locations[] | "\(.name)="
          + (if .available then "OK"
             else (if .deprecation then "DEPR" else "NA" end) end)
        ] | join(" "))'
```

**Cheapest location for a given SKU (e.g. cpx22):**
```bash
curl -s -H "Authorization: Bearer $HETZNER_API_KEY_READ" \
  https://api.hetzner.cloud/v1/server_types \
  | jq '.server_types[] | select(.name=="cpx22")
    | .prices | min_by(.price_monthly.net | tonumber)
    | {location, monthly_net: .price_monthly.net, hourly_net: .price_hourly.net}'
```

**Verify a price quoted in the skill:**
```bash
curl -s -H "Authorization: Bearer $HETZNER_API_KEY_READ" \
  https://api.hetzner.cloud/v1/pricing \
  | jq '.pricing.server_types[] | select(.name=="<sku>") | .prices[] | select(.location=="fsn1")'
```

## Response shape - key fields

```jsonc
// /v1/server_types → .server_types[]
{
  "name": "cpx21",
  "architecture": "x86",          // "x86" | "arm"
  "cpu_type": "shared",           // "shared" | "dedicated"
  "category": "regular_purpose",
  "cores": 3, "memory": 4, "disk": 80,
  "deprecated": false,
  "deprecation": null,            // or {announced, unavailable_after}
  "locations": [                  // per-location availability
    {"name": "fsn1", "available": false,
     "deprecation": {"announced": "...", "unavailable_after": "2025-12-31T23:59:59Z"}},
    {"name": "ash",  "available": true, "deprecation": null}
  ],
  "prices": [                     // per-location pricing
    {"location": "fsn1",
     "price_hourly":  {"net": "0.0152000000", "gross": "0.0152000000"},
     "price_monthly": {"net": "9.4900000000", "gross": "9.4900000000"},
     "included_traffic": 21990232555520,
     "price_per_tb_traffic": {"net": "1.0000000000", "gross": "1.0000000000"}}
  ]
}
```

Notes:
- `vat_rate` at `/v1/pricing` is `"0.000000"` by default - `gross == net` unless the account has VAT configured. Always surface prices as **VAT excluded** regardless.
- `included_traffic` is bytes (e.g. `21990232555520` = 20 TiB).
- Deprecation is reported **per location**, not globally. A SKU can be deprecated in fsn1 but still `available: true` in ash.

## Datacenters (as of 2026-04-15)

| Code | Location | Region |
|---|---|---|
| `fsn1` | Falkenstein | Germany (EU) |
| `nbg1` | Nuremberg | Germany (EU) |
| `hel1` | Helsinki | Finland (EU) |
| `ash` | Ashburn, VA | US-East |
| `hil` | Hillsboro, OR | US-West |
| `sin` | Singapore | APAC |

**EU locations are cheapest.** US locations (`ash`, `hil`) run ~25% above EU on most SKUs. `sin` runs ~2× EU and has **only 2 TB included traffic** (vs 20 TB in EU) plus €7.40/TB overage. Skill tables document **EU prices only** - if the user provisions in US or APAC, quote via the API instead of the tables.

## When to use the API vs the tables

| Situation | Use |
|---|---|
| User asks "how much is CX23?" | **Tables** (fastest, human-verified) |
| `synced-at` is > 3 months old | **API** to re-verify before quoting |
| User targets `ash`, `hil`, or `sin` | **API** (tables are EU-only) |
| User mentions a SKU not in the tables | **API** to check if it exists / is deprecated |
| Automating a cost estimate in CI | **API** (with a project Read token in secrets) |
| User asks about volumes, LBs, floating IPs, traffic overage | **API** `/pricing` - tables don't cover these |
