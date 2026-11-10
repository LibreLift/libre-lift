# Setup

Supabase provides LibreLift's database and backend services. Start with the shared
hosted development backend below. You only need Docker if you want a private
backend on your computer for testing changes.

**The Expo app is still being built.** These steps configure and check the backend;
app installation and launch instructions will follow when the scaffold merges.

## 1. Get the project

Install [Git](https://git-scm.com/downloads) and [Node.js](https://nodejs.org/en/download)
(version 20 or later, including npm). Open a terminal and run:

```sh
git clone https://github.com/LibreLift/libre-lift.git
cd libre-lift
```

If you already have a checkout, open a terminal in that folder instead. Run all
commands below there. Files mentioned below can be opened in any text editor.

## 2. Configure the hosted connection

Copy `.env.example` to a new file named `.env` in the same folder. In `.env`:

1. Keep the supplied `EXPO_PUBLIC_SUPABASE_URL`.
2. Ask a maintainer for the development project's **publishable key** and replace
   `replace-with-project-publishable-key` with it.

You do not need a Supabase account or dashboard access. Use only the publishable
key; database passwords and secret/service-role keys must never go in app settings.
Git ignores `.env`, so your settings stay on your computer.

## 3. Check the backend

Open this URL in your browser:

<https://jibzcwwursyzvvthazby.supabase.co/functions/v1/health>

You should see `{"status":"ok"}`. This confirms the hosted health function is
reachable; it does not test your app settings or database access. If it fails,
ask a maintainer to check the deployment.

When the app is available, this connection will save test workouts to the shared
development database, just as a normal user would.

## Optional: run your own local backend

Use this when testing backend changes without affecting the shared deployment.
It needs no hosted credentials. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/),
open it, and wait until it reports that its engine is running.

In your project terminal, run:

```sh
npx --yes supabase@3.1.0 start
npx --yes supabase@3.1.0 status
npx --yes supabase@3.1.0 db query --read-only 'select 1 as connected'
```

`npx` downloads and runs our required Supabase CLI version, **3.1.0**. The first
start downloads service images and can take several minutes. The final command
should return `connected: 1`, confirming the local database works.

To point the app at this backend, change **both** values in `.env`: set the URL
to `http://127.0.0.1:54321` and use the local publishable key shown by `status`.
For an Android emulator, use `http://10.0.2.2:54321`; for a physical phone, use
your computer's LAN IP instead of `127.0.0.1`, on the same trusted network.
Restart Expo after changing these values once the app is available.

To check the local health function, run this in a second terminal in the project:

```sh
npx --yes supabase@3.1.0 functions serve health
```

Open <http://127.0.0.1:54321/functions/v1/health> in your browser. Expect
`{"status":"ok"}`. Local database browsing is at <http://127.0.0.1:54323>;
local test emails appear at <http://127.0.0.1:54324>.

When finished, press Ctrl-C in the function terminal, then stop the backend:

```sh
npx --yes supabase@3.1.0 stop
```

Stopping preserves local data. If startup cannot connect to Docker, check that
Docker Desktop is running (`docker info`). If ports are busy, stop any other
local Supabase stack first. Keep local services on a trusted network.

For backend contributions, see the [local migration workflow](../supabase/migrations/README.md).
Hosted administration and deployments are covered in the [maintainer guide](maintainers.md).
