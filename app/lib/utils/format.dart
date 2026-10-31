const _months = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/// Formats an amount the Venezuelan way: `Bs 1.234,56`.
/// [dotted] renders the `Bs.` prefix used on the Mis pagos screen.
String formatBs(double amount, {bool dotted = false, bool signed = false}) {
  final parts = amount.abs().toStringAsFixed(2).split('.');
  final whole = parts[0].replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
  final sign = amount < 0 ? '-' : (signed && amount > 0 ? '+' : '');
  return '${dotted ? 'Bs.' : 'Bs'} $sign$whole,${parts[1]}';
}

String formatShortDate(DateTime date) =>
    '${date.day} ${_months[date.month - 1]} ${date.year}';
