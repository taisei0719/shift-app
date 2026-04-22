import 'package:flutter/material.dart';

class ShiftCalendarWidget extends StatelessWidget {
  final int year;
  final int month;
  final Map<String, dynamic> shiftsByDate;
  final void Function(String dateStr)? onDayTap;
  final void Function(int diff)? onMonthChange;
  final String? selectedDateStr;

  const ShiftCalendarWidget({
    super.key,
    required this.year,
    required this.month,
    required this.shiftsByDate,
    this.onDayTap,
    this.onMonthChange,
    this.selectedDateStr,
  });

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final firstDay = DateTime(year, month, 1);
    final lastDay = DateTime(year, month + 1, 0);
    final daysInMonth = lastDay.day;
    final dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    List<Widget> calendarCells = [];
    int startWeekday = firstDay.weekday % 7;
    for (int i = 0; i < startWeekday; i++) {
      calendarCells.add(const SizedBox());
    }
    for (int d = 1; d <= daysInMonth; d++) {
      final dateStr = '${year}-${month.toString().padLeft(2, '0')}-${d.toString().padLeft(2, '0')}';
      final shiftList = shiftsByDate[dateStr] ?? [];
      final isToday = now.year == year && now.month == month && now.day == d;
      final isSelected = selectedDateStr == dateStr;
      String statusText = '';
      Color statusColor = Colors.grey.shade300;
      if (shiftList.isNotEmpty) {
        final confirmed = shiftList.where((s) => s['shift_type'] == 'confirmed').toList();
        final requested = shiftList.where((s) => s['shift_type'] == 'request').toList();
        if (confirmed.isNotEmpty) {
          statusText = '✅ 確定済';
          statusColor = Colors.green.shade100;
        } else if (requested.isNotEmpty) {
          statusText = '⏳ 未確定';
          statusColor = Colors.yellow.shade100;
        }
      }

      if (isSelected) {
        statusColor = Colors.blue.shade100;
      }

      calendarCells.add(
        GestureDetector(
          onTap: () => onDayTap?.call(dateStr),
          child: Container(
            margin: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: statusColor,
              // 今日の日付はグレー枠、選択中は青枠
              border: Border.all(
                color: isSelected
                    ? Colors.blue
                    : isToday
                        ? Colors.black
                        : Colors.grey.shade300,
                width: isSelected || isToday ? 2 : 1,
              ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Stack(
              children: [
                Positioned(
                  top: 6,
                  right: 8,
                  child: Text(
                    '$d',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: isSelected
                          ? Colors.blue
                          : isToday
                              ? Colors.black
                              : Colors.black,
                    ),
                  ),
                ),
                Center(child: Text(statusText, style: const TextStyle(fontSize: 12))),
              ],
            ),
          ),
        ),
      );
    }

    return Column(
      children: [
        // 月移動ナビ
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_left),
              onPressed: () => onMonthChange?.call(-1),
            ),
            Text('$year年 $month月', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            IconButton(
              icon: const Icon(Icons.arrow_right),
              onPressed: () => onMonthChange?.call(1),
            ),
          ],
        ),
        Row(
          children: dayNames.map((d) => Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 8),
              color: d == '日' ? Colors.red.shade100 : d == '土' ? Colors.blue.shade100 : Colors.grey.shade200,
              child: Text(d, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold)),
            ),
          )).toList(),
        ),
        Expanded(
          child: GridView.count(
            crossAxisCount: 7,
            children: calendarCells,
          ),
        ),
      ],
    );
  }
}