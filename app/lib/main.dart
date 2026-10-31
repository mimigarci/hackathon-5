import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'config/env.dart';
import 'data/repository.dart';
import 'data/supabase_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  AppRepository repository = MockRepository();
  if (Env.hasSupabase) {
    // A bad URL/key must not stop runApp (that leaves a blank page on web).
    try {
      await Supabase.initialize(
        url: Env.supabaseUrl.trim(),
        publishableKey: Env.supabaseKey.trim(),
      );
      // Real data needs a signed-in user (RLS). Until there's a login screen,
      // fall back to mock data when nobody is signed in.
      if (Supabase.instance.client.auth.currentUser != null) {
        repository = SupabaseRepository();
      }
    } catch (e) {
      debugPrint('Supabase init failed, using mock data: $e');
    }
  }

  runApp(PagoDirectoApp(repository: repository));
}
