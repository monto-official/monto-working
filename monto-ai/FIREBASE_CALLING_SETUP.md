# Firebase call signaling setup

Monto uses Firebase only for call signaling and presence. Voice media remains encrypted WebRTC traffic between the devices or through the configured TURN relay.

1. In Firebase Console, create/select a project and add a Web app.
2. Authentication > Sign-in method: enable Anonymous.
3. Realtime Database: create a database in the region nearest users.
4. Publish `firebase-database.rules.json` as the Realtime Database rules.
5. Put these values in both `frontend/.env` and `parent-app/.env`:

   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://...-default-rtdb.firebaseio.com

6. Rebuild both web apps/APKs. Both devices must use the same Firebase project and the same pairing room/device ID.
7. Keep TURN configured for calls across mobile data, strict NAT, or isolated Wi-Fi. Firebase replaces signaling only; it does not relay audio.

If either Firebase variable is absent, both apps intentionally use the existing HTTP/Supabase signaling fallback.
