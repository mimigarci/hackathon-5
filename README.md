# hackathon-5

PagoDirecto-style wallet app. Flutter (Dart) frontend, Supabase backend.

```
app/        Flutter app (Android, iOS, web)
supabase/   SQL schema, RLS policies and seed data
```

## Run the app

```bash
cd app
flutter pub get
flutter run                 # phone/emulator connected
flutter run -d chrome       # or in the browser
```

With no config it runs on **mock data** (`lib/data/mock_data.dart`) that matches
the reference screens. Set `MockData.showSampleData = true` to see filled lists.

## Connect Supabase

1. In the Supabase SQL Editor, run `supabase/schema.sql`.
2. Copy `app/env.example.json` to `app/env.json` (git-ignored) and fill in the
   project URL and publishable/anon key. Never the service_role key.
3. `flutter run --dart-define-from-file=env.json`

The app switches to `SupabaseRepository` once a user is signed in (RLS scopes
every query to that user). There's no login screen yet, so until one is added
it stays on mock data.

## Where things live

| Path | What |
| --- | --- |
| `lib/screens/main_shell.dart` | Bottom nav tabs + mascot (mood per tab, sleeps when idle) |
| `lib/screens/home_screen.dart` | Wallet cards, Club, Mis pagos, Funciones, Sugerencias |
| `lib/screens/movements_screen.dart` | Movimientos with Todos/Ingresos/Egresos + period filter |
| `lib/screens/payments_screen.dart` | Mis pagos: Pendientes / Programados / Pagados |
| `lib/screens/assistant_screen.dart` | Chat opened from the mascot |
| `lib/data/assistant_service.dart` | Stub reply. Plug your backend/LLM in here |
| `lib/screens/placeholder_screen.dart` | "Próximamente" page every unbuilt button opens |
| `lib/data/repository.dart` | Data interface + mock implementation |
| `lib/data/supabase_repository.dart` | Supabase implementation |
