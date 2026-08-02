# HostGator deployment notes

## Frontend
1. Run:
   - npx expo export --platform web
2. Upload the contents of the dist folder to your HostGator public_html directory.
3. Ensure index.html is the entry file.

## Backend
The backend is a Node/Express app and should be hosted separately (Render, Railway, Fly.io, VPS, etc.).

## Production API URL
Set the frontend API base URL with:
- EXPO_PUBLIC_API_BASE_URL=https://your-backend-domain.com

If you are using a local preview build, the default still points to http://localhost:3001.
