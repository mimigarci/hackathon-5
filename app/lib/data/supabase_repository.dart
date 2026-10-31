import 'package:supabase_flutter/supabase_flutter.dart';

import 'models.dart';
import 'repository.dart';

/// Reads from the tables in supabase/schema.sql. Requires a signed-in user;
/// row level security scopes every query to that user.
class SupabaseRepository implements AppRepository {
  SupabaseClient get _db => Supabase.instance.client;
  String get _uid => _db.auth.currentUser!.id;

  @override
  Future<UserProfile> getProfile() async {
    final row = await _db.from('profiles').select().eq('id', _uid).single();
    return UserProfile.fromMap(row);
  }

  @override
  Future<Wallet> getWallet() async {
    final row = await _db.from('wallets').select().eq('user_id', _uid).single();
    return Wallet.fromMap(row);
  }

  @override
  Future<List<Movement>> getMovements() async {
    final rows = await _db
        .from('movements')
        .select()
        .eq('user_id', _uid)
        .order('created_at', ascending: false);
    return rows.map(Movement.fromMap).toList();
  }

  @override
  Future<List<Payment>> getPayments() async {
    final rows = await _db
        .from('payments')
        .select('*, services(name)')
        .eq('user_id', _uid)
        .order('due_date');
    return rows.map(Payment.fromMap).toList();
  }

  @override
  Future<List<ClubTask>> getClubTasks() async {
    final rows = await _db
        .from('club_tasks')
        .select('*, user_club_tasks(completed_at)')
        .order('sort_order');
    return rows.map(ClubTask.fromMap).toList();
  }

  @override
  Future<List<ServiceProvider>> getMyServices() async {
    final rows = await _db
        .from('user_services')
        .select('services(*)')
        .eq('user_id', _uid)
        .order('created_at');
    return rows
        .map(
          (r) => ServiceProvider.fromMap(r['services'] as Map<String, dynamic>),
        )
        .toList();
  }
}
