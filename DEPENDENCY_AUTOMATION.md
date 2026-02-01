# Dependency Automation Guide

This guide explains how to set up automated dependency updates using free tools.

## 🆓 Free Tools Available

Both **Dependabot** and **Renovate** are **100% FREE** for:
- ✅ Public repositories
- ✅ Private repositories
- ✅ Personal accounts
- ✅ Organization accounts

### Dependabot (GitHub Native)

**Pricing:** FREE for all GitHub repositories

**Features:**
- Built into GitHub (no installation needed)
- Automatic security updates
- Version update PRs
- Free for unlimited repositories

**Setup:** Just create `.github/dependabot.yml` (already created!)

### Renovate Bot

**Pricing:** FREE (open source, self-hosted or GitHub App)

**Features:**
- More flexible configuration
- Better grouping options
- Dependency dashboard
- Free GitHub App available

**Setup:** Install Renovate GitHub App (free)

## 🚀 Quick Setup

### Option 1: Dependabot (Recommended - Easiest)

Dependabot is already configured! Just push the `.github/dependabot.yml` file:

```bash
git add .github/dependabot.yml
git commit -m "chore: add Dependabot configuration"
git push
```

**That's it!** Dependabot will:
- Start checking for updates automatically
- Create PRs for security updates immediately
- Create PRs for version updates weekly (Mondays at 9 AM)
- Group related updates together

### Option 2: Renovate Bot

1. **Install Renovate GitHub App:**
   - Go to: https://github.com/apps/renovate
   - Click "Install"
   - Select your repository
   - Grant permissions

2. **Configuration:**
   - Renovate will use `renovate.json` (already created!)
   - Or create `renovate.json` in your repo root

3. **First Run:**
   - Renovate will create an onboarding PR
   - Merge it to activate

## 📊 Comparison

| Feature | Dependabot | Renovate |
|---------|-----------|----------|
| **Price** | FREE | FREE |
| **Setup** | Just add config file | Install GitHub App |
| **Security Updates** | ✅ Immediate | ✅ Immediate |
| **Grouping** | ✅ Basic | ✅ Advanced |
| **Dashboard** | ❌ | ✅ Yes |
| **Custom Rules** | ✅ Good | ✅ Excellent |
| **Auto-merge** | ✅ Via settings | ✅ Via config |
| **pnpm Support** | ✅ Yes | ✅ Yes |

## 🎯 Recommended: Use Dependabot

**Why Dependabot?**
- ✅ Zero setup (just push config file)
- ✅ Built into GitHub
- ✅ No external services
- ✅ Free forever
- ✅ Perfect for most projects

**When to use Renovate?**
- Need advanced grouping
- Want dependency dashboard
- Need complex custom rules
- Prefer more control

## 📝 Current Configuration

### Dependabot Settings

- **Schedule:** Weekly (Mondays at 9 AM)
- **Limit:** 10 open PRs max
- **Grouping:** 
  - Production dependencies (patch/minor)
  - Dev dependencies (patch/minor)
- **Auto-merge:** Disabled (review manually)
- **Security:** Immediate PRs

### What Gets Updated

**Automatic Updates (Weekly):**
- ✅ Patch versions (1.0.0 → 1.0.1)
- ✅ Minor versions (1.0.0 → 1.1.0)
- ✅ Security patches (immediate)

**Manual Review Required:**
- ⚠️ Major versions (1.0.0 → 2.0.0)
- ⚠️ Prisma updates (require migration)
- ⚠️ Next.js major updates
- ⚠️ React major updates

## 🔧 Customization

### Enable Auto-Merge (Optional)

If you want to auto-merge patch updates:

**Dependabot:**
1. Go to repository Settings → Code security and analysis
2. Enable "Allow auto-merge" for Dependabot

**Renovate:**
Edit `renovate.json`:
```json
{
  "packageRules": [
    {
      "matchUpdateTypes": ["patch"],
      "automerge": true
    }
  ]
}
```

### Change Update Schedule

**Dependabot:**
Edit `.github/dependabot.yml`:
```yaml
schedule:
  interval: "daily"  # or "weekly", "monthly"
```

**Renovate:**
Edit `renovate.json`:
```json
{
  "schedule": ["before 10am on monday", "before 10am on thursday"]
}
```

## 📈 What to Expect

### First Week

- Dependabot/Renovate will scan your dependencies
- Create PRs for outdated packages
- Group related updates together

### Ongoing

- **Weekly:** New PRs for version updates
- **Immediately:** PRs for security vulnerabilities
- **Dashboard:** Track all updates (Renovate only)

### PR Format

Each PR will include:
- ✅ What changed
- ✅ Changelog links
- ✅ Breaking changes (if any)
- ✅ CI/CD status

## 🛡️ Security Benefits

### Automatic Security Updates

Both tools will:
- ✅ Detect known vulnerabilities
- ✅ Create PRs immediately
- ✅ Test updates automatically
- ✅ Notify you of critical issues

### Example Security PR

```
🔒 Security: Update next to 16.1.7
Fixes: CVE-2025-XXXXX (High severity)
```

## 📚 Resources

- **Dependabot Docs:** https://docs.github.com/en/code-security/dependabot
- **Renovate Docs:** https://docs.renovatebot.com/
- **Dependabot Config:** `.github/dependabot.yml`
- **Renovate Config:** `renovate.json`

## ✅ Checklist

- [x] Dependabot config created (`.github/dependabot.yml`)
- [x] Renovate config created (`renovate.json`)
- [ ] Push config files to GitHub
- [ ] (Optional) Install Renovate GitHub App
- [ ] Review first batch of PRs
- [ ] Set up auto-merge if desired
- [ ] Monitor security updates

## 🎉 Next Steps

1. **Push the config files:**
   ```bash
   git add .github/dependabot.yml renovate.json
   git commit -m "chore: add dependency automation configs"
   git push
   ```

2. **Wait for first PRs:**
   - Dependabot will start automatically
   - Check your PRs in a few hours

3. **Review and merge:**
   - Review security updates first
   - Test version updates
   - Merge when ready

---

**Both tools are completely FREE and will help keep your dependencies secure and up-to-date!** 🚀
