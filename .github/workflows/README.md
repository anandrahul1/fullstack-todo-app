# CI/CD Workflows

This directory contains GitHub Actions workflows for the fullstack todo app.

## Active Workflows

### 1. Debug CI (`debug-ci.yml`)
- **Status**: ✅ Working
- **Purpose**: Debugging and testing individual components
- **Triggers**: Manual dispatch, push to main
- **Use**: For troubleshooting CI issues

### 2. Minimal CI (`minimal-ci.yml`)
- **Status**: 🧪 Testing
- **Purpose**: Simplified CI pipeline for reliable testing
- **Triggers**: Push/PR to main
- **Use**: Primary CI pipeline

## Workflow Status

- ✅ **Debug CI**: Passes - used for troubleshooting
- 🧪 **Minimal CI**: Testing - simplified reliable pipeline
- ❌ **Other workflows**: Disabled or failing - kept for reference

## Troubleshooting

If CI fails:
1. Check the Debug CI workflow first
2. Compare with working Minimal CI
3. Ensure all test directories exist
4. Verify server health endpoint works
5. Check package.json scripts are correct

## Key Fixes Applied

1. **Server Health Checks**: Added `/health` endpoint testing
2. **Proper Cleanup**: Server process management with PID tracking
3. **Directory Creation**: Ensure `data/` directory exists
4. **Non-blocking Security**: Security audit warnings don't fail CI
5. **Test Script Fixes**: Corrected package.json test paths
