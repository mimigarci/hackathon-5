import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../data/repository.dart';
import '../screens/login_screen.dart';
import '../screens/main_shell.dart';

/// Login screen until the user taps "Ingresar", then the app on mock data.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _signedIn = false;

  @override
  Widget build(BuildContext context) {
    if (!_signedIn) {
      return LoginScreen(onEnter: () => setState(() => _signedIn = true));
    }
    return SignedInScope(
      repository: MockRepository(),
      onSignOut: () async => setState(() => _signedIn = false),
      child: const MainShell(),
    );
  }
}

/// Per-user app data (AppScope), loaded once per sign-in.
class SignedInScope extends StatefulWidget {
  const SignedInScope({
    super.key,
    required this.repository,
    required this.child,
    this.onSignOut,
  });

  final AppRepository repository;
  final Future<void> Function()? onSignOut;
  final Widget child;

  @override
  State<SignedInScope> createState() => _SignedInScopeState();
}

class _SignedInScopeState extends State<SignedInScope> {
  late final _state = AppState(widget.repository, onSignOut: widget.onSignOut)..load();

  @override
  void dispose() {
    _state.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AppScope(state: _state, child: widget.child);
}
