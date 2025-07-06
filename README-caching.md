# Certificate Caching System

## Overview

The certificate caching system is designed to improve performance by storing generated certificate images and reusing them when possible. This reduces the expensive image generation process and improves response times for certificate preview and download operations.

## Features

### 🚀 **Performance Optimization**
- **Cache-First Strategy**: Always checks cache before generating new certificates
- **Intelligent Cache Keys**: Based on certificate ID, template version, and certificate data
- **Fast Cache Lookup**: Uses file-based caching with metadata tracking

### 🧹 **Automatic Cache Management**
- **Size Limits**: 100MB cache size limit (configurable)
- **Age-Based Expiration**: 7-day cache expiration (configurable)
- **LRU Eviction**: Removes least recently used items when cache is full
- **Startup Cleanup**: Automatically cleans cache on service startup

### 🔄 **Smart Cache Invalidation**
- **Template Updates**: Invalidates cache when templates are modified
- **Field Changes**: Invalidates cache when certificate fields are updated
- **Certificate Deletion**: Removes cache files when certificates are deleted
- **Bulk Operations**: Handles bulk field updates efficiently

### 📊 **Monitoring & Administration**
- **Cache Status Endpoint**: `/api/certificates/admin/cache/status` (Admin only)
- **Manual Cleanup**: `/api/certificates/admin/cache/cleanup` (Admin only)
- **Performance Logging**: Cache hit/miss logging with size information

## Technical Implementation

### Cache Storage Structure
```
backend/certificate-cache/
├── cert-{id}-{template-version}-{cert-version}.png     # Cached certificate image
├── cert-{id}-{template-version}-{cert-version}.meta.json # Cache metadata
└── ...
```

### Cache Metadata
Each cached item includes:
- `cacheKey`: Unique identifier for the cached item
- `createdAt`: When the item was cached
- `lastAccessedAt`: When the item was last accessed
- `accessCount`: Number of times the item has been accessed
- `fileSize`: Size of the cached file in bytes

### Cache Key Generation
Cache keys are generated using:
- Certificate ID
- Template last modified timestamp
- Certificate last modified timestamp

This ensures automatic cache invalidation when any relevant data changes.

## Configuration

### Cache Settings (in `certificateService.js`)
```javascript
this.maxCacheSize = 100 * 1024 * 1024; // 100MB
this.maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days
```

### Cache Directory
```javascript
this.cacheDir = path.join(__dirname, '../certificate-cache');
```

## Usage

### Automatic Caching
The caching system works automatically for:
- Certificate preview requests (`/api/certificates/:id/preview`)
- Certificate download requests (`/api/certificates/:id/download`)
- Certificate generation during award creation

### Manual Cache Management
Administrators can:
- Check cache status: `GET /api/certificates/admin/cache/status`
- Force cleanup: `POST /api/certificates/admin/cache/cleanup`

### Cache Status Response
```json
{
  "totalFiles": 45,
  "totalSize": 15728640,
  "totalSizeMB": "15.00",
  "oldestFile": {
    "cacheKey": "cert-abc123-1625097600000-1625097600000",
    "createdAt": "2025-07-01T10:00:00.000Z",
    "lastAccessedAt": "2025-07-06T15:30:00.000Z",
    "accessCount": 12
  },
  "newestFile": {
    "cacheKey": "cert-def456-1625184000000-1625184000000",
    "createdAt": "2025-07-06T20:00:00.000Z",
    "lastAccessedAt": "2025-07-06T20:00:00.000Z",
    "accessCount": 1
  }
}
```

## Performance Benefits

### Before Caching
- Every certificate request required full image generation
- Canvas operations and image processing on every request
- Slow response times for certificate preview/download

### After Caching
- ⚡ **Instant Response**: Cache hits return immediately
- 🔄 **Reduced CPU Usage**: No redundant image generation
- 📈 **Better UX**: Faster preview and download times
- 🏗️ **Scalable**: Handles multiple concurrent requests efficiently

## Error Handling

The caching system includes robust error handling:
- **Cache Miss**: Falls back to direct generation
- **Cache Write Errors**: Logs errors but doesn't fail the request
- **Cache Cleanup Errors**: Logs errors but continues operation
- **Invalid Cache Data**: Automatically removes corrupted cache files

## Best Practices

1. **Regular Monitoring**: Check cache status periodically
2. **Disk Space**: Monitor available disk space for cache directory
3. **Cache Cleanup**: Let automatic cleanup handle most cases
4. **Manual Cleanup**: Use manual cleanup during maintenance windows
5. **Performance Testing**: Monitor cache hit rates and response times

## Logging

The system provides detailed logging:
- `💾 Cache HIT for {key}` - Successful cache retrieval
- `💾 Cache MISS for {key}, generating certificate...` - Cache miss, generating new
- `💾 Cache STORED for {key} ({size}KB)` - Successfully cached new certificate
- `🗑️ Invalidated cache for {count} certificates` - Cache invalidation events
- `💾 Cache status: {count} items, {size}MB` - Cache status during cleanup

## Future Enhancements

- **Redis Integration**: For distributed caching across multiple instances
- **Compression**: Compress cached images to save space
- **Prefetching**: Pre-generate certificates for better performance
- **Analytics**: Track cache hit rates and performance metrics
- **CDN Integration**: Store cached certificates in CDN for global distribution 