
# Development Deployment Guide

## Frontend Testing

### 1. Expo Go (Google Translate Online - Development Only)
```bash
npx expo start
# Scan QR code with Expo Go app
# Tests Google Translate online service for development
# Note: Online service is NEVER used in production
```

### 2. Development Client (ML Kit)
```bash
# One-time setup
npx expo prebuild

# Build development client
eas build --profile development --platform ios
# Install the built .ipa on your device

# Start development server
npx expo start --dev-client
# Open the dev client app
```

## Testing Checklist

### Google Translate Service (Expo Go - Development Only)
- [ ] Translation service loads correctly
- [ ] Google Translate API works
- [ ] Performance test shows ~150ms average
- [ ] Fallback to mock works if API fails
- [ ] Online service disabled in production builds

### ML Kit Service (Dev Client)
- [ ] ML Kit native module detected
- [ ] Models download successfully
- [ ] Translation works offline
- [ ] Performance test shows ~50-100ms average

### Dictionary Services
- [ ] SQLite dictionaries load
- [ ] Word lookup works
- [ ] Language packs initialize
- [ ] User language profiles work

### UI Integration
- [ ] Settings screen loads all test options
- [ ] Translation test screens accessible
- [ ] Reader screen word tapping works
- [ ] Language switcher functions

## Debugging

### Common Issues
1. **ML Kit not available**: Ensure using dev client, not Expo Go
2. **Translation fails**: Check network for Google Translate, model download for ML Kit
3. **Dictionary lookup fails**: Verify SQLite files in assets/dictionaries/
4. **Build fails**: Check EAS configuration and native module setup
5. **Online service in production**: Google Translate is development-only, production uses ML Kit

### Debug Tools
- Console logs for translation services
- Performance harness for speed testing
- ML Kit test screen for model verification
- Network tab for online service debugging
