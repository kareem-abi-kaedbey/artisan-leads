This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Admin access

The existing `src/lib/supabase-server.ts` remains the trusted database/storage client
using `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. It is never used to authenticate a
browser session.

Authentication uses `@supabase/ssr`, `NEXT_PUBLIC_SUPABASE_URL`, and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Set `ADMIN_USER_ID` to the existing admin's
Supabase Auth user UUID on the server. These three variables are required alongside
the existing backend configuration. Never prefix `ADMIN_USER_ID` or the secret key
with `NEXT_PUBLIC_`.

Visit `/login` to sign in with the existing admin account. There is no signup flow.
Disable **Allow new users to sign up** in Supabase Auth's settings if it is enabled;
this repository does not change the hosted project's Auth configuration.

`src/proxy.ts` refreshes session cookies only for login, dashboard, and lead-detail
API requests. The dashboard layout verifies admin access. Both existing dashboard
pages also verify before querying privileged data, since layouts and pages can
render in parallel. Future dashboard pages that load privileged data should call
`requireAdmin()` before their queries as well. The PATCH endpoint independently
checks the verified user and returns 401 or 403 before doing any database work.
Public quote submissions (`POST /api/leads`) remain public.

Logout in the dashboard clears the current session and returns to `/login`.

Run the isolated authorization checks with:

```bash
node --test tests/admin-auth.test.mjs
```
