import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../widgets/common.dart';
import '../../widgets/flow_widgets.dart';

/// Pagar Ticket Físico: QR reader with a manual fallback (F34.1). The camera
/// isn't wired yet, so the reader shows the observed camera error.
class TicketScanScreen extends StatelessWidget {
  const TicketScanScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return FlowScaffold(
      title: 'Estacionamientos',
      body: Column(
        children: [
          const _WhereToScan(),
          Expanded(
            child: Container(
              margin: const EdgeInsets.all(28),
              decoration: BoxDecoration(
                color: AppColors.navy,
                borderRadius: BorderRadius.circular(28),
              ),
              child: const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.no_photography_outlined,
                        color: Colors.white70,
                        size: 56,
                      ),
                      SizedBox(height: 12),
                      Text(
                        'Error accediendo a la cámara',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.white, fontSize: 17),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const TicketManualScreen()),
            ),
            child: const Text(
              'Ingresa el código numérico manualmente',
              style: TextStyle(
                color: Color(0xFF29A8E0),
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

/// Manual ticket code (F34.2). The code stays a string so leading zeros
/// survive; QR and manual entry are alternatives, never both.
class TicketManualScreen extends StatefulWidget {
  const TicketManualScreen({super.key});

  @override
  State<TicketManualScreen> createState() => _TicketManualScreenState();
}

class _TicketManualScreenState extends State<TicketManualScreen> {
  final _code = TextEditingController();

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final code = _code.text.trim();
    return FlowScaffold(
      title: 'Estacionamientos',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(28, 0, 28, 20),
        children: [
          const _WhereToScan(),
          const SizedBox(height: 40),
          const Icon(Icons.pin_outlined, size: 72, color: AppColors.parking),
          const SizedBox(height: 20),
          const Text(
            'Ingresa el código numérico\nde tu ticket físico',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 28),
          TextField(
            controller: _code,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            onChanged: (_) => setState(() {}),
            style: const TextStyle(fontSize: 20, letterSpacing: 2),
            decoration: InputDecoration(
              hintText: '0000000000000',
              hintStyle: const TextStyle(color: Color(0xFFC9CAD2)),
              filled: true,
              fillColor: AppColors.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(40),
              ),
            ),
          ),
          const SizedBox(height: 28),
          const Text(
            '¿Tienes problemas para ingresar el código?',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary, fontSize: 15),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const TicketScanScreen()),
            ),
            child: const Text(
              'Escanea el código QR',
              style: TextStyle(color: Color(0xFF29A8E0)),
            ),
          ),
        ],
      ),
      bottom: PillButton(
        label: 'Aceptar',
        onPressed: code.isEmpty
            ? null
            : () => showActionReview(
                context,
                action: 'consultar el ticket',
                summary: {'Código del ticket': code},
              ),
      ),
    );
  }
}

class _WhereToScan extends StatelessWidget {
  const _WhereToScan();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Material(
          color: const Color(0xFFA9A9AE),
          borderRadius: const BorderRadius.horizontal(
            left: Radius.circular(30),
          ),
          child: InkWell(
            onTap: () => openPlaceholder(context, 'Dónde digitalizar'),
            child: const Padding(
              padding: EdgeInsets.fromLTRB(20, 12, 16, 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Dónde digitalizar',
                    style: TextStyle(color: Colors.white, fontSize: 16),
                  ),
                  SizedBox(width: 8),
                  Icon(Icons.chevron_right_rounded, color: Colors.white),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
