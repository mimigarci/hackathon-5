import 'dart:ui';

Color _parseHex(String? hex, Color fallback) {
  if (hex == null || hex.isEmpty) return fallback;
  final value = int.tryParse(hex.replaceFirst('#', ''), radix: 16);
  if (value == null) return fallback;
  return Color(hex.length <= 7 ? 0xFF000000 | value : value);
}

double _toDouble(Object? v) => v is num ? v.toDouble() : double.parse('$v');

class UserProfile {
  const UserProfile({
    required this.id,
    required this.username,
    required this.level,
    this.avatarUrl,
    this.verified = false,
    this.streakProgress = 0,
  });

  final String id;
  final String username;
  final String level;
  final String? avatarUrl;
  final bool verified;

  /// 0..1, drives the ring around the streak (flame) button.
  final double streakProgress;

  factory UserProfile.fromMap(Map<String, dynamic> m) => UserProfile(
    id: m['id'] as String,
    username: m['username'] as String,
    level: m['level'] as String? ?? 'Turista',
    avatarUrl: m['avatar_url'] as String?,
    verified: m['verified'] as bool? ?? false,
    streakProgress: _toDouble(m['streak_progress'] ?? 0),
  );
}

class Wallet {
  const Wallet({required this.balance, this.currency = 'VES'});

  final double balance;
  final String currency;

  factory Wallet.fromMap(Map<String, dynamic> m) => Wallet(
    balance: _toDouble(m['balance']),
    currency: m['currency'] as String? ?? 'VES',
  );
}

enum MovementType { income, expense }

class Movement {
  const Movement({
    required this.id,
    required this.type,
    required this.title,
    required this.amount,
    required this.createdAt,
    this.subtitle,
  });

  final String id;
  final MovementType type;
  final String title;
  final String? subtitle;

  /// Always positive; [type] says which direction the money went.
  final double amount;
  final DateTime createdAt;

  factory Movement.fromMap(Map<String, dynamic> m) => Movement(
    id: m['id'] as String,
    type: MovementType.values.byName(m['type'] as String),
    title: m['title'] as String,
    subtitle: m['subtitle'] as String?,
    amount: _toDouble(m['amount']),
    createdAt: DateTime.parse(m['created_at'] as String),
  );
}

class ServiceProvider {
  const ServiceProvider({
    required this.id,
    required this.name,
    required this.brandColor,
  });

  final String id;
  final String name;
  final Color brandColor;

  factory ServiceProvider.fromMap(Map<String, dynamic> m) => ServiceProvider(
    id: m['id'] as String,
    name: m['name'] as String,
    brandColor: _parseHex(m['brand_color'] as String?, const Color(0xFF1B1B1F)),
  );
}

enum PaymentStatus { pending, scheduled, paid }

class Payment {
  const Payment({
    required this.id,
    required this.serviceName,
    required this.amount,
    required this.status,
    this.dueDate,
  });

  final String id;
  final String serviceName;
  final double amount;
  final PaymentStatus status;
  final DateTime? dueDate;

  factory Payment.fromMap(Map<String, dynamic> m) => Payment(
    id: m['id'] as String,
    serviceName:
        (m['services'] as Map<String, dynamic>?)?['name'] as String? ??
        m['service_id'] as String,
    amount: _toDouble(m['amount']),
    status: PaymentStatus.values.byName(m['status'] as String),
    dueDate: m['due_date'] == null
        ? null
        : DateTime.parse(m['due_date'] as String),
  );
}

class ClubTask {
  const ClubTask({
    required this.id,
    required this.title,
    required this.description,
    required this.points,
    required this.icon,
    this.completed = false,
  });

  final String id;
  final String title;
  final String description;
  final int points;

  /// Icon key, mapped to an IconData in ClubCarousel.
  final String icon;
  final bool completed;

  factory ClubTask.fromMap(Map<String, dynamic> m) => ClubTask(
    id: m['id'] as String,
    title: m['title'] as String,
    description: m['description'] as String,
    points: m['points'] as int,
    icon: m['icon'] as String? ?? 'star',
    completed: (m['user_club_tasks'] as List?)?.isNotEmpty ?? false,
  );
}
