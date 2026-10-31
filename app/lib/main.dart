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
    await Supabase.initialize(
      url: Env.supabaseUrl,
      publishableKey: Env.supabaseKey,
    );
    // Real data needs a signed-in user (RLS). Until there's a login screen,
    // fall back to mock data when nobody is signed in.
    if (Supabase.instance.client.auth.currentUser != null) {
      repository = SupabaseRepository();
    }
  }

  runApp(PagoDirectoApp(repository: repository));
}
