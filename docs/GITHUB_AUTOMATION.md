# GitHub Automation — Mistral Verifier Agent

## Overview

The Mistral GitHub Verifier Agent reviews PRs for security issues and code quality. It **never auto-merges** — it only reads code and posts comments or saves reports.

## Setup

### 1. Generate a Fine-Grained GitHub PAT

1. Go to https://github.com/settings/tokens?type=beta
2. Click "Generate new token"
3. Set name: `parlaycity-verifier`
4. Set expiration: 30 days (or session duration)
5. Repository access: select your ParlayCity repo only
6. Permissions:
   - **Contents**: Read
   - **Pull requests**: Read and Write
   - **Issues**: Read and Write (optional)
7. Generate and copy the token

### 2. Set Environment Variables

```bash
export MISTRAL_API_KEY=<your-mistral-key>
export GITHUB_PERSONAL_ACCESS_TOKEN=<your-fine-grained-pat>
```

Or add to `.env` (never commit this file).

### 3. Run the Agent

```bash
# Save report locally only
python3 scripts/verifier/mistral_github_agent.py --repo owner/repo --pr 123 --report-only

# Save report AND post as PR comment
python3 scripts/verifier/mistral_github_agent.py --repo owner/repo --pr 123 --comment
```

## What It Reviews

- Reentrancy vulnerabilities
- Integer overflow / precision loss
- Access control gaps
- Oracle manipulation vectors
- Gas optimization opportunities
- Code quality issues

## Safety Rules

- **Never auto-merges PRs**
- Only reads code and writes comments
- Fine-grained PAT has minimal scopes
- All reviews are saved to `docs/reviews/` for audit trail
- Mistral API calls are rate-limited and logged

## CI Integration (Optional)

Not included in default CI to avoid requiring secrets. To add:

```yaml
# .github/workflows/review.yml (manual trigger only)
on:
  workflow_dispatch:
    inputs:
      pr_number:
        required: true
```

This keeps the Mistral API key out of automated CI runs.
