# Authentication Setup Guide

This project now includes simple username/password authentication for secure access.

## Local Development

The authentication credentials are stored in `.env.local`:

```
VITE_AUTH_USERNAME=admin
VITE_AUTH_PASSWORD=forecast2025
```

## Production Deployment (Vercel)

For production deployment, you need to set these environment variables in your Vercel dashboard:

### Setting Environment Variables in Vercel:

1. **Go to your Vercel Dashboard**
   - Navigate to your project: https://vercel.com/dashboard
   - Select the "display-forecaster" project

2. **Add Environment Variables**
   - Go to Settings → Environment Variables
   - Add the following variables:

   ```
   Name: VITE_AUTH_USERNAME
   Value: [your-chosen-username]
   
   Name: VITE_AUTH_PASSWORD
   Value: [your-chosen-password]
   ```

3. **Redeploy**
   - After adding the environment variables, redeploy the project
   - The authentication will be active on your next deployment

## Security Features

- **Session Persistence**: Users stay logged in for 24 hours
- **Secure Credentials**: Environment variables are not exposed to client
- **Professional UI**: Clean login page matching app design
- **Easy Logout**: Sign out button in main header

## How It Works

1. **First Visit**: Users see a professional login page
2. **Authentication**: Enter username/password to access dashboard
3. **Session Management**: Credentials stored securely in localStorage
4. **Auto-Logout**: Sessions expire after 24 hours
5. **Easy Access**: Sign out button available in header

## Default Credentials (Change These!)

- **Username**: `admin`
- **Password**: `forecast2025`

**IMPORTANT**: Change these default credentials before deploying to production!

## User Experience

- **Login Page**: Professional design with company branding
- **Loading States**: Smooth transitions and feedback
- **Error Handling**: Clear messages for invalid credentials
- **Responsive Design**: Works on all device sizes

## Benefits

✅ **Simple Setup** - No external OAuth configuration needed  
✅ **Secure** - Environment variables protect credentials  
✅ **Professional** - Clean UI integrated with existing design  
✅ **Flexible** - Easy to change credentials anytime  
✅ **Internal Use** - Perfect security level for business tools