import 'package:flutter/material.dart';

import 'auth/auth_gate.dart';
import 'data/repository.dart';
import 'screens/main_shell.dart';
import 'theme/app_theme.dart';

class PagoDirectoApp extends StatelessWidget {
  const PagoDirectoApp({
    super.key,
    this.repository,
    this.useGoogleFonts = true,
  });

  /// Skips the login and opens the app on this data (tests, previews).
  final AppRepository? repository;
  final bool useGoogleFonts;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PagoDirecto',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(useGoogleFonts: useGoogleFonts),
      home: repository != null
          ? SignedInScope(repository: repository!, child: const MainShell())
          : const AuthGate(),
    );
  }
}
