import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../repositories/auth_repository.dart';
import 'package:go_router/go_router.dart';
import '../widgets/app_scaffold.dart';
import '../widgets/shift_calendar_widget.dart';

class StaffCalendarScreen extends ConsumerStatefulWidget {
  const StaffCalendarScreen({super.key});

  @override
  ConsumerState<StaffCalendarScreen> createState() => _StaffCalendarScreenState();
}

class _StaffCalendarScreenState extends ConsumerState<StaffCalendarScreen> {
  bool isLoading = true;
  String? error;
  Map<String, dynamic> shiftsByDate = {};
  DateTime currentMonth = DateTime.now();
  String? selectedDateStr;

  @override
  void initState() {
    super.initState();
    _fetchShifts();
  }

  Future<void> _fetchShifts() async {
    final user = ref.read(authProvider).value;
    if (user?.shopId == null) {
      setState(() {
        shiftsByDate = {}; // 空データ
        isLoading = false;
      });
      return;
    }
    try {
      final res = await ref.read(authProvider.notifier).fetchUserShiftsByMonth(currentMonth.year, currentMonth.month);
      setState(() {
        shiftsByDate = res['shifts_by_date'] ?? {};
        isLoading = false;
        selectedDateStr = null;
      });
    } catch (e) {
      setState(() {
        error = 'シフトデータの取得に失敗しました';
        isLoading = false;
      });
    }
  }

  void _changeMonth(int diff) {
    setState(() {
      currentMonth = DateTime(currentMonth.year, currentMonth.month + diff, 1);
      isLoading = true;
    });
    _fetchShifts();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;

    // ローディング
    if (isLoading) {
      return AppScaffold(
        title: 'シフトカレンダー',
        userRole: user?.role ?? 'staff',
        shopId: user?.shopId?.toString(),
        userName: user?.userName,
        shopName: user?.shopName,
        onLogout: () async {
          await ref.read(authProvider.notifier).logout();
          context.go('/');
        },
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    
    // エラー表示
    if (error != null) {
      return AppScaffold(
        title: 'シフトカレンダー',
        userRole: user?.role ?? 'staff',
        shopId: user?.shopId?.toString(),
        userName: user?.userName,
        shopName: user?.shopName,
        onLogout: () async {
          await ref.read(authProvider.notifier).logout();
          context.go('/');
        },
        body: Center(child: Text(error!)),
      );
    }

    final year = currentMonth.year;
    final month = currentMonth.month;

    // 選択した日付のシフト情報
    final selectedShifts = selectedDateStr != null
        ? (shiftsByDate[selectedDateStr!] ?? [])
        : [];

    final confirmedShifts = selectedShifts.where((s) => s['shift_type'] == 'confirmed').toList();
    final requestedShifts = selectedShifts.where((s) => s['shift_type'] == 'request').toList();

    // カレンダーグリッド
    return AppScaffold(
      title: 'シフトカレンダー',
      userRole: user?.role ?? 'staff',
      shopId: user?.shopId?.toString(),
      userName: user?.userName,
      shopName: user?.shopName,
      onLogout: () async {
        await ref.read(authProvider.notifier).logout();
        context.go('/');
      },
      body: Column(
        children: [
          // カレンダーグリッド
          Expanded(
            child: ShiftCalendarWidget(
              year: year,
              month: month,
              shiftsByDate: shiftsByDate,
              selectedDateStr: selectedDateStr,
              onDayTap: (dateStr) {
                final shopId = user?.shopId?.toString() ?? '';
                if (selectedDateStr == dateStr) {// 2回目のタップ（同じ日付）なら詳細ページへ遷移
                  context.go('/shop/$shopId/shifts_day?date=$dateStr');
                } else {// 1回目のタップなら選択だけ
                  setState(() {
                    selectedDateStr = dateStr;
                  });
                }
              },
              onMonthChange: (diff) {
                _changeMonth(diff);
              },
            ),
          ),

          // 選択した日付のシフト情報を下に表示
          if (selectedDateStr != null)
            Container(
                width: double.infinity,
                color: Colors.grey.shade100,
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$selectedDateStr のシフト',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    if (confirmedShifts.isNotEmpty)
                      ...confirmedShifts.map((s) => ListTile(
                            leading: const Icon(Icons.check_circle, color: Colors.green),
                            title: Text('確定シフト: ${s['start_time']} ~ ${s['end_time']}'),
                            subtitle: Text('備考: ${s['note'] ?? ''}'),
                          )),
                    if (requestedShifts.isNotEmpty)
                      ...requestedShifts.map((s) => ListTile(
                            leading: const Icon(Icons.hourglass_top, color: Colors.orange),
                            title: Text('希望シフト: ${s['start_time']} ~ ${s['end_time']}'),
                            subtitle: Text('備考: ${s['note'] ?? ''}'),                               
                          )),
                    if (confirmedShifts.isEmpty && requestedShifts.isEmpty)
                      Text('この日に提出・確定されたシフトはありません。'),
                  ],
                ),
            ),
        ],
      ),
    );
  }
}