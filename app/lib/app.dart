import 'package:flutter/material.dart';

import 'data/app_state.dart';
import 'data/repository.dart';
import 'screens/main_shell.dart';
import 'theme/app_theme.dart';

class PagoDirectoApp extends StatefulWidget {
  const PagoDirectoApp({
    super.key,
    required this.repository,
    this.useGoogleFonts = true,
  });

  final AppRepository repository;
  final bool useGoogleFonts;

  @override
  State<PagoDirectoApp> createState() => _PagoDirectoAppState();
}

class _PagoDirectoAppState extends State<PagoDirectoApp> {
  late final _state = AppState(widget.repository)..load();

  @override
  void dispose() {
    _state.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: _state,
      child: MaterialApp(
        title: 'PagoDirecto',
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(useGoogleFonts: widget.useGoogleFonts),
        home: const MainShell(),
      ),
    );
  }
}
