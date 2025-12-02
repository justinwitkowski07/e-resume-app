# Vercel Deployment Guide

This guide will walk you through deploying the Resume Generator app to Vercel step by step.

## Prerequisites

- A GitHub, GitLab, or Bitbucket account (for Git-based deployment)
- OR Vercel CLI installed (for direct deployment)
- An OpenAI API key

## Step-by-Step Deployment

### Option A: Deploy via Vercel Dashboard (Recommended for Beginners)

#### Step 1: Push Your Code to Git

1. **Initialize Git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create a GitHub repository**:
   - Go to [GitHub](https://github.com) and create a new repository
   - Don't initialize it with a README (you already have files)

3. **Push your code**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

#### Step 2: Sign Up / Sign In to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"** or **"Log In"**
3. Sign up with your GitHub/GitLab/Bitbucket account (recommended for easy integration)

#### Step 3: Import Your Project

1. Once logged in, click **"Add New..."** → **"Project"**
2. You'll see a list of your Git repositories
3. Click **"Import"** next to your resume-generator repository
4. If you don't see your repo, click **"Adjust GitHub App Permissions"** and grant access

#### Step 4: Configure Project Settings

1. **Framework Preset**: Vercel should auto-detect "Next.js" - leave it as is
2. **Root Directory**: Leave as `./` (root)
3. **Build Command**: Should be `npm run build` (default)
4. **Output Directory**: Leave empty (Next.js default)
5. **Install Command**: Should be `npm install` (default)

#### Step 5: Set Environment Variables

**⚠️ IMPORTANT: Set these BEFORE deploying!**

Click on **"Environment Variables"** section and add:

1. **OPENAI_API_KEY**
   - Value: Your OpenAI API key (get it from [platform.openai.com](https://platform.openai.com/api-keys))
   - Environment: Select **Production**, **Preview**, and **Development**

2. **OPENAI_MODEL** (Optional)
   - Value: `gpt-5-mini` (or your preferred model)
   - Environment: Select **Production**, **Preview**, and **Development**

3. **NODE_ENV**
   - Value: `production`
   - Environment: **Production only**

#### Step 6: Deploy!

1. Click **"Deploy"** button
2. Wait for the build to complete (usually 2-5 minutes)
3. Once done, you'll see a success message with your deployment URL!

#### Step 7: Test Your Deployment

1. Click on the deployment URL (e.g., `your-app-name.vercel.app`)
2. Test generating a resume
3. Check that everything works correctly

---

### Option B: Deploy via Vercel CLI (For Developers)

#### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

#### Step 2: Login to Vercel

```bash
vercel login
```

This will open a browser window for authentication.

#### Step 3: Set Environment Variables Locally (Optional)

Create a `.env.local` file:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-5-mini
NODE_ENV=production
```

#### Step 4: Deploy

From your project root directory:

```bash
vercel
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your account
- **Link to existing project?** → No (first time) or Yes (subsequent)
- **Project name?** → `resume-generator` (or your preferred name)
- **Directory?** → `./`
- **Override settings?** → No

#### Step 5: Deploy to Production

```bash
vercel --prod
```

---

## Important Configuration Notes

### Function Timeout & Memory

The `vercel.json` file configures:
- **maxDuration**: 60 seconds (maximum for Hobby plan)
- **memory**: 3008 MB (required for Puppeteer/Chromium)

⚠️ **Note**: 
- Hobby plan: Max 60 seconds per function
- Pro plan: Up to 300 seconds available (if needed)

### Environment Variables in Vercel

After deployment, you can update environment variables:
1. Go to your project dashboard
2. Settings → Environment Variables
3. Add/Edit variables
4. Redeploy to apply changes

---

## Troubleshooting

### Issue: "Function execution exceeded timeout"

**Solution**: 
- The resume generation might take longer than 60 seconds
- Optimize your code (already done in optimizations)
- Consider upgrading to Pro plan for longer timeouts

### Issue: "Out of memory" errors

**Solution**:
- The `vercel.json` already sets memory to 3008 MB
- This should be sufficient for Puppeteer
- If issues persist, check the Vercel logs

### Issue: Puppeteer/Chromium not working

**Solution**:
- ✅ The code already uses `@sparticuz/chromium` which is optimized for serverless
- ✅ The code detects Vercel environment automatically
- If issues persist, check that `@sparticuz/chromium` version is compatible

### Issue: Environment variables not working

**Solution**:
1. Make sure variables are set in Vercel dashboard
2. Redeploy after adding variables
3. Check variable names match exactly (case-sensitive)
4. Ensure variables are enabled for the right environments (Production/Preview/Development)

### Issue: Build fails

**Solution**:
1. Check build logs in Vercel dashboard
2. Ensure all dependencies are in `package.json`
3. Try running `npm run build` locally first
4. Check Node version (should be 20.x as specified in package.json)

---

## Post-Deployment Checklist

- [ ] Test resume generation end-to-end
- [ ] Verify PDF downloads correctly
- [ ] Check that all profiles load properly
- [ ] Monitor function execution time in Vercel dashboard
- [ ] Set up monitoring/alerts if needed
- [ ] Consider adding a custom domain (optional)

---

## Updating Your Deployment

### After Code Changes:

**Via Dashboard**:
- Push changes to your Git repository
- Vercel automatically redeploys (if connected)

**Via CLI**:
```bash
git add .
git commit -m "Your changes"
git push
# Or redeploy manually:
vercel --prod
```

---

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Environment Variables Guide](https://vercel.com/docs/concepts/projects/environment-variables)

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check function logs in Vercel dashboard
3. Review error messages in browser console
4. Consult Vercel documentation or community

