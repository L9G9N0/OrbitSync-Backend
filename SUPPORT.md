# Support Guide: BlackHole Cloud Storage Engine 🌌

This document details where to find help, report issues, and resolve common problems encountered when configuring or using the BlackHole platform.

---

## 1. Troubleshooting Common Problems

Please review our [Production Deployment Guide](DEPLOYMENT.md#5-troubleshooting--diagnostics) for detailed fixes regarding:
* **Vercel DNS Connection Timeouts**: Fixes for local DNS servers blocking Vercel Anycast.
* **Supabase Email Rate Limits**: Workarounds for disabled email verifications.
* **Invalid Email Formats**: TLD validators blocking custom/test email domains.

---

## 2. Common Integration Questions

### Q: Why is my dashboard showing "Vault connection failed"?
* **Cause**: The frontend cannot connect to the backend, or the backend is crashing.
* **Solution**: Inspect your browser console or Render dashboard logs. If the backend logs show database or storage errors, verify that `SUPABASE_URL`, `SUPABASE_KEY`, and storage credentials in your `.env` settings are configured and do not contain placeholders.

### Q: Why does uploading a file return a 405 Method Not Allowed?
* **Cause**: Route precedence bug. If Uvicorn handles requests to `/files/status` using the `/files/{file_id}` DELETE route, it rejects GET methods.
* **Solution**: Ensure your backend matches version `[1.1.0]` (Commit `09ebb31` or later), which swaps routing declaration order in `app/api.py`.

---

## 3. Contact & Support Channels

* **GitHub Issues**: Report bug requests, file UI bugs, or request features in the repository issues tracker.
* **Community Discussions**: Ask questions or show off your implementations on the GitHub Discussions tab.
