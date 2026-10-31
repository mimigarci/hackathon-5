/// Values injected at build time with `--dart-define-from-file=env.json`.
/// See env.example.json.
class Env {
  Env._();

  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');

  /// Publishable key (sb_publishable_...) or the legacy anon key. Never the
  /// secret/service_role key: this ships inside the app.
  static const supabaseKey = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');

  static bool get hasSupabase =>
      supabaseUrl.isNotEmpty && supabaseKey.isNotEmpty;
}
