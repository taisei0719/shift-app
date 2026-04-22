import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../widgets/shift_calendar_widget.dart';
import '../widgets/app_scaffold.dart';
import '../repositories/auth_repository.dart';

class AdminCalendarScreen extends ConsumerStatefulWidget {
  const AdminCalendarScreen({super.key});

  @override
  ConsumerState<AdminCalendarScreen> createState() => _AdminCalendarScreenState();
}

class _AdminCalendarScreenState extends ConsumerState<AdminCalendarScreen> {
  bool isLoading = true;
  String? error;
  DateTime currentMonth = DateTime.now();
  String? selectedDateStr;
  Map<String, String> statusMap = {}; // YYYY-MM-DD -> 'no_requests'|'requested'|'confirmed'
  Map<String, dynamic> shiftsByDate = {}; // ShiftCalendarWidget 用の簡易データ
  List<dynamic> staffShifts = [];

  // 日別取得用のローカルローディング（画面全体の isLoading と分離）
  bool isDayLoading = false;

  @override
  void initState() {
    super.initState();
    _fetchMonthlyStatus();
  }

  Future<void> _fetchMonthlyStatus() async {
    setState(() { isLoading = true; error = null; });
    try {
      final auth = ref.read(authProvider.notifier);
      final map = await auth.fetchAdminMonthlyStatus(currentMonth.year, currentMonth.month);
      // calendar widget向けに簡易変換: status -> shiftsByDate entry
      final Map<String, dynamic> conv = {};
      map.forEach((k, v) {
        if (v == 'confirmed') {
          conv[k] = [{'shift_type': 'confirmed'}];
        } else if (v == 'requested') {
          conv[k] = [{'shift_type': 'request'}];
        } else {
          conv[k] = [];
        }
      });
      setState(() {
        statusMap = map;
        shiftsByDate = conv;
        isLoading = false;
        selectedDateStr = null;
        staffShifts = [];
      });
    } catch (e) {
      setState(() { error = '月別ステータス取得失敗'; isLoading = false; });
    }
  }

  Future<void> _fetchDayShifts(String dateStr) async {
    setState(() { isDayLoading = true; error = null; });
    try {
      final auth = ref.read(authProvider.notifier);
      final list = await auth.fetchAdminShifts(dateStr);
      setState(() {
        staffShifts = list;
        isDayLoading = false;
      });
    } catch (e) {
      setState(() {
        error = '日別シフト取得失敗';
        isDayLoading = false;
      });
    }
  }

  void _changeMonth(int diff) {
    setState(() {
      currentMonth = DateTime(currentMonth.year, currentMonth.month + diff, 1);
    });
    _fetchMonthlyStatus();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;

    if (isLoading) {
      return AppScaffold(
        title: '管理者カレンダー',
        userRole: user?.role ?? 'admin',
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
    if (error != null) {
      return AppScaffold(
        title: '管理者カレンダー',
        userRole: user?.role ?? 'admin',
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
    final shopId = user?.shopId?.toString() ?? '';

    return AppScaffold(
      title: '管理者カレンダー',
      userRole: user?.role ?? 'admin',
      shopId: user?.shopId?.toString(),
      userName: user?.userName,
      shopName: user?.shopName,
      onLogout: () async {
          await ref.read(authProvider.notifier).logout();
          context.go('/');
      },
      body: Column(
        children: [
          Expanded(
            child: ShiftCalendarWidget(
              year: year,
              month: month,
              shiftsByDate: shiftsByDate,
              selectedDateStr: selectedDateStr,
              onDayTap: (dateStr) {
                if (selectedDateStr == dateStr) {
                  // 2回目タップで調整ページへ
                  context.go('/shop/$shopId/shift_adjust?date=$dateStr');
                } else {
                  // 1回目は選択と日別データ取得
                  setState(() { selectedDateStr = dateStr; staffShifts = []; });
                  _fetchDayShifts(dateStr);
                }
              },
              onMonthChange: (diff) => _changeMonth(diff),
            ),
          ),

          // 選択日の簡易サマリー（タイムライン風）
          if (selectedDateStr != null)
            Container(
              width: double.infinity,
              color: Colors.grey.shade50,
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('$selectedDateStr のシフト一覧', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  // 日別ローディング中は小さなインジケータを表示
                  if (isDayLoading)
                    const Center(child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ))
                  else if (staffShifts.isEmpty)
                    const Text('この日のシフトはまだありません'),

                  ...staffShifts.map((staff) {
                    final name = staff['name'] ?? '不明';
                    final confirmed = List<dynamic>.from(staff['confirmed'] ?? []);
                    final requests = List<dynamic>.from(staff['requests'] ?? []);
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 6),
                          // 確定シフトをバーで表示（複数あれば縦に並べる）
                          ...confirmed.map((c) => _buildTimeBar(c['start_time'], c['end_time'],
                            color: Colors.green.shade400,
                            label: '${c['start_time'] ?? ''} - ${c['end_time'] ?? ''}',
                          )).toList(),
                          // 未確定（希望）もバーで表示（色違い）
                          ...requests.map((r) => _buildTimeBar(r['start_time'], r['end_time'],
                            color: Colors.orange.shade300,
                            label: '${r['start_time'] ?? ''} - ${r['end_time'] ?? ''} (希望)',
                          )).toList(),
                        ],
                      ),
                    );
                  }).toList(),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTimeBar(String? start, String? end, {Color? color, String? label}) {
    // robust に時間文字列をパースする: 'HH:MM' / 'HH:MM:SS' / 'YYYY-MM-DDTHH:MM:SS' 等に対応
    double parseHM(String? s) {
      if (s == null) return 0.0;
      s = s.trim();
      if (s.isEmpty) return 0.0;
      final m = RegExp(r'(\d{1,2}):(\d{2})').firstMatch(s);
      if (m == null) return 0.0;
      final h = int.tryParse(m.group(1)!) ?? 0;
      final min = int.tryParse(m.group(2)!) ?? 0;
      return h + min / 60.0;
    }

    final sVal = parseHM(start);
    final eVal = parseHM(end);
    final total = 24.0;
    final leftRatio = (sVal / total).clamp(0.0, 1.0);
    double widthRatio = ((eVal - sVal) / total);
    if (widthRatio <= 0) {
      // 終了 <= 開始 の場合は最小幅を与える（見えるようにする）
      widthRatio = 0.02;
    }
    widthRatio = widthRatio.clamp(0.0, 1.0);

    final barColor = color ?? Colors.green.shade300;
    final labelText = label ?? '${start ?? ''} - ${end ?? ''}';

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxW = constraints.maxWidth;
        final barLeft = maxW * leftRatio;
        double barWidth = maxW * widthRatio;
        // overflow 対策
        if (barLeft + barWidth > maxW) {
          barWidth = (maxW - barLeft).clamp(2.0, maxW);
        }
        if (barWidth < 2) barWidth = 2;

        return Stack(
          children: [
            Container(
              height: 28,
              decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(6)),
            ),
            Positioned(
              left: barLeft,
              child: SizedBox(
                width: barWidth,
                height: 28,
                child: Container(
                  decoration: BoxDecoration(color: barColor, borderRadius: BorderRadius.circular(6)),
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Text(labelText, style: const TextStyle(fontSize: 12, color: Colors.white), overflow: TextOverflow.ellipsis),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}