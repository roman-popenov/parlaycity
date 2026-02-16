#!/usr/bin/env python3
"""
Mistral GitHub Verifier Agent

Uses Mistral Agents API to review PRs and post comments.
This is an optional automation — never auto-merges, only comments.

Usage:
    export MISTRAL_API_KEY=<key>
    export GITHUB_PERSONAL_ACCESS_TOKEN=<fine-grained-pat>
    python3 scripts/verifier/mistral_github_agent.py --repo owner/repo --pr 123

Required GitHub PAT scopes (fine-grained):
    - Contents: Read
    - Pull requests: Read + Write (for comments)
    - Issues: Write (optional, for opening review issues)
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' package required. Install with: pip install requests")
    sys.exit(1)

MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY")
GITHUB_TOKEN = os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN")
MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"


def get_pr_diff(repo: str, pr_number: int) -> str:
    """Fetch PR diff from GitHub API."""
    url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3.diff",
    }
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.text


def get_pr_files(repo: str, pr_number: int) -> list:
    """Fetch list of changed files in PR."""
    url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}/files"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def review_with_mistral(diff: str, files: list) -> str:
    """Send diff to Mistral for security + quality review."""
    file_list = "\n".join(f"- {f['filename']} (+{f['additions']}/-{f['deletions']})" for f in files)

    prompt = f"""You are a smart contract security reviewer for ParlayCity (an onchain parlay betting platform).

Review this PR diff. Focus on:
1. Security issues (reentrancy, overflow, access control, oracle manipulation)
2. Logic errors in parlay math or settlement
3. Gas optimization opportunities
4. Code quality (naming, structure, missing events)

Changed files:
{file_list}

Diff (truncated to 6000 chars):
```diff
{diff[:6000]}
```

Provide a concise review in markdown format. Rate severity: Critical / High / Medium / Low / Info."""

    headers = {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": "mistral-large-latest",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1500,
        "temperature": 0.2,
    }
    resp = requests.post(MISTRAL_CHAT_URL, headers=headers, json=body, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


def post_pr_comment(repo: str, pr_number: int, body: str) -> None:
    """Post a review comment on the PR."""
    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }
    resp = requests.post(url, headers=headers, json={"body": body}, timeout=30)
    resp.raise_for_status()
    print(f"Comment posted: {resp.json()['html_url']}")


def save_report(review: str, repo: str, pr_number: int) -> str:
    """Save review to docs/reviews/."""
    ts = datetime.now().strftime("%Y%m%dT%H%M%S")
    out_dir = Path("docs/reviews")
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{ts}-mistral-pr{pr_number}.md"
    content = f"""# Mistral Review — PR #{pr_number} ({repo})

Generated: {datetime.now().isoformat()}
Script: `scripts/verifier/mistral_github_agent.py`

## Review

{review}
"""
    path.write_text(content)
    return str(path)


def main():
    parser = argparse.ArgumentParser(description="Mistral GitHub Verifier Agent")
    parser.add_argument("--repo", required=True, help="GitHub repo (owner/repo)")
    parser.add_argument("--pr", required=True, type=int, help="PR number")
    parser.add_argument("--comment", action="store_true", help="Post review as PR comment")
    parser.add_argument("--report-only", action="store_true", help="Only save local report")
    args = parser.parse_args()

    if not MISTRAL_API_KEY:
        print("ERROR: MISTRAL_API_KEY not set")
        sys.exit(1)
    if not GITHUB_TOKEN:
        print("ERROR: GITHUB_PERSONAL_ACCESS_TOKEN not set")
        sys.exit(1)

    print(f"==> Reviewing PR #{args.pr} on {args.repo}")

    diff = get_pr_diff(args.repo, args.pr)
    files = get_pr_files(args.repo, args.pr)
    print(f"  {len(files)} files changed, diff size: {len(diff)} chars")

    review = review_with_mistral(diff, files)
    report_path = save_report(review, args.repo, args.pr)
    print(f"  Report saved: {report_path}")

    if args.comment and not args.report_only:
        comment_body = f"## Mistral Security Review\n\n{review}\n\n---\n*Automated review by Mistral. Does not auto-merge.*"
        post_pr_comment(args.repo, args.pr, comment_body)
    else:
        print("  Skipping PR comment (use --comment to post)")

    print("==> Done.")


if __name__ == "__main__":
    main()
