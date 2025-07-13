# Backend Scripts

This directory contains utility scripts for maintaining the application.

## Template Management

### cleanup-templates.js

This script helps maintain certificate templates by:

- Checking for orphaned template files (files without database records)
- Identifying templates with missing files
- Automatically marking templates with missing files as inactive
- Providing a summary of template health

**Usage:**
```bash
node backend/scripts/cleanup-templates.js
```

**When to use:**
- After deployments or server migrations
- When experiencing "Template image file not found" errors
- For regular maintenance to keep templates synchronized

**What it does:**
1. Scans the `uploads/certificate-templates/` directory for files
2. Compares with database records
3. Reports orphaned files and missing files
4. Automatically fixes database inconsistencies by marking broken templates as inactive

This helps resolve the common issue where template files get deleted or moved but database records remain, causing "Template image file not found" errors in the certificate designer. 