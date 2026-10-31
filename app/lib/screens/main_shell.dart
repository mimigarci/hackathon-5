import 'dart:async';

import 'package:flutter/material.dart';

import '../widgets/bottom_nav.dart';
import '../widgets/mascot.dart';
import 'assistant_screen.dart';
import 'home_screen.dart';
import 'menu_screen.dart';
import 'movements_screen.dart';
import 'payments_screen.dart';

/// Hosts the four bottom-nav tabs and the mascot button.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  static const _idleBeforeSleep = Duration(seconds: 12);

  int _index = 0;
  bool _sleeping = false;
  Timer? _idleTimer;

  @override
  void initState() {
    super.initState();
    _resetIdle();
  }

  @override
  void dispose() {
    _idleTimer?.cancel();
    super.dispose();
  }

  void _resetIdle() {
    _idleTimer?.cancel();
    if (_sleeping) setState(() => _sleeping = false);
    _idleTimer = Timer(_idleBeforeSleep, () {
      if (mounted) setState(() => _sleeping = true);
    });
  }

  void _goTo(int index) => setState(() => _index = index);

  MascotMood get _mood {
    if (_sleeping) return MascotMood.sleeping;
    return _index == 1 ? MascotMood.bored : MascotMood.awake;
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _resetIdle(),
      child: Scaffold(
        extendBody: true,
        body: IndexedStack(
          index: _index,
          children: [
            HomeScreen(onSeeAllPayments: () => _goTo(2)),
            const MovementsScreen(),
            PaymentsScreen(onBack: () => _goTo(0)),
            const MenuScreen(),
          ],
        ),
        bottomNavigationBar: AppBottomNav(
          currentIndex: _index,
          onTap: _goTo,
          mood: _mood,
          onMascotTap: () => Navigator.of(context)
              .push(MaterialPageRoute(builder: (_) => const AssistantScreen())),
        ),
      ),
    );
  }
}
