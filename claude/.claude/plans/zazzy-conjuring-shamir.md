# Plan: Add `setup-email` action to infrastructure pipeline

## Context

Emails sent via Resend from `nextnode.fr` land in spam due to missing SPF, DKIM, and DMARC DNS records. The user wants a **GitHub Actions workflow_dispatch action** they can trigger from the Actions UI with the required fields, which calls a Dagger function to create all email DNS records via the Cloudflare API.

## Changes

### 1. Add `setupEmail` function to DNS Dagger module

**File:** `infrastructure/dagger-modules/dns/src/src/index.ts`

Add a public `setupEmail` function to the `Dns` class:

```typescript
@func()
async setupEmail(
    domain: string,              // e.g. "nextnode.fr"
    cloudflareToken: Secret,     // Cloudflare API token
    dkimNames: string,           // comma-separated DKIM record names from Resend
    dkimValues: string,          // comma-separated DKIM CNAME targets from Resend
    dmarcEmail = "",             // optional rua address (defaults to dmarc@{domain})
): Promise<string>
```

**Logic:**
1. Extract root domain, look up Cloudflare zone ID via `GET /zones?name={rootDomain}`
2. Create SPF TXT record: `v=spf1 include:send.resend.com ~all`
3. Create DMARC TXT record: `v=DMARC1; p=none; rua=mailto:{dmarcEmail || dmarc@domain}`
4. Create DKIM CNAME records from the comma-separated name/value pairs
5. Return summary of all created records

Uses the same curl + jq + alpine pattern as the VPS module's Cloudflare API calls.

### 2. Add `setup-email` action to pipeline workflow_dispatch

**File:** `infrastructure/.github/workflows/pipeline.yml`

Extend the existing `workflow_dispatch` inputs:
- Add `setup-email` to the `action.options` choice list
- Add input fields: `domain`, `dkim_names`, `dkim_values`, `dmarc_email` (optional)

Add a new job `setup-email`:
```yaml
setup-email:
  name: Setup Email DNS
  if: github.event_name == 'workflow_dispatch' && github.event.inputs.action == 'setup-email'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: dagger/dagger-for-github@v6
      with:
        version: "0.19.11"
        verb: version
    - name: Setup Email DNS Records
      run: |
        dagger call \
          -m github.com/NextNodeSolutions/infrastructure/dagger-modules/dns \
          setup-email \
          --domain "${{ github.event.inputs.domain }}" \
          --cloudflare-token env:CLOUDFLARE_API_TOKEN \
          --dkim-names "${{ github.event.inputs.dkim_names }}" \
          --dkim-values "${{ github.event.inputs.dkim_values }}" \
          --dmarc-email "${{ github.event.inputs.dmarc_email }}"
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Usage

Go to Actions > NextNode Pipeline > Run workflow, select `setup-email`, fill in:
- **domain:** `nextnode.fr`
- **dkim_names:** paste the 3 DKIM names from Resend (comma-separated)
- **dkim_values:** paste the 3 DKIM CNAME values from Resend (comma-separated)
- **dmarc_email:** (optional) defaults to `dmarc@nextnode.fr`

## Verification

1. `cd infrastructure/dagger-modules/dns && dagger functions` — confirm `setup-email` shows up
2. Test locally: `dagger call -m ./dagger-modules/dns setup-email --domain nextnode.fr --cloudflare-token env:CLOUDFLARE_API_TOKEN --dkim-names "..." --dkim-values "..."`
3. After run: `dig TXT nextnode.fr` (SPF), `dig TXT _dmarc.nextnode.fr` (DMARC), `dig CNAME resend._domainkey.nextnode.fr` (DKIM)
