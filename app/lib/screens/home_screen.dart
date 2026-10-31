import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../widgets/app_header.dart';
import '../widgets/common.dart';
import '../widgets/home_sections.dart';
import '../widgets/wallet_carousel.dart';
import 'functions_router.dart';
import 'insurance_screen.dart';
import 'parking/vehicles_screen.dart';
import 'services/service_manage_screen.dart';
import 'services/services_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.onSeeAllPayments});

  final VoidCallback onSeeAllPayments;

  void _push(BuildContext context, Widget screen) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));

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
                    onComplete: (t) => t.id == 'vehicle'
                        ? _push(context, const VehiclesScreen())
                        : openPlaceholder(context, t.title),
                  ),
                  SectionTitle(
                    'Mis pagos',
                    actionLabel: 'Ver todos',
                    onAction: onSeeAllPayments,
                  ),
                  MyServicesRow(
                    services: state.myServices,
                    onRegister: () => _push(context, const ServicesScreen()),
                    onServiceTap: (s) => openServiceById(context, s.id),
                  ),
                  const SectionTitle('Funciones'),
                  FunctionsGrid(onTap: (f) => openFunction(context, f)),
                  const SectionTitle('Sugerencias'),
                  SuggestionsCarousel(
                    onTap: (s) => s.brand == 'Jomi'
                        ? openServiceById(context, 'jomi')
                        : _push(context, const InsuranceScreen()),
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
