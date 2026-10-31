import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'config/env.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  var supabaseReady = false;
  if (Env.hasSupabase) {
    // A bad URL/key must not stop runApp (that leaves a blank page on web);
    // without Supabase the login enters demo mode with mock data.
    try {
      await Supabase.initialize(
        url: Env.supabaseUrl.trim(),
        publishableKey: Env.supabaseKey.trim(),
      );
      supabaseReady = true;
    } catch (e) {
      debugPrint('Supabase init failed, using demo mode: $e');
    }
  }

  runApp(PagoDirectoApp(supabaseReady: supabaseReady));
}
