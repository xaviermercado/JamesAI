# HostGator deployment notes

## Frontend
1. Run:
   - npx expo export --platform web
2. Upload the contents of the dist folder to your HostGator public_html directory.
3. Ensure index.html is the entry file.
4. Upload the generated `.htaccess` file from the dist folder as well so clean routes like `/login`, `/verify-email`, and `/profile/edit` rewrite to their exported `.html` files.

## Backend
The backend is a Node/Express app and should be hosted separately (Render, Railway, Fly.io, VPS, etc.).

## Production API URL
Set the frontend API base URL with:
- EXPO_PUBLIC_API_BASE_URL=https://your-backend-domain.com
- EXPO_PUBLIC_GOOGLE_ANALYTICS_ID=G-XBKN44PS5L

If you are using a local preview build, the default still points to http://localhost:3001.
