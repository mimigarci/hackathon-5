import 'mock_data.dart';
import 'models.dart';

/// Everything the screens read. Swap implementations in main.dart.
abstract class AppRepository {
  Future<UserProfile> getProfile();
  Future<Wallet> getWallet();
  Future<List<Movement>> getMovements();
  Future<List<Payment>> getPayments();
  Future<List<ClubTask>> getClubTasks();
  Future<List<ServiceProvider>> getMyServices();
}

class MockRepository implements AppRepository {
  @override
  Future<UserProfile> getProfile() async => MockData.profile;

  @override
  Future<Wallet> getWallet() async => MockData.wallet;

  @override
  Future<List<Movement>> getMovements() async => MockData.movements;

  @override
  Future<List<Payment>> getPayments() async => MockData.payments;

  @override
  Future<List<ClubTask>> getClubTasks() async => MockData.clubTasks;

  @override
  Future<List<ServiceProvider>> getMyServices() async => MockData.myServices;
}
