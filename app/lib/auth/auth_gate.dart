import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/app_state.dart';
import '../data/repository.dart';
import '../data/supabase_repository.dart';
import '../screens/login_screen.dart';
import '../screens/main_shell.dart';

/// Where Google sends the user back after sign-in on Android/iOS. It must be
/// registered in AndroidManifest.xml / Info.plist and in Supabase →
/// Authentication → URL Configuration → Redirect URLs.
const mobileAuthRedirect = 'io.pagodirecto.app://login-callback';

/// Login screen until there's a session, then the app for that user.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key, required this.supabaseReady});

  /// Supabase initialized; otherwise the login enters demo mode.
  final bool supabaseReady;

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _demo = false;

  Future<void> _signInWithGoogle() async {
    if (!widget.supabaseReady) {
      setState(() => _demo = true);
      return;
    }
    await Supabase.instance.client.auth.signInWithOAuth(
      OAuthProvider.google,
      redirectTo: kIsWeb ? Uri.base.origin : mobileAuthRedirect,
      // Let people pick which Google account to use.
      queryParams: {'prompt': 'select_account'},
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.supabaseReady) {
      return _demo
          ? SignedInScope(
              key: const ValueKey('demo'),
              repository: MockRepository(),
              onSignOut: () async => setState(() => _demo = false),
              child: const MainShell(),
            )
          : LoginScreen(onGoogle: _signInWithGoogle, demoMode: true);
    }
    final auth = Supabase.instance.client.auth;
    return StreamBuilder<AuthState>(
      stream: auth.onAuthStateChange,
      builder: (context, _) {
        final user = auth.currentUser;
        if (user == null) return LoginScreen(onGoogle: _signInWithGoogle);
        return SignedInScope(
          // A different user gets fresh state.
          key: ValueKey(user.id),
          repository: SupabaseRepository(),
          onSignOut: auth.signOut,
          child: const MainShell(),
        );
      },
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
