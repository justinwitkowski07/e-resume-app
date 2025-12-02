# Quick Deploy Checklist - Vercel

## 🚀 Fast Track Deployment (5 minutes)

### Pre-Flight Check
- [ ] Code is pushed to GitHub/GitLab/Bitbucket
- [ ] OpenAI API key ready
- [ ] Vercel account created

### Steps

1. **Go to [vercel.com](https://vercel.com) → Login**

2. **Click "Add New..." → "Project"**

3. **Import your repository**

4. **Configure** (usually auto-detected):
   - Framework: Next.js
   - Root: `./`
   - Build: `npm run build`

5. **⚠️ CRITICAL: Add Environment Variables**
   ```
   OPENAI_API_KEY = your_key_here
   OPENAI_MODEL = gpt-5-mini (optional)
   ```

6. **Click "Deploy"** 🎉

7. **Wait 2-5 minutes** → Your app is live!

---

## 📝 After Deployment

- Test: Visit your `app-name.vercel.app` URL
- Monitor: Check Functions tab for execution time
- Update: Push to Git = Auto redeploy

---

## ⚠️ Important Notes

- **Function Timeout**: 60 seconds (Hobby) / 300 seconds (Pro)
- **Memory**: Configured for Puppeteer in `vercel.json`
- **Environment**: Auto-detects Vercel (already in code)

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Timeout | Code is optimized, but 60s limit on Hobby plan |
| Memory | Already configured to 3008 MB in vercel.json |
| Puppeteer | ✅ Already uses @sparticuz/chromium (serverless-ready) |

---

**Need help?** See `DEPLOYMENT.md` for detailed guide.

