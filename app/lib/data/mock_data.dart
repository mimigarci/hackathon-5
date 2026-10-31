import 'dart:ui';

import 'models.dart';

/// Local data that mirrors the reference screenshots (empty wallet, no
/// movements, no payments). Flip [showSampleData] to see populated lists.
class MockData {
  MockData._();

  static const showSampleData = false;

  static const profile = UserProfile(
    id: 'mock-user',
    username: 'mimigarcia',
    level: 'Turista',
    verified: true,
    streakProgress: 0.35,
  );

  static const wallet = Wallet(balance: showSampleData ? 1250.75 : 0.0);

  static const clubTasks = [
    ClubTask(
      id: 'passkey',
      title: 'Llave de acceso',
      description: 'Activa, protege tu cuenta y gana puntos del Club.',
      points: 250,
      icon: 'key',
    ),
    ClubTask(
      id: 'vehicle',
      title: 'Registra tu vehículo',
      description: 'Agrega tu placa y paga estacionamientos más rápido.',
      points: 150,
      icon: 'car',
    ),
  ];

  static const myServices = [
    ServiceProvider(
      id: 'digitel',
      name: 'Digitel',
      brandColor: Color(0xFFC8102E),
    ),
    ServiceProvider(
      id: 'movilnet',
      name: 'Movilnet',
      brandColor: Color(0xFFE5332A),
    ),
    ServiceProvider(
      id: 'movistar',
      name: 'Movistar',
      brandColor: Color(0xFF0B9DDC),
    ),
  ];

  static List<Movement> get movements => showSampleData
      ? [
          Movement(
            id: 'm1',
            type: MovementType.income,
            title: 'Depósito',
            subtitle: 'Banco de Venezuela',
            amount: 2000,
            createdAt: DateTime.now().subtract(const Duration(days: 1)),
          ),
          Movement(
            id: 'm2',
            type: MovementType.expense,
            title: 'Pago Digitel',
            subtitle: 'Recarga',
            amount: 450.25,
            createdAt: DateTime.now().subtract(const Duration(days: 3)),
          ),
          Movement(
            id: 'm3',
            type: MovementType.expense,
            title: 'Estacionamiento',
            subtitle: 'C.C. Sambil',
            amount: 299,
            createdAt: DateTime.now().subtract(const Duration(days: 20)),
          ),
        ]
      : [];

  static List<Payment> get payments => showSampleData
      ? [
          Payment(
            id: 'p1',
            serviceName: 'Movistar',
            amount: 380,
            status: PaymentStatus.pending,
            dueDate: DateTime.now().add(const Duration(days: 5)),
          ),
          Payment(
            id: 'p2',
            serviceName: 'Movilnet',
            amount: 210.5,
            status: PaymentStatus.scheduled,
            dueDate: DateTime.now().add(const Duration(days: 12)),
          ),
          Payment(
            id: 'p3',
            serviceName: 'Digitel',
            amount: 450.25,
            status: PaymentStatus.paid,
            dueDate: DateTime.now().subtract(const Duration(days: 3)),
          ),
        ]
      : [];
}
