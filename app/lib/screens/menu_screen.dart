import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../theme/app_colors.dart';
import '../widgets/app_header.dart';
import '../widgets/common.dart';

const _items = [
  (Icons.person_outline_rounded, 'Mi perfil'),
  (Icons.lock_outline_rounded, 'Seguridad'),
  (Icons.workspace_premium_outlined, 'Club PagoDirecto'),
  (Icons.account_balance_outlined, 'Cuentas bancarias'),
  (Icons.settings_outlined, 'Configuración'),
  (Icons.help_outline_rounded, 'Ayuda y soporte'),
  (Icons.logout_rounded, 'Cerrar sesión'),
];

class MenuScreen extends StatelessWidget {
  const MenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final profile = AppScope.of(context).profile;
    if (profile == null) return const LoadingView();

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          AppHeader(profile: profile),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, kNavBarClearance),
              children: [
                Material(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(22),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      for (final (icon, label) in _items)
                        ListTile(
                          leading: Icon(icon, color: AppColors.textPrimary),
                          title: Text(label),
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: () => openPlaceholder(context, label),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
