# logs.munagalakarthik.com — Blog Infrastructure & Setup Guide

> **Personal Blog** · Built on AWS · Hugo static site · Auto-deployed via GitHub Actions

---

## Overview

A fully serverless personal blog on a subdomain of munagalakarthik.com. Same AWS stack as the portfolio — zero servers, near-zero cost.

```
Domain          → AWS Route 53          (shared with portfolio)
DNS Hosted Zone → AWS Route 53          (shared with portfolio)
File Storage    → AWS S3                (free tier)
CDN + HTTPS     → AWS CloudFront        (free tier)
SSL Certificate → AWS ACM               (free)
Blog Engine     → Hugo (static)         (free)
CI/CD           → GitHub Actions        (free)
──────────────────────────────────────────────
Total Cost      →                       ~$0/year (infra shared)
```

---

## Tech Stack

- **Hugo** — static site generator, markdown-based posts
- **Theme** — [panr/hugo-theme-terminal](https://github.com/panr/hugo-theme-terminal) (green terminal aesthetic)
- **Hosting** — S3 + CloudFront (same pattern as munagalakarthik.com)
- **CI/CD** — GitHub Actions: push to main → Hugo build → S3 sync → CloudFront invalidation

---

## File Structure

```
logs/
├── .github/
│   └── workflows/
│       └── deploy.yml      ← builds Hugo + deploys to AWS on git push
├── archetypes/
│   └── default.md          ← template for new posts
├── content/
│   ├── about.md            ← about page
│   └── posts/              ← blog posts go here (one .md file per post)
├── themes/
│   └── terminal/           ← git submodule: panr/hugo-theme-terminal
├── .gitignore
├── .gitmodules
├── hugo.toml               ← Hugo + theme config
├── myreadme.md             ← PRIVATE: credentials & IDs (gitignored)
└── readme.md               ← this file
```

---

## Writing a Post

```bash
# Option A — Hugo CLI (auto-generates frontmatter)
hugo new posts/my-post-title.md

# Option B — Manually create file in content/posts/
# Copy archetypes/default.md and rename
```

Frontmatter template:

```markdown
---
title: "My Post Title"
date: 2026-04-14
draft: false
tags: ["aws", "iam", "security"]
cover: ""
---

Post content here...
```

Set `draft: false` to publish. Deploy with `git push origin main`.

---

## Step 1 — Create S3 Bucket

1. S3 → **Create bucket**
   - Name: `logs.munagalakarthik.com`
   - Region: **us-east-1**
   - Uncheck **Block all public access** → confirm
2. **Properties** → Static website hosting → Enable
   - Index document: `index.html`
   - Error document: `404.html`
3. **Permissions** → Bucket policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::logs.munagalakarthik.com/*"
  }]
}
```

---

## Step 2 — SSL Certificate (ACM)

> Option A — Add `logs.munagalakarthik.com` to your existing ACM cert (edit → add domain name)
> Option B — Request a new cert for `logs.munagalakarthik.com` only

Must be in **us-east-1**.

1. ACM (us-east-1) → Request / Edit certificate
2. Add: `logs.munagalakarthik.com`
3. DNS validation → **Create records in Route 53** → wait for Issued

---

## Step 3 — Create CloudFront Distribution

1. CloudFront → **Create distribution**

| Setting | Value |
|---------|-------|
| Origin domain | `logs.munagalakarthik.com.s3.amazonaws.com` |
| Viewer protocol | Redirect HTTP to HTTPS |
| Alternate CNAMEs | `logs.munagalakarthik.com` |
| Custom SSL cert | ACM cert from Step 2 |
| Default root object | `index.html` |

2. Create → wait 5–15 min → copy **Distribution ID**

Custom error pages (two rules):

| HTTP Code | Response page | Return code |
|-----------|--------------|-------------|
| 403 | `/404.html` | 404 |
| 404 | `/404.html` | 404 |

---

## Step 4 — Route 53 DNS Record

Route 53 → Hosted zones → `munagalakarthik.com` → **Create record**:

| Field | Value |
|-------|-------|
| Name | `logs` |
| Type | A |
| Alias | ON |
| Route to | Alias to CloudFront distribution → select new one |

DNS propagates 5–60 min → test `https://logs.munagalakarthik.com`

---

## Step 5 — GitHub Actions Setup

### Update IAM OIDC Role

IAM → Roles → `github-actions-*` → Trust policy → update condition to include new repo:

```json
"repo:Karthi-blip/logs.munagalakarthik.com:ref:refs/heads/main"
```

Or create a new OIDC role specifically for this repo.

### GitHub Secrets

New repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | IAM Role ARN |
| `S3_BUCKET_NAME` | `logs.munagalakarthik.com` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Distribution ID from Step 3 |

### Add Theme Submodule

```bash
git submodule add https://github.com/panr/hugo-theme-terminal.git themes/terminal
git commit -m "add terminal theme submodule"
git push origin main
# GitHub Actions builds + deploys automatically
```

---

## Full Setup Checklist

```
[ ] S3 bucket: logs.munagalakarthik.com (us-east-1) + static hosting + policy
[ ] ACM cert covers logs.munagalakarthik.com (us-east-1)
[ ] CloudFront distribution created + custom error pages
[ ] Route 53 A record: logs → CloudFront
[ ] https://logs.munagalakarthik.com loads ✅
[ ] IAM OIDC role allows Karthi-blip/logs.munagalakarthik.com
[ ] GitHub Actions secrets added (3 secrets)
[ ] Theme submodule added + first push deploys ✅
[ ] Google Search Console: add logs.munagalakarthik.com property
[ ] Submit sitemap: https://logs.munagalakarthik.com/sitemap.xml
```

---

## Deploy Flow

```bash
# Write a new post
hugo new posts/my-post.md
# Edit content/posts/my-post.md — set draft: false when ready

# Deploy
git add .
git commit -m "add: my post title"
git push origin main
# ✅ Builds + deploys in ~60 seconds
```

---

*Built on AWS · Hugo static site · Terminal theme*
