import 'package:flutter/widgets.dart';

import 'models.dart';
import 'repository.dart';

/// App-wide data, loaded once from the repository and refreshable with
/// pull-to-refresh. Read it with `AppScope.of(context)`.
class AppState extends ChangeNotifier {
  AppState(this.repository);

  final AppRepository repository;

  bool loading = true;
  Object? error;
  UserProfile? profile;
  Wallet wallet = const Wallet(balance: 0);
  List<Movement> movements = const [];
  List<Payment> payments = const [];
  List<ClubTask> clubTasks = const [];
  List<ServiceProvider> myServices = const [];

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final r = repository;
      final (p, w, m, pay, club, services) = await (
        r.getProfile(),
        r.getWallet(),
        r.getMovements(),
        r.getPayments(),
        r.getClubTasks(),
        r.getMyServices(),
      ).wait;
      profile = p;
      wallet = w;
      movements = m;
      payments = pay;
      clubTasks = club;
      myServices = services;
    } catch (e) {
      error = e is ParallelWaitError ? e.errors : e;
    }
    loading = false;
    notifyListeners();
  }

  List<Payment> paymentsWith(PaymentStatus status) =>
      payments.where((p) => p.status == status).toList();
}

class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child})
    : super(notifier: state);

  static AppState of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
}
