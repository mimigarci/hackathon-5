import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../widgets/app_header.dart';
import '../widgets/common.dart';
import '../widgets/home_sections.dart';
import '../widgets/wallet_carousel.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.onSeeAllPayments});

  final VoidCallback onSeeAllPayments;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final profile = state.profile;
    if (profile == null) return const LoadingView();

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          AppHeader(profile: profile),
          Expanded(
            child: RefreshIndicator(
              onRefresh: state.load,
              child: ListView(
                padding: const EdgeInsets.only(bottom: kNavBarClearance),
                children: [
                  WalletCarousel(
                    wallet: state.wallet,
                    actions: [
                      WalletAction(
                        Icons.send_to_mobile_outlined,
                        'Enviar Wallet',
                        onTap: () => openPlaceholder(context, 'Enviar Wallet'),
                      ),
                      WalletAction(
                        Icons.account_balance_wallet_outlined,
                        'Depositar',
                        onTap: () => openPlaceholder(context, 'Depositar'),
                      ),
                      WalletAction(
                        Icons.grid_view_rounded,
                        'Más',
                        onTap: () => openPlaceholder(context, 'Más opciones'),
                      ),
                    ],
                  ),
                  const SectionTitle('Club PagoDirecto'),
                  ClubCarousel(
                    tasks: state.clubTasks,
                    onComplete: (t) => openPlaceholder(context, t.title),
                  ),
                  SectionTitle(
                    'Mis pagos',
                    actionLabel: 'Ver todos',
                    onAction: onSeeAllPayments,
                  ),
                  MyServicesRow(
                    services: state.myServices,
                    onRegister: () =>
                        openPlaceholder(context, 'Registra tu servicio'),
                    onServiceTap: (s) => openPlaceholder(context, s.name),
                  ),
                  const SectionTitle('Funciones'),
                  FunctionsGrid(
                    onTap: (f) => openPlaceholder(context, f.label),
                  ),
                  const SectionTitle('Sugerencias'),
                  SuggestionsCarousel(
                    onTap: (s) => openPlaceholder(context, s.brand),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
